import { DEFAULT_SYSTEM_PROMPT } from './config.js';
import { ApiService } from './api.js';

export class ChatService {
    constructor(apiKey, modelName = null, modelConfig = null) {
        this.conversation = [];
        // 如果默认系统提示词为空，则设置为空字符串，由待测试prompt配置提供
        this.systemPrompt = DEFAULT_SYSTEM_PROMPT || '';
        this.apiService = new ApiService(apiKey, modelName, modelConfig);
        this.currentAbortController = null;
        this.modelConfig = modelConfig; // 保存模型配置引用
    }

    /**
     * 更新模型配置
     */
    updateModelConfig(modelConfig) {
        this.modelConfig = modelConfig;
        if (this.apiService) {
            this.apiService.updateConfig(modelConfig);
        }
    }

    /**
     * 获取当前模型信息
     */
    getCurrentModel() {
        if (this.modelConfig) {
            return this.modelConfig.getCurrentModel();
        }
        return null;
    }

    /**
     * 获取当前提供商信息
     */
    getCurrentProvider() {
        if (this.modelConfig) {
            return this.modelConfig.getCurrentProvider();
        }
        return null;
    }

    updateModelName(modelName) {
        if (this.apiService) {
            this.apiService.modelName = modelName;
        }
        // 同时更新模型配置
        if (this.modelConfig) {
            this.modelConfig.switchModel(modelName);
        }
    }

    getConversation() {
        return this.conversation;
    }

    setConversation(conversation) {
        this.conversation = conversation;
    }

    getSystemPrompt() {
        return this.systemPrompt;
    }

    setSystemPrompt(prompt) {
        this.systemPrompt = prompt;
    }

    addMessage(role, content, reasoningContent = null) {
        // Generate high-precision timestamp ID with milliseconds
        const now = new Date();
        const baseTimestamp = Math.floor(now.getTime() / 1000) * 1000; // seconds part
        const milliseconds = now.getMilliseconds();
        const id = baseTimestamp + milliseconds; // Full millisecond precision
        this.conversation.push({ id, role, content, reasoningContent });
    }

    deleteMessage(messageId) {
        console.log(`[ChatService] Starting deleteMessage for ID: ${messageId}`);
        console.log(`[ChatService] Conversation before deletion:`, this.conversation.map(m => ({ id: m.id, role: m.role, content: m.content.substring(0, 30) + '...' })));
        
        const messageIndex = this.conversation.findIndex(msg => msg.id === messageId);
        if (messageIndex === -1) {
            console.log(`[ChatService] Message with ID ${messageId} not found`);
            return;
        }

        const deletedMessage = this.conversation[messageIndex];
        console.log(`[ChatService] Found message to delete:`, { id: deletedMessage.id, role: deletedMessage.role, index: messageIndex });

        // Always remove the message from conversation first
        this.conversation.splice(messageIndex, 1);
        console.log(`[ChatService] Removed message from conversation array`);
        
        // Find and remove associated DOM elements
        const messageElement = document.querySelector(`.message[data-id='${messageId}']`);
        if (messageElement) {
            console.log(`[ChatService] Removing DOM element for message ${messageId}`);
            messageElement.remove();
        }

        // Clean up the conversation structure to maintain proper user-assistant pairing
        this.repairConversationStructure();
        
        // Clean up empty message pairs
        this.cleanupEmptyMessagePairs();

        console.log(`[ChatService] Conversation after deletion:`, this.conversation.map(m => ({ id: m.id, role: m.role, content: m.content.substring(0, 30) + '...' })));
        console.log(`[ChatService] Delete operation completed`);
    }

    /**
     * Clean up empty message pairs after deletion
     */
    cleanupEmptyMessagePairs() {
        const emptyPairs = document.querySelectorAll('.message-pair:empty');
        console.log(`[ChatService] Cleaning up ${emptyPairs.length} empty message pairs`);
        emptyPairs.forEach(pair => pair.remove());
    }

