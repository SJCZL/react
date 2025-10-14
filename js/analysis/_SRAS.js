import { BaseAnalysisService } from './BaseAnalysisService.js';
import { ANALYSIS_CONFIG } from './AnalysisConfig.js';

/**
 * Sales Role Assessment Service
 * Evaluates sales role performance in dialogue using system prompt from file
 */
export class SalesRoleAssessmentService extends BaseAnalysisService {
    constructor(apiKey, model, temperature) {
        super(apiKey, model, temperature);
    }

    /**
     * Analyze sales role performance
     */
    async analyzeSalesRole(systemPrompt, conversationHistory, currentMessage, options = {}) {
        const analysis = {
            expertName: '销售角色评估专家',
            score: 0,
            evaluation: '',
            analysisTimestamp: null
        };
        
        try {
            const prompt = this.createSalesRoleAssessmentPrompt(systemPrompt, conversationHistory, currentMessage);
            
            const response = await this.executeAnalysis(prompt, {
                ...options,
                onRetry: (attempt, error) => {
                    console.log(`Sales role assessment retry ${attempt}:`, error.message);
                }
            });
            
            // Print LLM response to console for debugging
            console.log('=== 销售角色评估专家 LLM 返回结果 ===');
            console.log(response);
            console.log('=== end ===');
            
            const parsed = this.parseSalesRoleResponse(response);
            
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
            console.error('Sales role assessment failed:', error);
            throw error;
        }
    }

    /**
     * Create prompt for sales role assessment
     */
    createSalesRoleAssessmentPrompt(systemPrompt, conversationHistory, currentMessage) {
        const formattedHistory = conversationHistory.map(msg => {
            const role = msg.role === 'user' ? '销售' : '顾客';
            return `${role}: ${msg.content}`;
        }).join('\n');
        
        const systemPromptFromFile = `# 角色
- 你是一位专业的对话质量评估专家，适用于任何行业、任何类型的销售对话，专注于分析 **销售角色** 在与顾客角色的对话中的表现质量。
- 你的任务是基于对话中**实际出现的内容**，综合评估销售的整体表现，提炼出优点、缺点和优化建议，并给出一个总分。

# 评估目标
- 从完整对话中识别销售的积极表现与不足之处。
- 针对不足提出可落地的优化建议。
- 给出一个反映整体表现的总分（0~100分）。
- 输出结果简明直观，但覆盖核心表现要素。

# 核心评估原则
1. **事实优先**：所有结论必须有销售实际话术作为依据，禁止凭空推测或基于顾客话语推断销售行为。
2. **缺失不强补**：未出现的行为不评价、不补分。
3. **结论与评分一致**：指出的问题必须在评分中有所体现。
4. **建议可执行**：优化建议必须针对缺点，并给出可落地的改进方法或话术。
5. **禁止价格折扣信息**：优惠只能以增值服务形式呈现。
6. **中立且建设性**：用专业、客观的表达，避免夸大或贬低。

# 执行流程
1. 阅读完整对话内容。
2. 按扫描要素识别销售的亮点与不足（跳过未出现的要素）。
3. 提炼整体优点、缺点和优化建议，生成综合性的评估结果。
4. 结合表现打出总分（0~100分）。
5. 按固定格式输出最终结果。

# 综合表现扫描要素
- 用于帮助全面扫描销售在对话中的潜在亮点与不足，实际输出仅基于出现的内容提炼优缺点，不强制涵盖全部要素。

1. **建立联系与吸引开场**  
   - 核心：是否主动问候、介绍身份与目的，并快速引起兴趣。  
   - 优质特征：开场自然流畅，既表明来意，又抛出吸引点（专属、便利、价值承诺等）。

2. **关系与信任构建**  
   - 核心：是否通过背景介绍、共鸣话题或专业形象提升信任度。  
   - 优质特征：展示相关经验、提及成功案例、表达对顾客需求的理解与关注。

3. **需求探索与确认**  
   - 核心：是否主动引导顾客表达需求，并对关键信息进行复述或确认。  
   - 优质特征：使用开放式问题挖掘需求，复述顾客表述确保理解无误。

4. **信息传递与价值呈现**  
   - 核心：是否准确传递产品/服务关键信息（功能、条件、优势等），并从顾客视角突出价值（效率、成本、体验、收益等）。  
   - 优质特征：条理清晰，重点契合顾客关注，用案例、数据或类比支撑。

5. **异议回应与问题解决**  
   - 核心：是否积极回应顾客疑虑，并提供合理解释、权威证明或替代方案。  
   - 优质特征：认可顾客关切，补充事实/案例，回应专业且有耐心。

6. **推进与收尾**  
   - 核心：是否在恰当时机推动下一步（确认、试用、预约等）并正向收尾。  
   - 优质特征：顺势结合顾客反馈推进，结束时确认后续联系或合作机会。

# 输出格式
- 固定输出JSON格式：{"score":xxx,"evaluation":"xxxx"}
- 结构：
  - **score**：总分（0-100）
  - **evaluation**：针对销售的表现生成的针对性的整体评估。

## 注意事项
- 不逐句复述原话，使用简洁概括的分析。
- 优缺点必须与事实对应，优化建议必须可操作。
- 参考话术不得与销售原话重复，且不得包含价格折扣信息。`;
        
        return `
${systemPromptFromFile}

# 对话记录
之前的对话：
${formattedHistory}

销售的最新消息：
${currentMessage.content}

请严格按照以上要求对销售角色的表现进行评估，并输出JSON格式的结果。
`.trim();
    }

    /**
     * Parse sales role assessment response
     */
    parseSalesRoleResponse(response) {
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
            console.error('Failed to parse sales role assessment response:', error);
            return null;
        }
    }
}