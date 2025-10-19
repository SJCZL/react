import { ApiService } from './apiService.js';
import { DEFAULT_INITIAL_RESPONSE, DEFAULT_RESPONSE_PROMPT } from '../config/constants.js';

export class ChatService {
    constructor(apiKey, modelName, modelConfig) {
        // Ensure ApiService is initialized with the correct provider and modelConfig
        this.modelConfig = modelConfig;
        this.apiService = new ApiService(
            apiKey,
            modelConfig?.currentProvider,
            modelConfig
        );
        this.conversation = [];
        this.systemPrompt = '';
        this.isGenerating = false;
    }

    setSystemPrompt(prompt) {
        this.systemPrompt = prompt;
    }

    getSystemPrompt() {
        return this.systemPrompt;
    }

    setConversation(conversation) {
        this.conversation = conversation;
    }

    getConversation() {
        return this.conversation;
    }

    addMessage(role, content) {
        const message = {
            id: Date.now() + Math.random(),
            role,
            content,
            timestamp: new Date().toISOString()
        };
        this.conversation.push(message);
        return message;
    }

    deleteMessage(messageId) {
        this.conversation = this.conversation.filter(msg => msg.id !== messageId);
    }

    updateModelConfig(modelConfig) {
        this.modelConfig = modelConfig;
        this.apiService.updateModelConfig(modelConfig);
        this.apiService.updateApiKey(modelConfig.getApiKeyForProvider(modelConfig.currentProvider));
    }

    async fetchBotResponse(conversation, temperature, topP, onChunk, onFirstChunk, signal) {
        this.isGenerating = true;

        try {
            const messages = [
                { role: 'system', content: this.systemPrompt },
                ...conversation.filter(msg => msg.role !== 'system')
            ];

            const response = await this.apiService.sendMessage(messages, this.modelConfig?.currentModel, {
                temperature,
                top_p: topP,
                stream: true,
                signal
            });

            if (!response.success) {
                throw new Error(response.error || 'API请求失败');
            }

            // 处理流式响应
            const reader = response.data.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            let firstChunk = true;

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop();

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = line.slice(6);
                        if (data === '[DONE]') continue;

                        try {
                            const parsed = JSON.parse(data);
                            const content = parsed.choices[0]?.delta?.content || '';

                            if (firstChunk && onFirstChunk) {
                                onFirstChunk();
                                firstChunk = false;
                            }

                            if (onChunk) {
                                onChunk(content);
                            }
                        } catch (e) {
                            console.error('解析流式数据失败:', e);
                        }
                    }
                }
            }
        } catch (error) {
            if (error.name !== 'AbortError') {
                console.error('获取机器人响应失败:', error);
                throw error;
            }
        } finally {
            this.isGenerating = false;
        }
    }

    haltGeneration() {
        this.isGenerating = false;
    }

    repairConversationStructure() {
        // 修复对话结构，确保user和assistant消息交替出现
        const repaired = [];
        let lastRole = null;

        for (const message of this.conversation) {
            if (message.role !== lastRole || message.role === 'system') {
                repaired.push(message);
                lastRole = message.role;
            } else {
                // 如果两个相同角色的消息相邻，跳过第二个
                console.warn('跳过重复角色消息:', message);
            }
        }

        this.conversation = repaired;
    }
}