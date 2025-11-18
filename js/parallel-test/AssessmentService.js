import { BaseService } from './BaseService.js';
import { modelConfig } from '../config/ModelConfig.js';

/**
 * Assessment Service for dialogue linting and assessment
 * Focuses on testing how the assistant LLM (The Customer) behaves under the Chat System Prompt
 */
export class AssessmentService extends BaseService {
    constructor(apiKey = null, modelName = null) {
        super(apiKey, modelName);
        this._abortController = null;
    }

    /**
     * Start an assessment session
     * @param {Object} config - Assessment configuration
     * @param {Object} config.llmConfig - LLM configuration object (temp,  etc.)
     * @param {Object} config.chatRecord - Full Main Chat Tab compatible chat record with systemPrompt and conversation
     * @param {string} config.sceneDescription - Description of the scene/context for the conversation
     * @param {Object} config.mistakeLibrary - Dictionary of predefined mistakes the assistant LLM might make
     * @param {boolean} config.emitUnlistedIssues - Whether to emit unlisted issues
     * @returns {Promise<Object>} - Assessment results with 4 parts: Inform, Warning, Error, Unlisted
     */
    async startAssessment(config) {
        const {
            llmConfig = {},
            chatRecord = {},
            sceneDescription = '',
            mistakeLibrary = {},
            emitUnlistedIssues = true
        } = config;

        // Validate required parameters
        if (!chatRecord || !chatRecord.conversation || chatRecord.conversation.length === 0) {
            throw new Error('Chat record with conversation is required');
        }

        // Validate mistake library structure
        if (mistakeLibrary && typeof mistakeLibrary !== 'object') {
            throw new Error('Mistake library must be an object');
        }

        // Prepare assessment prompt in Chinese
        const assessmentPrompt = this.buildAssessmentPrompt(chatRecord, sceneDescription, mistakeLibrary);

        // Create API messages
        const apiMessages = [
            { role: 'system', content: assessmentPrompt },
            { role: 'user', content: JSON.stringify({ chatRecord, sceneDescription, mistakeLibrary }) }
        ];

        try {
            // Create/refresh abort controller for this run
            this._abortController = new AbortController();
            // Get assessment from LLM
            const response = await this.getLLMResponse(apiMessages, llmConfig, this._abortController.signal);
            const assessmentResult = this.parseAssessmentResponse(response, mistakeLibrary, emitUnlistedIssues);
            
            return assessmentResult;
        } catch (error) {
            console.error('Assessment error:', error);
            throw error;
        } finally {
            this._abortController = null;
        }
    }

