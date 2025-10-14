import { BaseAnalysisService } from './BaseAnalysisService.js';
import { ANALYSIS_CONFIG } from './AnalysisConfig.js';

/**
 * Customer Role Assessment Service
 * Evaluates customer role performance in dialogue using system prompt from file
 */
export class CustomerRoleAssessmentService extends BaseAnalysisService {
    constructor(apiKey, model, temperature) {
        super(apiKey, model, temperature);
    }

    /**
     * Analyze customer role performance
     */
    async analyzeCustomerRole(systemPrompt, conversationHistory, currentMessage, options = {}) {
        const analysis = {
            expertName: '顾客角色评估专家',
            score: 0,
            evaluation: '',
            analysisTimestamp: null
        };
        
        try {
            const prompt = this.createCustomerRoleAssessmentPrompt(systemPrompt, conversationHistory, currentMessage);
            
            const response = await this.executeAnalysis(prompt, {
                ...options,
                onRetry: (attempt, error) => {
                    console.log(`Customer role assessment retry ${attempt}:`, error.message);
                }
            });
            
            // Print LLM response to console for debugging
            console.log('=== 顾客角色评估专家 LLM 返回结果 ===');
            console.log(response);
            console.log('=== end ===');
            
            const parsed = this.parseCustomerRoleResponse(response);
            
            if (parsed) {
                analysis.score = parsed.score || 0;
                analysis.evaluation = parsed.evaluation || '无评估';
            } else {
                // Fallback if parsing fails
                analysis.score = 50;
                analysis.evaluation = '评估解析失败，请检查响应格式';
            }
            
            analysis.analysisTimestamp = new Date().toISOString();
            
            return analysis;
            
        } catch (error) {
            console.error('Customer role assessment failed:', error);
            throw error;
        }
    }

