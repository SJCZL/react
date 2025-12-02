import { ApiService } from '../api.js';
import { modelConfig } from '../config/ModelConfig.js';

/**
 * Continuous Generation Service for headless automatic chat generation
 */
export class ContinuousGenerationService {
    constructor(apiKey = null, providerId = null) {
        // 使用传入的apiKey或从模型配置获取
        const resolvedProvider = providerId || modelConfig.currentProvider;
        this.apiKey = apiKey || modelConfig.getApiKeyForProvider(resolvedProvider);
        this.apiService = new ApiService(this.apiKey, null, resolvedProvider);
        this.currentSession = null;
        this.abortController = null;
        this.isGenerating = false;
        this.streamCallbacks = {
            onChunk: null,
            onRoleSwitch: null,
            onTermination: null
        };
    }

    /**
     * Set stream callbacks for real-time processing
     * @param {Object} callbacks - Callback functions
     * @param {Function} callbacks.onChunk - Called for each text chunk
     * @param {Function} callbacks.onRoleSwitch - Called when role switches
     * @param {Function} callbacks.onTermination - Called when session terminates
     */
    setStreamCallbacks(callbacks) {
        this.streamCallbacks = { ...this.streamCallbacks, ...callbacks };
    }

    /**
     * Start a new continuous generation session
     * @param {Object} sessionConfig - Session configuration
     * @param {string} sessionConfig.chatSystemPrompt - System prompt for assistant LLM
     * @param {string} sessionConfig.autoresponseSystemPrompt - System prompt for user LLM
     * @param {string} sessionConfig.initialMessage - Initial message to start the conversation
     * @param {Object} sessionConfig.endCondition - End condition configuration
     * @param {string} sessionConfig.endCondition.type - Type of end condition ('roundLimit', 'userRegex', 'assistantRegex')
     * @param {number|string} sessionConfig.endCondition.value - Value for the end condition
     * @param {string} sessionConfig.modelName - Model name for assistant LLM generation
     * @param {number} sessionConfig.temperature - Temperature for assistant LLM generation
     * @param {number} sessionConfig.topP - TopP for assistant LLM generation
     * @returns {Promise<Object>} - Session information
     */
    async startSession(sessionConfig) {
        if (this.isGenerating) {
            throw new Error('A session is already running');
        }

        const {
            chatSystemPrompt,
            autoresponseSystemPrompt,
            initialMessage,
            endCondition = { type: 'roundLimit', value: 10 },
            modelName = modelConfig.currentModel, // 使用模型配置系统中的模型
            temperature = 0.97,
            topP = 0.3,
            providerId = modelConfig.currentProvider,
            apiKeyOverride = modelConfig.getApiKeyForProvider(providerId)
        } = sessionConfig;

        // Validate required parameters
        if (!chatSystemPrompt || !autoresponseSystemPrompt || !initialMessage) {
            throw new Error('Missing required session parameters');
        }
        if (!providerId) {
            throw new Error('未选择对话服务商');
        }
        if (!apiKeyOverride) {
            throw new Error(`未配置 ${providerId} 的 API 密钥，请在“模型设置”中保存后重试`);
        }

        this.currentSession = {
            id: this.generateSessionId(),
            chatSystemPrompt,
            autoresponseSystemPrompt,
            initialMessage,
            endCondition,
            assistantModelName: modelName,
            assistantProviderId: providerId,
            assistantApiKey: apiKeyOverride,
            assistantTemperature: temperature,
            assistantTopP: topP,
            userModelName: modelName,
            userProviderId: providerId,
            userApiKey: apiKeyOverride,
            userTemperature: 0.3,
            userTopP: 0.97,
            conversation: [],
            currentRole: 'user', // Start with user role
            roundCount: 0,
            startTime: Date.now()
        };

        this.isGenerating = true;
        this.abortController = new AbortController();

        try {
            // Start the generation loop
            await this.generationLoop();
        } catch (error) {
            if (error.name !== 'AbortError') {
                console.error('Generation session error:', error);
            }
        } finally {
            this.isGenerating = false;
            this.abortController = null;
        }

        return this.currentSession;
    }

    /**
     * Stop the current session
     */
    stopSession() {
        if (this.abortController) {
            this.abortController.abort();
        }
    }

    /**
     * Main generation loop
     */
    async generationLoop() {
        const { initialMessage } = this.currentSession;
        
        // Add initial message
        const initialTs = Date.now();
        this.addMessageToConversation('user', initialMessage, null, {
            startedAt: initialTs,
            firstTokenAt: null,
            endedAt: null,
            latencyMs: null,
            firstTokenLatencyMs: null
        });
        this.emitChunk(initialMessage, 'user');

        while (this.isGenerating && !this.abortController.signal.aborted) {
            // Generate assistant response
            await this.generateAssistantResponse();
            
            if (this.shouldTerminate()) {
                break;
            }

            // Generate user response
            await this.generateUserResponse();
            
            if (this.shouldTerminate()) {
                break;
            }
        }

        // Emit termination with complete conversation
        this.emitTermination();
    }

