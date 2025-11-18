import { BaseAnalysisService } from './BaseAnalysisService.js';
import { ANALYSIS_CONFIG, SalesPerformanceAnalysis } from './AnalysisConfig.js';

/**
 * Sales Performance Analysis Service
 * Evaluates sales representative performance and techniques
 */
export class SalesPerformanceService extends BaseAnalysisService {
    constructor(apiKey, model, temperature) {
        super(apiKey, model, temperature);
    }

    /**
     * Analyze sales performance for user messages
     */
    async analyzeSalesPerformance(systemPrompt, conversationHistory, currentMessage, options = {}) {
        // Expert-based rating feature removed; build analysis without expert panel
        const analysis = new SalesPerformanceAnalysis();
        analysis.expertRatings = {};
        
        try {
            // Skip expert scoring entirely; keep overallScore at default (0)
            
            // Generate additional analysis elements
            await this.generateAdditionalAnalysis(analysis, systemPrompt, conversationHistory, currentMessage, options);
            
            analysis.analysisTimestamp = new Date().toISOString();
            
            return analysis;
            
        } catch (error) {
            console.error('Sales performance analysis failed:', error);
            throw error;
        }
    }

    /**
     * Generate rating from a single expert
     */
    async generateExpertRating(expert, systemPrompt, conversationHistory, currentMessage, options) {
        const prompt = this.createExpertRatingPrompt(expert, systemPrompt, conversationHistory, currentMessage);
        
        const response = await this.executeAnalysis(prompt, {
            ...options,
            onRetry: (attempt, error) => {
                console.log(`Expert ${expert.name} rating retry ${attempt}:`, error.message);
            }
        });
        
        return this.parseExpertRatingResponse(response);
    }

    /**
     * Create prompt for individual expert rating
     */
    createExpertRatingPrompt(expert, systemPrompt, conversationHistory, currentMessage) {
        const isFirstMessage = conversationHistory.length === 0;
        const formattedHistory = conversationHistory.map(msg => {
            const role = msg.role === 'user' ? '销售代表' : '客户';
            return `${role}: ${msg.content}`;
        }).join('\n');
        
        const historySection = isFirstMessage 
            ? '这是对话的第一条消息，没有之前的对话历史。'
            : `之前的对话：\n${formattedHistory}`;
        
        const contextFocus = isFirstMessage
            ? '开场白的有效性、第一印象建立、对话启动能力'
            : '对话上下文中的表现、对客户反应的回应能力';
        
        return `
你是${expert.name}，${expert.style}。${expert.approach}。

你的任务是对销售代表的最新消息进行专业评估，并给出0-100分的评分和简洁评价。

对话背景：
系统提示：${systemPrompt}

${historySection}

销售代表的最新消息：
${currentMessage.content}

请特别关注：${contextFocus}

基于你的专业风格和评估标准，请提供：

1. 评分（0-100分）：基于销售代表在${contextFocus}方面的表现。如果你温柔，你倾向于打高。如果你严格，你倾向于打低。
2. 简洁评价（五十字以内）：针对${expert.type === 'gentle' ? '优点和潜力' : '不足和改进空间'}的简要评语

请使用以下JSON格式回复：
{
  "score": 数字 (0-100),
  "review": "简洁的专家评价"
}

请体现你作为${expert.type === 'gentle' ? '温和评估者' : '严格评估者'}的专业特色。
`.trim();
    }

    /**
     * Parse expert rating response
     */
    parseExpertRatingResponse(response) {
        const parsed = this.parseJsonFromResponse(response);
        
        if (!parsed) {
            throw new Error('Failed to parse expert rating response');
        }
        
        let score = Math.round(Math.max(0, Math.min(100, parsed.score || 50)));
        let review = parsed.review || '无评价';
        
        return { score, review };
    }

