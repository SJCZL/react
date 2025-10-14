import { DEFAULT_SYSTEM_PROMPT } from './config.js';
import { ApiService } from './api.js';

export class ChatService {
    constructor(apiKey, modelName = null) {
        this.conversation = [];
        this.systemPrompt = DEFAULT_SYSTEM_PROMPT;
        this.apiService = new ApiService(apiKey, modelName);
        this.currentAbortController = null;
    }

    updateModelName(modelName) {
        if (this.apiService) {
            this.apiService.modelName = modelName;
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
        this.currentAbortController = new AbortController();
        const combinedSignal = this.getCombinedSignal(signal);

        const apiMessages = [{ role: 'system', content: this.systemPrompt }, ...history]
            .map(({ role, content }) => ({ role, content }));

        const botMessage = history[history.length - 1];
        if (!botMessage || botMessage.role !== 'assistant') {
            console.error("ChatService.fetchBotResponse expects the last message in history to be an empty assistant message.");
            return;
        }

        try {
            const reader = await this.apiService.streamLLMResponse(apiMessages, temperature, topP, combinedSignal);
            const decoder = new TextDecoder();
            let firstChunk = true;

            while (true) {
                if (combinedSignal.aborted) throw new Error("Aborted");
                const { value, done } = await reader.read();
                if (done) break;

                if (firstChunk) {
                    onFirstChunk();
                    firstChunk = false;
                }

                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split('\n\n');

                for (const line of lines) {
                    if (line.startsWith('data:')) {
                        const dataStr = line.substring(5).trim();
                        if (dataStr === '[DONE]') return;
                        try {
                            const parsed = JSON.parse(dataStr);
                            const content = parsed.choices[0]?.delta?.content;
                            const reasoningContent = parsed.choices[0]?.delta?.reasoning_content;
                            
                            if (content) {
                                botMessage.content += content;
                            }
                            if (reasoningContent) {
                                if (!botMessage.reasoningContent) {
                                    botMessage.reasoningContent = '';
                                }
                                botMessage.reasoningContent += reasoningContent;
                            }
                            
                            if (content || reasoningContent) {
                                onChunk(botMessage.content, botMessage.reasoningContent);
                            }
                        } catch (e) { /* Ignore parsing errors */ }
                    }
                }
            }
        } catch (error) {
            if (error.name === 'AbortError') {
                botMessage.content = botMessage.content || '[Generation stopped]';
            } else {
                botMessage.content = `Error: ${error.message}`;
            }
            onChunk(botMessage.content); // Update UI with final state
        } finally {
            this.currentAbortController = null;
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