    /**
     * Repair conversation structure to maintain proper user-assistant pairing
     */
    repairConversationStructure() {
        console.log(`[ChatService] Repairing conversation structure`);
        
        // Group messages by user-assistant pairs
        const repairedMessages = [];
        let i = 0;
        
        while (i < this.conversation.length) {
            const currentMsg = this.conversation[i];
            
            if (currentMsg.role === 'user') {
                // Add user message
                repairedMessages.push(currentMsg);
                
                // Check if next message is assistant
                if (i + 1 < this.conversation.length && this.conversation[i + 1].role === 'assistant') {
                    repairedMessages.push(this.conversation[i + 1]);
                    i += 2;
                } else {
                    i += 1;
                }
            } else if (currentMsg.role === 'assistant') {
                // Found orphaned assistant message (no preceding user message)
                // Remove it from the structure
                console.log(`[ChatService] Removing orphaned assistant message at index ${i}`);
                
                // Also remove its DOM element if it exists
                const assistantElement = document.querySelector(`.message[data-id='${currentMsg.id}']`);
                if (assistantElement) {
                    assistantElement.remove();
                }
                
                i += 1;
            } else {
                // Other message types (system, etc.) - keep them
                repairedMessages.push(currentMsg);
                i += 1;
            }
        }
        
        this.conversation = repairedMessages;
        console.log(`[ChatService] Conversation structure repaired. New length: ${this.conversation.length}`);
    }

