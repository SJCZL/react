import { BaseAnalysisService } from './BaseAnalysisService.js';
import { ANALYSIS_CONFIG, CustomerPsychologyAnalysis } from './AnalysisConfig.js';

/**
 * Customer Psychology Analysis Service
 * Analyzes customer messages using expert committee system
 */
export class CustomerPsychologyService extends BaseAnalysisService {
    constructor(apiKey, model, temperature) {
        super(apiKey, model, temperature);
    }

    /**
     * Analyze customer psychology with expert committee
     */
    async analyzeCustomerPsychology(systemPrompt, conversationHistory, currentMessage, expertCount = 4, options = {}) {
        const experts = ANALYSIS_CONFIG.EXPERT_JUDGE_NICKNAMES.slice(0, expertCount);
        const analysis = new CustomerPsychologyAnalysis();
        
        // Generate expert analyses in parallel
        const expertPromises = experts.map((expert, index) => 
            this.generateExpertAnalysis(expert, systemPrompt, conversationHistory, currentMessage, options)
        );
        
        try {
            const expertResults = await Promise.allSettled(expertPromises);
            
            // Process results and calculate aggregates
            let validExpertCount = 0;
            const scoreSums = {
                trust: 0,
                urgency: 0,
                priceSensitivity: 0,
                brandAspiration: 0,
                decisionFatigue: 0
            };
            
            expertResults.forEach((result, index) => {
                if (result.status === 'fulfilled' && result.value) {
                    const expertData = result.value;
                    analysis.expertScores[experts[index]] = expertData;
                    
                    // Sum scores for averaging
                    Object.keys(scoreSums).forEach(key => {
                        if (expertData[key] !== undefined) {
                            scoreSums[key] += expertData[key];
                            validExpertCount++;
                        }
                    });
                } else {
                    console.warn(`Expert ${experts[index]} analysis failed:`, result.reason);
                }
            });
            
            // Calculate average scores
            if (validExpertCount > 0) {
                Object.keys(scoreSums).forEach(key => {
                    analysis.aggregatedScores[key] = Math.round((scoreSums[key] / (validExpertCount / 5)) * 10) / 10;
                });
            }
            
            // Calculate confidence based on expert agreement
            analysis.confidence = this.calculateConfidenceScore(analysis.expertScores);
            analysis.analysisTimestamp = new Date().toISOString();
            
            return analysis;
            
        } catch (error) {
            console.error('Customer psychology analysis failed:', error);
            throw error;
        }
    }

    /**
     * Generate analysis from a single expert
     */
    async generateExpertAnalysis(expertName, systemPrompt, conversationHistory, currentMessage, options) {
        const prompt = this.createExpertPrompt(expertName, systemPrompt, conversationHistory, currentMessage);
        
        const response = await this.executeAnalysis(prompt, {
            ...options,
            onRetry: (attempt, error) => {
                console.log(`Expert ${expertName} analysis retry ${attempt}:`, error.message);
            }
        });
        
        return this.parseExpertResponse(response);
    }