    /**
     * Generate assistant response
     */
    async generateAssistantResponse() {
        this.emitRoleSwitch('assistant');
        
        const message = {
            role: 'assistant',
            content: '',
            reasoningContent: null
        };
        const startedAt = Date.now();
        
        this.addMessageToConversation(message.role, message.content, message.reasoningContent, {
            startedAt,
            firstTokenAt: null,
            endedAt: null,
            latencyMs: null,
            firstTokenLatencyMs: null
        });
        const messageIndex = this.currentSession.conversation.length - 1;
        const metricsRef = this.currentSession.conversation[messageIndex].metrics || {};

        const apiMessages = [
            { role: 'system', content: this.currentSession.chatSystemPrompt },
            ...this.currentSession.conversation.slice(0, -1) // Exclude the empty assistant message we just added
        ];

        try {
            const reader = await this.apiService.streamLLMResponse(
                apiMessages,
                this.currentSession.assistantTemperature,
                this.currentSession.assistantTopP,
                this.abortController.signal,
                {
                    providerId: this.currentSession.assistantProviderId,
                    model: this.currentSession.assistantModelName,
                    apiKey: this.currentSession.assistantApiKey
                }
            );

            const decoder = new TextDecoder();
            
            while (true) {
                if (this.abortController.signal.aborted) break;
                
                const { value, done } = await reader.read();
                if (done) break;

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
                                this.currentSession.conversation[messageIndex].content += content;
                                this.emitChunk(content, 'assistant');
                                if (!metricsRef.firstTokenAt) {
                                    metricsRef.firstTokenAt = Date.now();
                                }
                            }
                            if (reasoningContent) {
                                if (!this.currentSession.conversation[messageIndex].reasoningContent) {
                                    this.currentSession.conversation[messageIndex].reasoningContent = '';
                                }
                                this.currentSession.conversation[messageIndex].reasoningContent += reasoningContent;
                                // console.log(`[ContinuousGenerationService] Added reasoning content for assistant message ${messageIndex}:`, {
                                //     reasoningContentLength: reasoningContent.length,
                                //     totalReasoningLength: this.currentSession.conversation[messageIndex].reasoningContent.length,
                                //     reasoningContentPreview: reasoningContent.substring(0, 100) + '...'
                                // });
                                // Don't emit reasoning content chunks to maintain consistency with main chat
                            }
                        } catch (e) {
                            // Ignore parsing errors
                        }
                    }
                }
            }
        } catch (error) {
            if (error.name !== 'AbortError') {
                this.currentSession.conversation[messageIndex].content = `Error: ${error.message}`;
                this.emitChunk(`Error: ${error.message}`, 'assistant');
            }
        } finally {
            const endedAt = Date.now();
            metricsRef.endedAt = endedAt;
            metricsRef.latencyMs = endedAt - startedAt;
            metricsRef.firstTokenLatencyMs = metricsRef.firstTokenAt ? metricsRef.firstTokenAt - startedAt : null;
        }
    }

    /**
     * Generate user response
     */
    async generateUserResponse() {
        this.emitRoleSwitch('user');
        
        const message = {
            role: 'user',
            content: '',
            reasoningContent: null
        };
        const startedAt = Date.now();
        
        this.addMessageToConversation(message.role, message.content, message.reasoningContent, {
            startedAt,
            firstTokenAt: null,
            endedAt: null,
            latencyMs: null,
            firstTokenLatencyMs: null
        });
        const messageIndex = this.currentSession.conversation.length - 1;
        const metricsRef = this.currentSession.conversation[messageIndex].metrics || {};

        // Create context for auto-response (swap roles)
        const autoResponseContext = this.currentSession.conversation
            .slice(0, -1) // Exclude the empty user message we just added
            .map(msg => ({
                role: msg.role === 'user' ? 'assistant' : 'user',
                content: msg.content
            }));

        const apiMessages = [
            { role: 'system', content: this.currentSession.autoresponseSystemPrompt },
            ...autoResponseContext
        ];

        try {
            const reader = await this.apiService.streamLLMResponse(
                apiMessages,
                this.currentSession.userTemperature,
                this.currentSession.userTopP,
                this.abortController.signal,
                {
                    providerId: this.currentSession.userProviderId,
                    model: this.currentSession.userModelName,
                    apiKey: this.currentSession.userApiKey
                }
            );

            const decoder = new TextDecoder();
            
            while (true) {
                if (this.abortController.signal.aborted) break;
                
                const { value, done } = await reader.read();
                if (done) break;

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
                                this.currentSession.conversation[messageIndex].content += content;
                                this.emitChunk(content, 'user');
                                if (!metricsRef.firstTokenAt) {
                                    metricsRef.firstTokenAt = Date.now();
                                }
                            }
                            if (reasoningContent) {
                                if (!this.currentSession.conversation[messageIndex].reasoningContent) {
                                    this.currentSession.conversation[messageIndex].reasoningContent = '';
                                }
                                this.currentSession.conversation[messageIndex].reasoningContent += reasoningContent;
                                // Don't emit reasoning content chunks to maintain consistency with main chat
                            }
                        } catch (e) {
                            // Ignore parsing errors
                        }
                    }
                }
            }
        } catch (error) {
            if (error.name !== 'AbortError') {
                this.currentSession.conversation[messageIndex].content = `Error: ${error.message}`;
                this.emitChunk(`Error: ${error.message}`, 'user');
            }
        } finally {
            const endedAt = Date.now();
            metricsRef.endedAt = endedAt;
            metricsRef.latencyMs = endedAt - startedAt;
            metricsRef.firstTokenLatencyMs = metricsRef.firstTokenAt ? metricsRef.firstTokenAt - startedAt : null;
        }
    }

    /**
     * Check if session should terminate
     * @returns {boolean} - True if should terminate
     */
    shouldTerminate() {
        const { endCondition } = this.currentSession;
        
        switch (endCondition.type) {
            case 'roundLimit':
            case 'rounds':
                const rounds = Math.floor(this.currentSession.conversation.length / 2);
                return rounds >= endCondition.value;
                
            case 'userRegex':
                const lastUserMessage = this.currentSession.conversation
                    .slice()
                    .reverse()
                    .find(msg => msg.role === 'user');
                if (lastUserMessage) {
                    const regex = new RegExp(endCondition.value);
                    return regex.test(lastUserMessage.content);
                }
                return false;
                
            case 'assistantRegex':
                const lastAssistantMessage = this.currentSession.conversation
                    .slice()
                    .reverse()
                    .find(msg => msg.role === 'assistant');
                if (lastAssistantMessage) {
                    const regex = new RegExp(endCondition.value);
                    return regex.test(lastAssistantMessage.content);
                }
                return false;
                
            default:
                return false;
        }
    }

    /**
     * Add message to conversation
     * @param {string} role - Message role
     * @param {string} content - Message content
     * @param {string} reasoningContent - Reasoning content (optional)
     */
    addMessageToConversation(role, content, reasoningContent = null, metrics = {}) {
        const id = this.generateMessageId();
        const now = Date.now();
        const normalizedMetrics = {
            startedAt: Number.isFinite(metrics.startedAt) ? metrics.startedAt : now,
            firstTokenAt: Number.isFinite(metrics.firstTokenAt) ? metrics.firstTokenAt : null,
            endedAt: Number.isFinite(metrics.endedAt) ? metrics.endedAt : null,
            latencyMs: Number.isFinite(metrics.latencyMs) ? metrics.latencyMs : null,
            firstTokenLatencyMs: Number.isFinite(metrics.firstTokenLatencyMs) ? metrics.firstTokenLatencyMs : null
        };
        const message = { id, role, content, reasoningContent, metrics: normalizedMetrics };
        this.currentSession.conversation.push(message);
        return message;
    }

    /**
     * Emit chunk to stream callbacks
     * @param {string} chunk - Text chunk
     * @param {string} role - Message role
     */
    emitChunk(chunk, role) {
        if (this.streamCallbacks.onChunk) {
            this.streamCallbacks.onChunk(chunk, role);
        }
    }

    /**
     * Emit role switch to stream callbacks
     * @param {string} role - New role
     */
    emitRoleSwitch(role) {
        this.currentSession.currentRole = role;
        if (this.streamCallbacks.onRoleSwitch) {
            this.streamCallbacks.onRoleSwitch(role);
        }
    }

    /**
     * Emit termination to stream callbacks
     */
    emitTermination() {
        if (this.streamCallbacks.onTermination) {
            const sessionData = {
                ...this.currentSession,
                endTime: Date.now(),
                duration: Date.now() - this.currentSession.startTime
            };
            
            // Log conversation data with reasoning content for debugging
            console.log(`[ContinuousGenerationService] Session termination - conversation data:`, sessionData.conversation.map(msg => ({
                id: msg.id,
                role: msg.role,
                contentLength: msg.content.length,
                hasReasoningContent: !!(msg.reasoningContent && msg.reasoningContent.trim()),
                reasoningContentLength: msg.reasoningContent ? msg.reasoningContent.length : 0
            })));
            
            this.streamCallbacks.onTermination(sessionData);
        }
    }

    /**
     * Generate unique session ID
     * @returns {string} - Session ID
     */
    generateSessionId() {
        return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Generate unique message ID
     * @returns {number} - Message ID
     */
    generateMessageId() {
        const now = new Date();
        const baseTimestamp = Math.floor(now.getTime() / 1000) * 1000;
        const milliseconds = now.getMilliseconds();
        return baseTimestamp + milliseconds;
    }

    /**
     * Get current session status
     * @returns {Object|null} - Current session data or null if no active session
     */
    getCurrentSession() {
        return this.currentSession;
    }

    /**
     * Check if currently generating
     * @returns {boolean} - True if generating
     */
    getIsGenerating() {
        return this.isGenerating;
    }
}