    async fetchBotResponse(history, temperature, topP, onChunk, onFirstChunk, signal) {
        console.log('[ChatService] Starting fetchBotResponse');
        console.log('[ChatService] History length:', history.length);
        console.log('[ChatService] Temperature:', temperature);
        console.log('[ChatService] Top P:', topP);
        
        if (window.debug) {
            window.debug.set('INFO', 'Generation', 'Starting');
            window.debug.set('INFO', 'History Length', history.length);
            window.debug.set('INFO', 'Temperature', temperature);
            window.debug.set('INFO', 'Top P', topP);
        }
        
        // 检查是否有消息
        if (history.length === 0) {
            const errorMsg = '对话中没有消息，无法获取响应';
            console.error('[ChatService]', errorMsg);
            if (window.debug) {
                window.debug.set('ERROR', 'Conversation', 'No messages');
            }
            throw new Error(errorMsg);
        }
        
        // 检查是否有系统提示
        if (!this.systemPrompt) {
            console.warn('[ChatService] No system prompt set, using default');
            if (window.debug) {
                window.debug.set('WARN', 'System Prompt', 'Using default');
            }
            this.systemPrompt = "You are a helpful assistant.";
        }
        
        this.currentAbortController = new AbortController();
        const combinedSignal = this.getCombinedSignal(signal);

        const apiMessages = [{ role: 'system', content: this.systemPrompt }, ...history]
            .map(({ role, content }) => ({ role, content }));

        const botMessage = history[history.length - 1];
        if (!botMessage || botMessage.role !== 'assistant') {
            const errorMsg = "ChatService.fetchBotResponse expects the last message in history to be an empty assistant message.";
            console.error('[ChatService]', errorMsg);
            if (window.debug) {
                window.debug.set('ERROR', 'Message Format', errorMsg);
            }
            return;
        }
        
        let totalTokens = 0;
        let chunkCount = 0;
        const startTime = Date.now();

        try {
            console.log('[ChatService] Calling API service');
            if (window.debug) {
                window.debug.set('INFO', 'API', 'Calling streamLLMResponse');
            }
            
            const reader = await this.apiService.streamLLMResponse(apiMessages, temperature, topP, combinedSignal);
            const decoder = new TextDecoder();
            let firstChunk = true;

            while (true) {
                if (combinedSignal.aborted) {
                    console.log('[ChatService] Generation aborted');
                    if (window.debug) {
                        window.debug.set('INFO', 'Generation', 'Aborted by signal');
                    }
                    throw new Error("Aborted");
                }
                
                const { value, done } = await reader.read();
                if (done) break;

                if (firstChunk) {
                    console.log('[ChatService] First chunk received');
                    onFirstChunk();
                    firstChunk = false;
                    if (window.debug) {
                        window.debug.set('INFO', 'Stream', 'First chunk received');
                    }
                }

                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split('\n\n');
                chunkCount++;

                for (const line of lines) {
                    if (line.startsWith('data:')) {
                        const dataStr = line.substring(5).trim();
                        if (dataStr === '[DONE]') {
                            console.log('[ChatService] Stream completed');
                            if (window.debug) {
                                window.debug.set('INFO', 'Stream', 'Completed');
                            }
                            return;
                        }
                        
                        try {
                            const parsed = JSON.parse(dataStr);
                            const content = parsed.choices[0]?.delta?.content;
                            const reasoningContent = parsed.choices[0]?.delta?.reasoning_content;
                            
                            if (content) {
                                botMessage.content += content;
                                // 估算token数量（简单估算：1 token ≈ 4 characters）
                                totalTokens += Math.ceil(content.length / 4);
                            }
                            if (reasoningContent) {
                                if (!botMessage.reasoningContent) {
                                    botMessage.reasoningContent = '';
                                }
                                botMessage.reasoningContent += reasoningContent;
                                totalTokens += Math.ceil(reasoningContent.length / 4);
                            }
                            
                            if (content || reasoningContent) {
                                onChunk(botMessage.content, botMessage.reasoningContent);
                                
                                // 每10个chunk更新一次调试信息
                                if (window.debug && chunkCount % 10 === 0) {
                                    window.debug.set('INFO', 'Tokens', totalTokens);
                                    window.debug.set('INFO', 'Chunks', chunkCount);
                                }
                            }
                        } catch (e) {
                            console.warn('[ChatService] Failed to parse SSE data:', dataStr, e);
                            if (window.debug) {
                                window.debug.set('WARN', 'SSE Parse', e.message);
                            }
                        }
                    }
                }
            }
            
            const generationTime = Date.now() - startTime;
            console.log('[ChatService] Generation completed');
            console.log('[ChatService] Total tokens:', totalTokens);
            console.log('[ChatService] Total chunks:', chunkCount);
            console.log('[ChatService] Generation time:', generationTime, 'ms');
            
            if (window.debug) {
                window.debug.set('INFO', 'Generation', 'Completed');
                window.debug.set('INFO', 'Tokens', totalTokens);
                window.debug.set('INFO', 'Chunks', chunkCount);
                window.debug.set('INFO', 'Gen Time', `${generationTime}ms`);
            }
        } catch (error) {
            console.error('[ChatService] Error during generation:', error);
            
            if (window.debug) {
                window.debug.set('ERROR', 'Generation', error.message);
            }
            
            if (error.name === 'AbortError') {
                botMessage.content = botMessage.content || '[Generation stopped]';
                if (window.debug) {
                    window.debug.set('INFO', 'Generation', 'Stopped by user');
                }
            } else {
                botMessage.content = `Error: ${error.message}`;
                if (window.debug) {
                    window.debug.set('ERROR', 'API Error', error.message);
                }
            }
            onChunk(botMessage.content); // Update UI with final state
        } finally {
            this.currentAbortController = null;
            console.log('[ChatService] Cleanup completed');
        }
    }

    getCombinedSignal(externalSignal) {
        const abortController = new AbortController();
        const internalSignal = this.currentAbortController.signal;

        const onAbort = () => {
            abortController.abort();
            externalSignal?.removeEventListener('abort', onAbort);
            internalSignal.removeEventListener('abort', onAbort);
        };

        externalSignal?.addEventListener('abort', onAbort);
        internalSignal.addEventListener('abort', onAbort);

        return abortController.signal;
    }

    haltGeneration() {
        if (this.currentAbortController) {
            this.currentAbortController.abort();
        }
    }
}