    /**
     * Build assessment prompt in Chinese
     * @param {Object} chatRecord - Chat record with systemPrompt and conversation
     * @param {string} sceneDescription - Description of the scene/context for the conversation
     * @param {Object} mistakeLibrary - Dictionary of predefined mistakes
     * @returns {string} - Assessment prompt
     */
    buildAssessmentPrompt(chatRecord, sceneDescription, mistakeLibrary) {
        // Format conversation for better readability
        const formattedConversation = chatRecord.conversation.map((msg, index) => {
            return `${index + 1}. [${msg.role === 'user' ? '销售' : '顾客'}]: ${msg.content}`;
        }).join('\n');

        // Format mistake library for inclusion in prompt
        const formattedMistakeLibrary = mistakeLibrary ? Object.entries(mistakeLibrary)
            .map(([name, mistake]) => `${mistake.name} (${mistake.severity}): ${mistake.description}`)
            .join('\n') : '未提供错误库';

        return `# 专业对话评估系统

## 角色定位与专业身份
您是一位专业的对话评估专家，专门负责评估大语言模型扮演的顾客在销售训练对话中的表现。您的专业判断将直接影响销售训练的质量和效果。

## 核心任务与评估目标
您的核心任务是对提供的对话记录进行系统性、专业性的评估，精准识别模型扮演的顾客可能存在的各类问题。评估结果将用于改进销售训练系统，提升销售人员的实战能力。

## 评估背景与上下文
### 场景描述
${sceneDescription || '未提供具体场景描述'}

### 系统角色设定
系统提示明确定义了顾客应当扮演的角色：
${chatRecord.systemPrompt || '未提供系统提示'}

## 评估标准与错误分类
错误库包含四类严重性等级的问题，请严格按照此标准进行评估：

- **Inform（信息级）**：轻微问题，不大影响整体体验质量，但值得注意。
- **Warning（警告级）**：中度问题，可能对体验产生负面影响，需要优先处理。
- **Error（错误级）**：严重问题，完全破坏用户体验，只有在警告级别不足以覆盖时才使用，请极其谨慎。
- **Unlisted（未列出）**：错误库中未包含的问题，用于识别顾客不遵循系统提示词的其他行为。

## 专业评估原则
请严格遵循以下专业评估原则：

1. **标准一致性**：判定错误时，请严格依照错误库中的阐述作为判断标准。
2. **细致分析**：必须仔细阅读问题描述，避免出现错判或漏判。
3. **边界明确**：对于容易混淆的问题，必须在明确问题之间的边界后再做出决断。
4. **范例参考**：必须仔细观察提供的错误范例，确保判断准确。
5. **合理判断**：不得钻牛角尖，保持专业、客观的评估态度。

## 错误库参考
${formattedMistakeLibrary}

## 对话记录
${formattedConversation}

## 输出要求
对于每个识别出的问题，请您提供以下详细信息：
- **错误ID**（若存在于错误库中）
- **错误名称**
- **错误位置**（消息ID及对应文本内容）
- **专业解释**（简洁、准确的问题说明）

请严格按照以下JSON格式提交您的专业评估结果，确保格式正确且完整，只输出一个有效的JSON对象，不输出其他任何内容：

{
  "Inform": [
    {
      "id": 1,
      "name": "（问题名称）",
      "where": {
        "messageId": （消息ID）,
        "text": "（和对话中逐字相同的出现错误的文本）"
      },
      "explanation": "（解释）"
    }
  ],
  "Warning": [
    {
      "id": 2,
      "name": "（问题名称）",
      "where": {
        "messageId": （消息ID）,
        "text": "（和对话中逐字相同的出现错误的文本）"
      },
      "explanation": "（解释）"
    }
  ],
  "Error": [
    {
      "id": 3,
      "name": "（问题名称）",
      "where": {
        "messageId": （消息ID）,
        "text": "（和对话中逐字相同的出现错误的文本）"
      },
      "explanation": "（解释）"
    }
  ],
  "Unlisted": [
    {
      "name": "（未列出的问题名称）",
      "where": {
        "messageId": （消息ID）,
        "text": "（和对话中逐字相同的出现问题的文本）"
      },
      "explanation": "（解释）"
    }
  ]
}

## 专业提醒
作为专业评估专家，您的评估将直接影响销售训练的质量。请确保您的判断既专业又公正，为销售训练系统提供有价值的改进建议。`;
    }


    /**
     * Parse assessment response from LLM
     * @param {string} response - LLM response
     * @param {Object} mistakeLibrary - Dictionary of predefined mistakes
     * @param {boolean} emitUnlistedIssues - Whether to include unlisted issues
     * @returns {Object} - Parsed assessment results
     */
    parseAssessmentResponse(response, mistakeLibrary, emitUnlistedIssues) {
        try {
            // Try to parse JSON response
            const result = JSON.parse(response);
            
            // Ensure the result has the required structure
            const assessmentResult = {
                Inform: result.Inform || [],
                Warning: result.Warning || [],
                Error: result.Error || [],
                Unlisted: emitUnlistedIssues ? (result.Unlisted || []) : []
            };

            // Validate and enrich each mistake detail
            for (const severity in assessmentResult) {
                if (severity === 'Unlisted') continue;
                
                assessmentResult[severity] = assessmentResult[severity].map(mistake => {
                    // Find the corresponding mistake in the library by name
                    let libraryMistake = null;
                    if (mistake.name) {
                        libraryMistake = Object.values(mistakeLibrary).find(m => m.name === mistake.name);
                    }
                    
                    return {
                        name: mistake.name || 'Unknown',
                        where: mistake.where || { messageId: null, text: '' },
                        explanation: mistake.explanation || (libraryMistake ? libraryMistake.description : 'No explanation provided')
                    };
                });
            }

            return assessmentResult;
        } catch (error) {
            console.error('Failed to parse assessment response:', error);
            
            // Return empty structure if parsing fails
            return {
                Inform: [],
                Warning: [],
                Error: [],
                Unlisted: []
            };
        }
    }
}

// Add abort capability to cancel in-flight assessment requests
AssessmentService.prototype.abort = function() {
    if (this._abortController) {
        try { this._abortController.abort(); } catch (_) {}
    }
};
