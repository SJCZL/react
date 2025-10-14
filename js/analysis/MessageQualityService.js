import { BaseAnalysisService } from './BaseAnalysisService.js';
import { ANALYSIS_CONFIG, MessageQualityAnalysis } from './AnalysisConfig.js';

/**
 * Message Quality Analysis Service
 * Evaluates how human-like and realistic customer messages are
 */
export class MessageQualityService extends BaseAnalysisService {
    constructor(apiKey, model, temperature) {
        super(apiKey, model, temperature);
    }

    /**
     * Analyze message quality for customer messages
     */
    async analyzeMessageQuality(systemPrompt, conversationHistory, currentMessage, options = {}) {
        const prompt = this.createQualityPrompt(systemPrompt, conversationHistory, currentMessage);
        
        const response = await this.executeAnalysis(prompt, {
            ...options,
            onRetry: (attempt, error) => {
                console.log(`Message quality analysis retry ${attempt}:`, error.message);
            }
        });
        
        return this.parseQualityResponse(response);
    }

    /**
     * Create prompt for message quality analysis
     */
    createQualityPrompt(systemPrompt, conversationHistory, currentMessage) {
        const formattedHistory = conversationHistory.map(msg => {
            const role = msg.role === 'user' ? '销售代表' : '客户';
            return `${role}: ${msg.content}`;
        }).join('\n');
        
        return `
你是一位专门研究AI语言和对话分析的专家，擅长检测AI生成的文本并评估类人品质。你的任务是分析销售对话中客户的消息，并评估其真实感。

对话背景：
系统提示：${systemPrompt}

之前的对话：
${formattedHistory}

客户的最新消息：
${currentMessage.content}

请分析这个客户消息，并按照0-1分的标准评估以下方面：

1. 类人品质：消息听起来有多自然和像人类（0 = 明显是AI生成，1 = 与人类无法区分）
2. AI检测：此消息是AI生成的可能性（0 = 肯定是人类，1 = 明显是AI）
3. 戏剧化程度：消息听起来有多夸张或结构化（0 = 完全自然，1 = 极度戏剧化/结构化）
4. 提示遵循度：消息对系统提示中描述的客户角色的遵循程度（0 = 完全不符合角色，1 = 完美符合角色）
5. 现实反应：客户对销售代表方法的反应有多现实（0 = 完全不现实，1 = 高度现实）

请使用以下JSON格式回复：
{
  "humanLikeScore": 数字 (0-1),
  "botDetectionScore": 数字 (0-1),
  "melodramaticScore": 数字 (0-1),
  "promptAdherenceScore": 数字 (0-1),
  "realisticReactionScore": 数字 (0-1),
  "analysis": "详细文本分析，解释你的评分并提供关于消息真实感、AI模式的具体观察和改进建议"
}

请在分析中具体和客观。考虑以下因素：
- 自然语言模式和流畅度
- 情感真实性
- 上下文逻辑性
- 与客户角色的一致性
- 对销售代表陈述的回应相关性

你需要非常，非常严厉，非特别真实不要给高分，不要 Justify。
`.trim();
    }

    /**
     * Parse quality analysis response
     */
    parseQualityResponse(response) {
        const parsed = this.parseJsonFromResponse(response);
        
        if (!parsed) {
            throw new Error('Failed to parse message quality analysis response');
        }
        
        const analysis = new MessageQualityAnalysis();
        
        // Extract and validate scores
        analysis.humanLikeScore = this.normalizeScore(parsed.humanLikeScore);
        analysis.botDetectionScore = this.normalizeScore(parsed.botDetectionScore);
        analysis.melodramaticScore = this.normalizeScore(parsed.melodramaticScore);
        analysis.promptAdherenceScore = this.normalizeScore(parsed.promptAdherenceScore);
        analysis.realisticReactionScore = this.normalizeScore(parsed.realisticReactionScore);
        
        // Extract analysis text
        analysis.analysis = parsed.analysis || 'No detailed analysis provided.';
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