import { BaseService } from './BaseService.js';
import { modelConfig } from '../config/ModelConfig.js';

/**
 * Rating Service for dialogue rating
 * Focuses on rating the performance of the assistant LLM (The Customer) from 0 to 10
 */
export class RatingService extends BaseService {
    constructor(apiKey = null, modelName = null) {
        super(apiKey, modelName);
    }

    /**
     * Start a rating session
     * @param {Object} config - Rating configuration
     * @param {Object} config.llmConfig - LLM configuration object (temp, etc.)
     * @param {Object} config.chatRecord - Full Main Chat Tab compatible chat record with systemPrompt and conversation
     * @param {string} config.sceneDescription - Description of the scene/context for the conversation
     * @param {Object} config.assessmentResult - Assessment results with identified mistakes to be considered in scoring
     * @param {Array} config.expertPanel - Panel of experts with different specializations and standards
     * @param {boolean} config.includeSystemPrompt - Whether to include the system prompt in the rating
     * @returns {Promise<Object>} - Rating results with scores, comments, and final weighted average
     */
    async startRating(config) {
        const {
            llmConfig = {},
            chatRecord = {},
            sceneDescription = '',
            assessmentResult = null,
            expertPanel = [],
            includeSystemPrompt = true
        } = config;

        // Validate required parameters
        if (!chatRecord || !chatRecord.conversation || chatRecord.conversation.length === 0) {
            throw new Error('Chat record with conversation is required');
        }

        if (!expertPanel || expertPanel.length === 0) {
            throw new Error('Expert panel is required');
        }

        // Validate expert panel structure
        for (const expert of expertPanel) {
            if (!expert.field || !expert.portfolio || expert.harshness === undefined) {
                throw new Error('Each expert must have field, portfolio, and harshness properties');
            }
            
            if (typeof expert.harshness !== 'number' || expert.harshness < 1 || expert.harshness > 10) {
                throw new Error('Expert harshness must be a number between 1 and 10');
            }
        }

        // Get ratings from all experts concurrently
        const expertRatings = await Promise.all(
            expertPanel.map(expert => this.getExpertRating(expert, chatRecord, sceneDescription, assessmentResult, llmConfig, includeSystemPrompt))
        );

        // Calculate weighted average score
        const finalScore = this.calculateWeightedAverage(expertRatings);

        return {
            scores: expertRatings.map(rating => rating.score),
            comments: expertRatings.map(rating => rating.comment),
            finalScore: finalScore
        };
    }

    /**
     * Get rating from a single expert
     * @param {Object} expert - Expert configuration
     * @param {Object} chatRecord - Chat record with systemPrompt and conversation
     * @param {string} sceneDescription - Description of the scene/context for the conversation
     * @param {Object} assessmentResult - Assessment results with identified mistakes
     * @param {Object} llmConfig - LLM configuration
     * @param {boolean} includeSystemPrompt - Whether to include the system prompt
     * @returns {Promise<Object>} - Expert rating with score and comment
     */
    async getExpertRating(expert, chatRecord, sceneDescription, assessmentResult, llmConfig, includeSystemPrompt) {
        const {
            field,
            portfolio,
            harshness
        } = expert;

        // Build expert rating prompt in Chinese
        const ratingPrompt = this.buildExpertRatingPrompt(expert, chatRecord, sceneDescription, assessmentResult, includeSystemPrompt);

        // Create API messages
        const apiMessages = [
            { role: 'system', content: ratingPrompt }
            // { role: 'user', content: JSON.stringify({ chatRecord, sceneDescription, assessmentResult, includeSystemPrompt }) }
        ];

        try {
            // Get rating from LLM
            const response = await this.getLLMResponse(apiMessages, llmConfig);
            const ratingResult = this.parseRatingResponse(response);
            
            return {
                expert: field,
                harshness: harshness,
                score: ratingResult.score,
                comment: ratingResult.comment
            };
        } catch (error) {
            console.error(`Expert rating error for ${field}:`, error);
            throw error;
        }
    }