    /**
     * Generate additional analysis elements (techniques, suggestions, detailed analysis)
     */
    async generateAdditionalAnalysis(analysis, systemPrompt, conversationHistory, currentMessage, options) {
        const prompt = this.createAdditionalAnalysisPrompt(systemPrompt, conversationHistory, currentMessage);
        
        const response = await this.executeAnalysis(prompt, {
            ...options,
            onRetry: (attempt, error) => {
                console.log(`Additional analysis retry ${attempt}:`, error.message);
            }
        });
        
        const parsed = this.parseJsonFromResponse(response);
        
        if (parsed) {
            analysis.techniquesUsed = Array.isArray(parsed.techniquesUsed) 
                ? parsed.techniquesUsed.filter(tech => typeof tech === 'string' && tech.trim())
                : [];
            
            analysis.suggestions = Array.isArray(parsed.suggestions)
                ? parsed.suggestions.filter(suggestion => typeof suggestion === 'string' && suggestion.trim())
                : [];
            
            analysis.analysis = parsed.analysis || '无详细分析';
        }
    }

    /**
     * Create prompt for additional analysis elements
     */
    createAdditionalAnalysisPrompt(systemPrompt, conversationHistory, currentMessage) {
        const isFirstMessage = conversationHistory.length === 0;
        const formattedHistory = conversationHistory.map(msg => {
            const role = msg.role === 'user' ? '销售代表' : '客户';
            return `${role}: ${msg.content}`;
        }).join('\n');
        
        const historySection = isFirstMessage 
            ? '这是对话的第一条消息，没有之前的对话历史。'
            : `之前的对话：\n${formattedHistory}`;
        
        const analysisContext = isFirstMessage
            ? '由于这是开场消息，请重点关注开场白的有效性、第一印象建立、以及为后续对话奠定基础的能力。'
            : '请分析这个销售代表在对话上下文中的表现，包括对之前客户反应的回应能力。';
        
        return `
你是一位专业的销售培训师和绩效分析师。你的任务是分析销售代表的消息，并提供详细的改进建议和分析。

对话背景：
系统提示：${systemPrompt}

${historySection}

销售代表的最新消息：
${currentMessage.content}

${analysisContext}

请使用以下JSON格式回复：
{
  "techniquesUsed": [
    "技巧1",
    "技巧2",
    "技巧3"
  ],
  "suggestions": [
    "改进建议1",
    "改进建议2",
    "改进建议3"
  ],
  "analysis": "对销售代表表现的详细文本分析，包括优势、改进领域、所用技巧的有效性，以及更好的客户参与和销售成果的具体建议"
}

请从以下方面分析：
- 沟通风格的有效性
- 客户参与和融洽关系建立
- 产品知识展示
- 异议处理
- 成交技巧
- 积极倾听技巧
- 提问策略
- 价值主张清晰度
- 对客户反应的适应性
- 整体专业素养

考虑常见的销售技巧，如：
- 积极倾听和转述
- 开放式提问
- 需求评估
- 以利益为导向的语言
- 社会证明和客户见证
- 稀缺性和紧迫性创造
- 异议预防和处理
- 关系建立
- 咨询式销售方法
- 以解决方案为导向的展示

${isFirstMessage ? '特别注意：这是开场消息，分析重点应该放在开场技巧、第一印象和对话启动能力上。' : ''}
`.trim();
    }

    /**
     * Create fallback analysis when JSON parsing fails
     */
    createFallbackAnalysis(response) {
        const analysis = new SalesPerformanceAnalysis();
        
        // Set default values
        analysis.overallScore = 0.5; // Neutral score
        analysis.techniquesUsed = ['无法解析具体技巧'];
        analysis.suggestions = ['请检查分析响应格式'];
        analysis.analysis = `分析响应解析失败。原始响应：\n${response.substring(0, 500)}${response.length > 500 ? '...' : ''}`;
        analysis.analysisTimestamp = new Date().toISOString();
        
        return analysis;
    }

    /**
     * Normalize score to 0-1 range
     */
    normalizeScore(score) {
        if (typeof score !== 'number') return 0.5;
        return Math.max(0, Math.min(1, Math.round(score * 100) / 100));
    }
}