    /**
     * Create prompt for individual expert
     */
    createExpertPrompt(expertName, systemPrompt, conversationHistory, currentMessage) {
        const formattedHistory = conversationHistory.map(msg => {
            const role = msg.role === 'user' ? '销售代表' : '客户';
            return `${role}: ${msg.content}`;
        }).join('\n');
        
        const expertPersonalities = {
            '陈博士': {
                specialty: '认知行为心理学专家，注重客户的思维模式和决策过程',
                bias: '倾向于分析客户的理性思考和逻辑判断',
                perspective: '从认知偏差和思维框架角度评估客户心理'
            },
            '王教授': {
                specialty: '社会心理学专家，关注人际关系和群体影响',
                bias: '强调社会认同和人际互动对客户决策的影响',
                perspective: '从社会环境和人际关系角度分析客户行为'
            },
            '李博士': {
                specialty: '消费心理学专家，研究购买行为和消费动机',
                bias: '关注情感因素和潜意识动机对购买决策的影响',
                perspective: '从情感需求和消费心理角度解读客户反应'
            },
            '张博士': {
                specialty: '临床心理学专家，擅长分析深层心理需求',
                bias: '重视客户的内心冲突和潜在心理需求',
                perspective: '从心理防御机制和内在动机角度分析客户'
            }
        };
        
        const personality = expertPersonalities[expertName] || expertPersonalities['陈博士'];
        
        return `
你是${expertName}，${personality.specialty}。${personality.perspective}。你的分析风格${personality.bias}。

对话背景：
系统提示：${systemPrompt}

之前的对话：
${formattedHistory}

客户的最新消息：
${currentMessage.content}

请基于你的专业视角分析这个客户消息，并按照0-10分的标准评估以下心理变量：

1. 对销售代表的信任度：客户相信销售代表诚实、有能力并为客户最佳利益着想的程度
2. 需求紧迫性：客户当前感受到产品能解决的痛点或需求的强烈程度
3. 价格敏感度：客户在价格与其他利益之间的权衡程度（0 = "价格不是问题"，10 = "每一分钱都很重要"）
4. 品牌/地位期望：客户对拥有品牌所带来的社会形象或自我提升的重视程度
5. 决策疲劳度：客户的精神负担或不耐烦程度（分数越高越可能拖延、委托或放弃购买）

请使用以下JSON格式回复：
{
  "trust": 数字 (0-10),
  "urgency": 数字 (0-10),
  "priceSensitivity": 数字 (0-10),
  "brandAspiration": 数字 (0-10),
  "decisionFatigue": 数字 (0-10),
  "reasoning": "基于${personality.specialty}的评分理由说明"
}

请基于你的专业背景和独特视角进行分析，体现你的专业特色。
`.trim();
    }

    /**
     * Parse expert response and extract ratings
     */
    parseExpertResponse(response) {
        const parsed = this.parseJsonFromResponse(response);
        
        if (!parsed) {
            throw new Error('Failed to parse expert analysis response');
        }
        
        // Validate and normalize scores
        const scores = {};
        Object.keys(ANALYSIS_CONFIG.PSYCHOLOGY_VARIABLES).forEach(key => {
            const variable = ANALYSIS_CONFIG.PSYCHOLOGY_VARIABLES[key];
            let score = parsed[variable.key] || parsed[key.toLowerCase()];
            
            if (typeof score === 'number') {
                // Clamp to valid range
                score = Math.max(variable.min, Math.min(variable.max, score));
                scores[variable.key] = Math.round(score * 10) / 10;
            } else {
                // Default to middle value if invalid
                scores[variable.key] = 5;
            }
        });
        
        return scores;
    }

    /**
     * Calculate confidence score based on expert agreement
     */
    calculateConfidenceScore(expertScores) {
        const experts = Object.keys(expertScores);
        if (experts.length < 2) return 0.5; // Low confidence with single expert
        
        const variables = Object.keys(ANALYSIS_CONFIG.PSYCHOLOGY_VARIABLES);
        let totalAgreement = 0;
        let comparisonCount = 0;
        
        variables.forEach(varKey => {
            const scores = experts.map(expert => expertScores[expert][varKey]).filter(s => s !== undefined);
            
            if (scores.length >= 2) {
                // Calculate standard deviation as a measure of agreement
                const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
                const variance = scores.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / scores.length;
                const stdDev = Math.sqrt(variance);
                
                // Convert to confidence (lower stdDev = higher confidence)
                const maxStdDev = 5; // Maximum expected standard deviation
                const agreement = Math.max(0, 1 - (stdDev / maxStdDev));
                
                totalAgreement += agreement;
                comparisonCount++;
            }
        });
        
        return comparisonCount > 0 ? totalAgreement / comparisonCount : 0.5;
    }
}