    /**
     * Build expert rating prompt in Chinese
     * @param {Object} expert - Expert configuration
     * @param {Object} chatRecord - Chat record with systemPrompt and conversation
     * @param {string} sceneDescription - Description of the scene/context for the conversation
     * @param {Object} assessmentResult - Assessment results with identified mistakes
     * @param {boolean} includeSystemPrompt - Whether to include the system prompt
     * @returns {string} - Expert rating prompt
     */
    buildExpertRatingPrompt(expert, chatRecord, sceneDescription, assessmentResult, includeSystemPrompt) {
        const { field, portfolio, harshness } = expert;
        
        const harshnessDescription = this.getHarshnessDescription(harshness);
        
        // Format conversation for better readability
        const formattedConversation = chatRecord.conversation.map((msg, index) => {
            return `${index + 1}. [${msg.role === 'user' ? '销售' : '顾客'}]: ${msg.content}`;
        }).join('\n');
        
        // Format assessment results for inclusion in prompt
        let formattedAssessment = '未提供评估结果';
        if (assessmentResult) {
            const allIssues = [
                ...((assessmentResult.Inform || []).map(issue => `信息级: ${issue.name} - ${issue.explanation}`)),
                ...((assessmentResult.Warning || []).map(issue => `警告级: ${issue.name} - ${issue.explanation}`)),
                ...((assessmentResult.Error || []).map(issue => `错误级: ${issue.name} - ${issue.explanation}`)),
                ...((assessmentResult.Unlisted || []).map(issue => `未列出: ${issue.name} - ${issue.explanation}`))
            ];
            
            if (allIssues.length > 0) {
                formattedAssessment = allIssues.join('\n');
            } else {
                formattedAssessment = '评估未发现任何问题';
            }
        }
        
        return `# 专业评分评估系统

## 专家身份与专业背景
您是${field}领域的资深专业人士，在${portfolio}方面拥有深厚的专业知识和丰富经验。您的专业判断将为销售训练系统提供权威的质量评估。

## 评分任务与目标
您的核心任务是对所提供对话记录中的顾客表现进行专业、客观的评估，并给出0-10分的精确评分。您的评分将直接影响销售训练系统的改进方向和效果。

## 评估背景与上下文
### 场景描述
${sceneDescription || '未提供具体场景描述'}

### 系统角色设定
${includeSystemPrompt ? `系统提示内容：${chatRecord.systemPrompt || '未提供系统提示'}` : '未提供系统提示内容'}

### 评估参考信息
${formattedAssessment}

## 对话记录
${formattedConversation}

## 专业评估维度
请您从${field}的专业角度，对顾客表现进行严谨评估，重点关注以下核心维度：

1. **对话自然度与真实性**：顾客的回应是否自然流畅，是否符合真实顾客的表达习惯
2. **角色遵循度**：顾客是否严格按照系统提示中的角色设定进行回应
3. **回应恰当性**：顾客的回应是否与销售的问题和情境相匹配
4. **专业标准符合度**：顾客表现是否符合${field}领域的专业标准和期望

## 评分标准说明
您的评估标准${harshnessDescription}，请根据此标准进行客观评分：
- 0-3分：表现严重不足，需要大幅改进
- 4-6分：表现基本合格，但有明显改进空间
- 7-8分：表现良好，符合专业期望
- 9-10分：表现优秀，达到专业水准

## 输出格式要求
请严格按照以下JSON格式提交您的专业评分结果，确保格式正确且完整，只输出一个有效的JSON对象，不输出其他任何内容：

{
  "score": 7.0,
  "comment": "顾客在对话中表现自然，角色设定遵循度高，回应恰当，符合标准，但有改进空间。"
}

## 专业责任提醒
作为${field}领域的专业评估者，您的评分标准${harshnessDescription}，应当体现出专业水准和公正态度。您的评估将对销售训练系统的优化产生重要影响，请确保您的判断既专业又客观。`;
    }

    /**
     * Get description for harshness level
     * @param {number} harshness - Harshness level (1-10)
     * @returns {string} - Description of harshness
     */
    getHarshnessDescription(harshness) {
        if (harshness <= 3) {
            return "宽松，倾向于给出中高分";
        } else if (harshness <= 6) {
            return "适中，既不宽松也不严格，给分偏低";
        } else {
            return "非常严格，倾向于给出低分";
        }
    }


    /**
     * Parse rating response from LLM
     * @param {string} response - LLM response
     * @returns {Object} - Parsed rating result
     */
    parseRatingResponse(response) {
        try {
            // Try to parse JSON response
            const result = JSON.parse(response);
            
            // Validate and normalize score
            let score = parseFloat(result.score) || 0;
            score = Math.max(0, Math.min(10, score)); // Clamp between 0 and 10
            
            return {
                score: score,
                comment: result.comment || 'No comment provided'
            };
        } catch (error) {
            console.error('Failed to parse rating response:', error);
            
            // Return default rating if parsing fails
            return {
                score: 5.0,
                comment: 'Unable to parse rating response'
            };
        }
    }

    /**
     * Calculate weighted average score based on expert harshness
     * @param {Array} expertRatings - Array of expert ratings
     * @returns {number} - Weighted average score
     */
    calculateWeightedAverage(expertRatings) {
        if (expertRatings.length === 0) return 0;

        let totalWeightedScore = 0;
        let totalWeight = 0;

        for (const rating of expertRatings) {
            const weight = rating.harshness; 
            totalWeightedScore += rating.score * weight;
            totalWeight += weight;
        }

        return totalWeight > 0 ? totalWeightedScore / totalWeight : 0;
    }

    /**
     * Get default expert panel
     * @returns {Array} - Default expert panel
     */
    getDefaultExpertPanel() {
        return [
            {
                field: "奇怪的米",
                portfolio: "セシウムさん",
                harshness: 9
            },
            {
                field: "被污染的米",
                portfolio: "セシウムさん",
                harshness: 9
            }
        ];
    }
}