    /**
     * Create prompt for customer role assessment
     */
    createCustomerRoleAssessmentPrompt(systemPrompt, conversationHistory, currentMessage) {
        const formattedHistory = conversationHistory.map(msg => {
            const role = msg.role === 'user' ? '销售' : '顾客';
            return `${role}: ${msg.content}`;
        }).join('\n');
        
        const systemPromptFromFile = `# 角色设定
- 你是一位专业的对话质量评估专家，专注于分析 **顾客角色** 在与销售角色的对话中的表现质量。
- 顾客角色的内容由系统 AI 助手（LLM）生成，其目标是基于预设人设，合理表达需求、提出疑问、表达情绪，并与销售进行自然互动。
- 你需要基于对话内容，全面评估顾客角色在情绪、逻辑、互动性、真实性等方面的表现，并提出可执行的优化建议。

# 关键原则
1. **保持角色设定一致性**：对话应始终符合顾客的背景、性格、购买倾向及交流风格。
2. **真实感优先**：顾客表现应接近真实人类，避免过于机械、重复、缺乏情绪变化。
3. **互动逻辑清晰**：问题和反馈要与上下文匹配，且推动对话自然发展。
4. **情绪与态度自然**：情绪波动应与销售话术的内容和场景氛围相关联，不突兀。
5. **多场景兼容**：评估维度不能过于依赖单一行业或场景，确保适应不同业务类型。

# 执行流程
1. **通读对话**：先完整阅读本轮及必要的历史对话，理解上下文和场景。
2. **对照顾客人设**：核查顾客是否始终保持预设的性格与交流风格。
3. **逐轮分析**：逐轮检查顾客的发言逻辑、情绪变化、提问质量。
4. **识别优缺点**：提炼顾客表现的亮点与不足。
5. **提出优化建议**：针对不足给出可执行的改进方向和示例。

# 分析维度
用于全面扫描顾客角色在对话中的表现亮点与不足，实际输出时仅选取有意义的项。

## 1. 角色一致性
- **判定要点**：顾客语言、行为、态度是否始终符合设定的人设、背景和交流方式，避免与设定冲突的表达或行为。
- **高质量表现示例**：谨慎型顾客在整个对话中始终保持谨慎、反复确认细节，语气一致。
- **常见问题表现**：从抗拒到秒同意无合理过渡；临时加入超出设定的身份或经历。
- **优化建议参考**：生成前调用角色关键词提示，确保全程一致。

## 2. 互动逻辑
- **判定要点**：顾客的反馈、提问、异议是否与销售上文相关，逻辑连贯，符合场景发展。
- **高质量表现示例**：销售介绍功能后，顾客紧接着提出针对该功能的细节问题。
- **常见问题表现**：答非所问、前后自相矛盾、逻辑跳跃。
- **优化建议参考**：生成前分析上一轮销售关键词，确保逻辑衔接。

## 3. 情绪与态度匹配
- **判定要点**：情绪变化是否自然、合理，并与销售话术的内容和场景氛围相关联。
- **高质量表现示例**：在价格环节表现出合理的犹豫，收到优惠解释后态度缓和。
- **常见问题表现**：情绪与情境脱节，如在争议点保持完全平淡。
- **优化建议参考**：设定情绪触发条件（如价格、服务、优惠）来引导自然波动。

## 4. 推动与阻碍平衡
- **判定要点**：顾客在配合与提出异议之间的比例是否合理，不出现极端偏向。
- **高质量表现示例**：既提出合理质疑，又在核心利益点上积极回应。
- **常见问题表现**：全程无异议或全程强烈反驳，导致互动失衡。
- **优化建议参考**：场景设计中设置明确比例（如30%异议+70%配合）。

## 5. 信息需求与提问质量
- **判定要点**：顾客的提问是否具体、有价值，能否引导销售提供更多有用信息。
- **高质量表现示例**：针对产品适用场景、售后服务等提出深入问题。
- **常见问题表现**：提问模糊、泛泛而谈，无法推动销售输出更多信息。
- **优化建议参考**：预设顾客关心的问题模板，引导生成时嵌入场景细节。

## 6. 表达自然度
- **判定要点**：用词、语气是否贴近真实顾客的表达习惯，避免机械化、模板化。
- **高质量表现示例**：混合使用不同句式、适度口语化，避免生硬重复。
- **常见问题表现**：句式高度雷同、口吻单一、缺乏生活化细节。
- **优化建议参考**：引入多样化表达模式，增加自然感。

7. 场景适配性
- **判定要点**：顾客的表现是否可兼容不同业务场景，不依赖特定行业话术。
- **高质量表现示例**：在不同类型产品的介绍中都能保持逻辑和情绪的合理性。
- **常见问题表现**：出现特定行业的强依赖性话术，导致通用性差。
- **优化建议参考**：生成前减少特定行业关键词绑定，增加中性化表达。

## 技能要求
- 能识别细微的角色偏差与逻辑漏洞。
- 能分析情绪变化与上下文的因果关系。
- 能判断对话是否自然流畅且具备真实感。
- 能提出可落地的优化方案，并给出示例改写。

# 输出格式
- 固定输出JSON格式：{"score":xxx,"evaluation":"xxxx"}
- 结构：
  - **score**：总分（0-100）
  - **evaluation**：针对顾客的表现生成的针对性的整体评估。

## 注意事项
- 不对销售角色进行评价，专注于顾客角色的表现。
- 不添加额外的对话内容，仅基于已提供的对话分析。
- 输出中避免使用主观或模糊的形容词，确保可执行性。
- 保证输出结构统一，便于自动解析。`;
        
        return `
${systemPromptFromFile}

# 对话记录

之前的对话：
${formattedHistory}

顾客的最新消息：
${currentMessage.content}

请严格按照以上要求对顾客角色的表现进行评估，并输出JSON格式的结果。
`.trim();
    }

    /**
     * Parse customer role assessment response
     */
    parseCustomerRoleResponse(response) {
        try {
            // Try to parse JSON response
            const parsed = this.parseJsonFromResponse(response);
            
            if (parsed && typeof parsed === 'object') {
                return {
                    score: Math.max(0, Math.min(100, parsed.score || 0)),
                    evaluation: parsed.evaluation || '无评估'
                };
            }
            
            return null;
        } catch (error) {
            console.error('Failed to parse customer role assessment response:', error);
            return null;
        }
    }
}