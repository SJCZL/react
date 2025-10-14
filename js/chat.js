import { ChatService } from './ChatService.js';
import { ChatUIManager } from './ChatUIManager.js';
import { DEFAULT_INITIAL_RESPONSE, DEFAULT_RESPONSE_PROMPT, MODEL_NAME } from './config.js';

export class Chat {
    constructor(options) {
        this.chatService = new ChatService(options.apiKey, options.modelName || null, options.modelConfig || null);
        this.headless = options.headless || false;
        this.modelConfig = options.modelConfig; // 保存模型配置引用
        this.uiManager = null;
 
        if (!this.headless) {
            this.uiManager = new ChatUIManager(options);
            this.uiManager.chat = this; // Set back-reference for analysis system
        }
 
        // Default sampling parameters (may be overridden from the toolbar)
        this.defaultTemperature = (typeof options?.defaultTemperature === 'number') ? options.defaultTemperature : null;
        this.defaultTopP = (typeof options?.defaultTopP === 'number') ? options.defaultTopP : null;
 
        this.isGenerating = false;
        // Auto-response state
        this.isAutoResponding = false;
        this.isAutoResponseEnabled = false;
        this.autoResponseAbortController = null;
        // Continuous-response state
        this.isContinuousResponding = false;
        this.isContinuousResponseEnabled = false;
        this.continuousResponseAbortController = null;
        
        // Operation state management to prevent race conditions
        this.operationState = {
            current: 'IDLE', // IDLE, GENERATING, AUTO_RESPONDING, CONTINUOUS_RESPONDING
            abortController: null,
            pendingOperations: []
        };

        if (!this.headless) {
            this.init();
        }
    }

    /**
     * Execute an operation with proper locking to prevent race conditions
     */
    async executeOperation(type, operation) {
        if (this.operationState.current !== 'IDLE') {
            console.warn(`Cannot execute ${type} while ${this.operationState.current}`);
            return false;
        }
        
        try {
            this.operationState.current = type;
            this.operationState.abortController = new AbortController();
            await operation(this.operationState.abortController.signal);
            return true;
        } catch (error) {
            if (error.name !== 'AbortError') {
                console.error(`Operation ${type} failed:`, error);
            }
            return false;
        } finally {
            this.operationState.current = 'IDLE';
            this.operationState.abortController = null;
        }
    }

    init() {
        if (this.headless) return;

        this.uiManager.sendButton.addEventListener('click', () => this.handleSendClick());
        this.uiManager.messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });
        this.uiManager.clearChatButton.addEventListener('click', () => this.clearChat());
        this.uiManager.chatContainer.addEventListener('click', (e) => this.handleChatActions(e));
        this.uiManager.saveChatButton.addEventListener('click', () => this.saveChat());
        this.uiManager.loadChatButton.addEventListener('click', () => this.uiManager.loadChatInput.click());
        this.uiManager.loadChatInput.addEventListener('change', (e) => this.handleFileSelect(e));
        this.uiManager.messageInput.addEventListener('input', () => {
            this.uiManager.messageInput.style.height = 'auto';
            this.uiManager.messageInput.style.height = (this.uiManager.messageInput.scrollHeight) + 'px';
        });
        
        // Setup keyboard navigation for message selection
        this.setupKeyboardNavigation();
        this.uiManager.autoResponseToggle.addEventListener('change', (e) => {
            this.isAutoResponseEnabled = e.target.checked;
            
            const continuousToggleContainer = this.uiManager.continuousResponseToggle.closest('.toggle-switch');
            this.uiManager.continuousResponseToggle.disabled = !this.isAutoResponseEnabled;
            if (continuousToggleContainer) {
                continuousToggleContainer.classList.toggle('disabled', !this.isAutoResponseEnabled);
            }

            if (!this.isAutoResponseEnabled) {
                this.uiManager.continuousResponseToggle.checked = false;
                this.isContinuousResponseEnabled = false;
                this.uiManager.endConditionContainer.style.display = 'none';
            }
            this.updateSendButtonState();
        });
        this.uiManager.continuousResponseToggle.addEventListener('change', (e) => {
            this.isContinuousResponseEnabled = e.target.checked;
            this.uiManager.endConditionContainer.style.display = this.isContinuousResponseEnabled ? 'block' : 'none';
            this.updateSendButtonState();
        });

        const continuousToggleContainer = this.uiManager.continuousResponseToggle.closest('.toggle-switch');
        this.uiManager.continuousResponseToggle.disabled = !this.uiManager.autoResponseToggle.checked;
        if (continuousToggleContainer) {
            continuousToggleContainer.classList.toggle('disabled', !this.uiManager.autoResponseToggle.checked);
        }
 
        // 模型参数现在由模型配置面板统一管理
        // 这里不再直接绑定侧边栏输入框，而是通过模型配置系统同步

        // 模型参数现在由模型配置面板统一管理
        // 初始化时使用传入的参数值
        console.log(`[Chat] Initialized with model: ${this.chatService.apiService.modelName}`);
        console.log(`[Chat] Initialized with temperature: ${this.defaultTemperature}`);
        console.log(`[Chat] Initialized with topP: ${this.defaultTopP}`);

        this.initializeConversation();

        // Initialize analysis system
        this.initializeAnalysis();

        // Initialize model selection UI
        this.initializeModelSelectionUI();

        // Initialize custom select functionality
        this.initializeCustomSelects();
    }


    handleSendClick() {
        console.log('[Chat] handleSendClick called', {
            isContinuousResponding: this.isContinuousResponding,
            isAutoResponding: this.isAutoResponding,
            isGenerating: this.isGenerating,
            isContinuousResponseEnabled: this.isContinuousResponseEnabled,
            isAutoResponseEnabled: this.isAutoResponseEnabled
        });
        
        if (this.isContinuousResponding) {
            this.haltContinuousResponse();
        } else if (this.isAutoResponding) {
            this.haltAutoResponse();
        } else if (this.isGenerating) {
            this.haltGeneration();
        } else if (this.isContinuousResponseEnabled) {
            this.startContinuousResponse();
        } else if (this.isAutoResponseEnabled) {
            this.startAutoResponse();
        } else {
            this.sendMessage();
        }
    }

    haltGeneration() {
        this.chatService.haltGeneration();
        this.setGeneratingState(false);
    }

    haltContinuousResponse() {
        if (this.continuousResponseAbortController) {
            this.uiManager.sendButton.classList.add('stopping');
            this.continuousResponseAbortController.abort();
        }
    }

    haltAutoResponse() {
        if (this.autoResponseAbortController) {
            this.autoResponseAbortController.abort();
        }
    }

    haltAllGeneration() {
        if (this.isContinuousResponding) {
            this.haltContinuousResponse();
        }
        if (this.isAutoResponding) {
            this.haltAutoResponse();
        }
        if (this.isGenerating) {
            this.haltGeneration();
        }
        
        // Clear streaming markers when generation is halted
        this.uiManager.clearAllStreamingMarkers();
    }

    setAutoRespondingState(isAutoResponding) {
        this.isAutoResponding = isAutoResponding;
        this.updateSendButtonState();
    }

    setContinuousRespondingState(isContinuousResponding) {
        this.isContinuousResponding = isContinuousResponding;
        this.updateSendButtonState();
    }

    setGeneratingState(generating) {
        this.isGenerating = generating;
        this.updateSendButtonState();

        if (this.headless || this.isAutoResponseEnabled) return;

        // Update UI elements for manual mode
        this.uiManager.messageInput.disabled = generating;
        this.uiManager.sendButton.disabled = false; // Always keep send button enabled
        
        this.uiManager.clearChatButton.disabled = false; // Allow clear during generation
        this.uiManager.saveChatButton.disabled = false; // Allow save during generation
        this.uiManager.loadChatButton.disabled = false; // Allow load during generation
        
        // Disable message action buttons during generation
        const actionButtons = this.uiManager.chatContainer.querySelectorAll('.message-actions button');
        actionButtons.forEach(btn => btn.disabled = generating);
    }
    
    /**
     * Initialize analysis system
     */
    initializeAnalysis() {
        if (!this.uiManager || !this.uiManager.selectionManager) return;

        const apiKey = this.chatService.apiService.apiKey;
        const config = this.getAnalysisConfig();

        this.uiManager.selectionManager.initializeAnalysis(apiKey, config);

        // Set up configuration change listeners
        this.setupAnalysisConfigListeners();

        console.log('[Chat] Analysis system initialized');
    }
    
    /**
     * Get analysis configuration from UI
     */
    getAnalysisConfig() {
        if (!this.uiManager) return {};
        
        return {
            autoGenerate: document.getElementById('auto-analysis-toggle')?.checked ?? true
        };
    }
    
    /**
     * Set up analysis configuration change listeners
     */
    setupAnalysisConfigListeners() {
        if (!this.uiManager) return;
        
        // Auto-analysis toggle
        const autoAnalysisToggle = document.getElementById('auto-analysis-toggle');
        if (autoAnalysisToggle) {
            autoAnalysisToggle.addEventListener('change', () => {
                this.updateAnalysisConfig();
            });
        }
    }
    
    /**
     * Update analysis configuration
     */
    updateAnalysisConfig() {
        if (!this.uiManager || !this.uiManager.selectionManager) return;
        
        const config = this.getAnalysisConfig();
        this.uiManager.selectionManager.updateAnalysisConfig(config);
    }
    
    /**
     * Auto-generate analysis for a completed message
     */
    async autoGenerateAnalysisForMessage(messageId) {
        if (!this.uiManager || !this.uiManager.selectionManager) return;
        
        const autoGenerate = document.getElementById('auto-analysis-toggle')?.checked ?? true;
        await this.uiManager.selectionManager.autoGenerateAnalysis(messageId, autoGenerate);
    }

    handleChatActions(e) {
        const target = e.target.closest('button');
        if (!target) return;
        
        // Only halt generation for certain actions, not for message action buttons during generation
        const isMessageActionButton = target.closest('.message-actions');
        if (!isMessageActionButton) {
            this.haltAllGeneration();
        }
        
        // Clear selection when any action button is clicked
        this.uiManager.selectionManager.handleActionButtonClick();
        
        const messageElement = target.closest('.message');
        if (!messageElement) return;

        if (messageElement.classList.contains('system-prompt-message')) {
            if (target.classList.contains('edit-btn')) {
                const originalContent = this.chatService.getSystemPrompt();
                this.uiManager.editSystemPrompt(messageElement, originalContent, (newContent) => {
                    if (newContent) {
                        this.chatService.setSystemPrompt(newContent);
                    }
                    this.renderMessages(true);
                    this.uiManager.selectionManager.updateDebugOverlay();
                });
            }
            // Note: Don't clear selection for system prompt editing
            return;
        }

        const messageId = parseInt(messageElement.dataset.id, 10);

        if (target.classList.contains('delete-btn')) {
            this.deleteMessage(messageId);
        } else if (target.classList.contains('regen-btn')) {
            this.regenResponse(messageId);
        } else if (target.classList.contains('edit-btn')) {
            const message = this.chatService.getConversation().find(msg => msg.id === messageId);
            if (message) {
                this.uiManager.editMessage(messageElement, message.content, (newContent) => {
                    if (newContent && newContent !== message.content) {
                        message.content = newContent;
                    }
                    this.renderMessages(true);
                    this.uiManager.selectionManager.updateDebugOverlay();
                });
            }
        }
        
        // Selection is already cleared at the start of handleChatActions
    }

    initializeConversation() {
        this.chatService.setConversation([]);
        if (!this.headless) {
            this.renderMessages();
        }
    }



    saveChat() {
        // Halt generation if save is performed during generation
        this.haltAllGeneration();
        
        const record = {
            systemPrompt: this.chatService.getSystemPrompt(),
            conversation: this.chatService.getConversation()
        };
        const dataStr = JSON.stringify(record, null, 2);
        const blob = new Blob([dataStr], {type: "application/json"});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `chat-record-${new Date().toISOString()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    handleFileSelect(event) {
        // Halt generation if load is performed during generation
        this.haltAllGeneration();
        
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const record = JSON.parse(e.target.result);
                if (record.systemPrompt && record.conversation) {
                    if (confirm("是否使用文件中的系统提示覆盖当前的系统提示？")) {
                        this.chatService.setSystemPrompt(record.systemPrompt);
                    }
                    this.chatService.setConversation(record.conversation);
                    this.renderMessages();
                    this.uiManager.selectionManager.updateDebugOverlay();
                } else {
                    alert("无效的聊天记录文件格式。");
                }
            } catch (err) {
                alert("读取或解析文件时出错: " + err.message);
            } finally {
                // Reset file input to allow loading the same file again
                this.uiManager.loadChatInput.value = '';
            }
        };
        reader.readAsText(file);
    }

    async sendMessage() {
        console.log('[Chat] sendMessage method called');
        if (this.headless) return;
        const messageText = this.uiManager.messageInput.value.trim();
        console.log('[Chat] Message text:', messageText ? `"${messageText.substring(0, 50)}..."` : 'EMPTY');
        if (!messageText) return;

        // 使用模型配置系统验证API密钥
        if (!window.modelConfig || !window.modelConfig.validateConfig()) {
            const currentProvider = window.modelConfig?.getCurrentProvider();
            const providerName = currentProvider?.name || '所选服务商';
            alert(`请先配置 ${providerName} 的API密钥。\n\n💡 提示：点击右上角的"⚙️ 模型设置"按钮进行配置。`);
            return;
        }

        // 检查系统提示词是否为空
        const systemPrompt = this.chatService.getSystemPrompt();
        if (!systemPrompt || systemPrompt.trim() === '') {
            alert('请先设置系统提示词。\n\n💡 提示：\n1. 点击"场景配置"标签页\n2. 使用YAML编辑器配置场景\n3. 点击"生成系统提示"按钮\n4. 点击"应用到主对话"按钮');
            return;
        }

        // 同步最新的配置到聊天服务
        this.chatService.apiService.updateConfig();

        console.log(`[Chat] sendMessage called with text: "${messageText.substring(0, 50)}..."`);
        
        // Add to debug panel
        if (typeof window.debug !== 'undefined') {
            window.debug.set('Operations', 'sendMessageText', messageText.substring(0, 50) + '...');
            window.debug.set('Operations', 'sendTimestamp', new Date().toISOString());
        }

        const success = await this.executeOperation('GENERATING', async (signal) => {
            this.chatService.addMessage('user', messageText);
            
            console.log(`[Chat] Added user message, rendering messages`);
            this.renderMessages();
            this.uiManager.selectionManager.updateDebugOverlay();
            this.uiManager.messageInput.value = '';
            this.uiManager.messageInput.style.height = 'auto';

            // Auto-generate analysis for the manually sent user message
            const userMessage = this.chatService.getConversation().slice(-1)[0];
            this.autoGenerateAnalysisForMessage(userMessage.id);

            await this.fetchBotResponse(signal);
        });
        
        if (!success) {
            console.log('Message send operation was aborted or failed');
        }
    }

    async startContinuousResponse() {
        this.setContinuousRespondingState(true);
        this.continuousResponseAbortController = new AbortController();
        const signal = this.continuousResponseAbortController.signal;
 
        try {
            while (!signal.aborted) {
                // Auto-generate user (or assistant, depending on context) response
                // If startAutoResponse fails (returns false), stop the continuous loop to avoid repeated errors.
                const success = await this.startAutoResponse();
                if (!success) {
                    console.log("startAutoResponse failed or was cancelled. Stopping continuous response.");
                    break;
                }
 
                // Wait for startAutoResponse to complete fully, including the bot's reply
                // We need a mechanism to know when fetchBotResponse inside startAutoResponse is done.
                // Let's create a promise that resolves when generation is finished.
                await new Promise(resolve => {
                    const check = () => {
                        if (!this.isGenerating && !this.isAutoResponding) {
                            resolve();
                        } else {
                            setTimeout(check, 100);
                        }
                    };
                    check();
                });
 
                if (signal.aborted) break;
 
                // Check end condition AFTER the turn is complete
                if (this.checkEndCondition()) {
                    console.log("End condition met.");
                    break;
                }
            }
        } catch (error) {
            if (error.name !== 'AbortError') {
                alert(`连续响应出错: ${error.message}`);
            }
        } finally {
            this.setContinuousRespondingState(false);
            this.continuousResponseAbortController = null;
            this.uiManager.sendButton.classList.remove('stopping');
            this.renderMessages();
            this.uiManager.selectionManager.updateDebugOverlay();
        }
    }

    /**
     * Setup keyboard navigation for message selection
     */
    setupKeyboardNavigation() {
        document.addEventListener('keydown', (e) => {
            // Ignore events when focus is on an input/textarea (we don't want to steal typing)
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
                return;
            }
            
            // Ignore when any modifier key is pressed
            if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) {
                return;
            }
            
            // If user presses Space (and isn't typing), jump to the start of the actual chat
            const isSpace = e.key === ' ' || e.key === 'Spacebar' || e.key === 'Space' || e.code === 'Space';
            if (isSpace) {
                e.preventDefault();
                // Scroll to the first message-pair (the start of the conversation after system prompt)
                const firstPair = this.uiManager.chatContainer.querySelector('.message-pair');
                if (firstPair) {
                    // Align the first pair to the top of the scroll container
                    firstPair.scrollIntoView({ behavior: 'smooth', block: 'start' });
                } else {
                    // Fallback: scroll to top of the container
                    this.uiManager.chatContainer.scrollTop = 0;
                }
                return;
            }
            
            const allMessages = this.uiManager.selectionManager.getAllSelectableMessages();
            if (allMessages.length === 0) return;
            
            let currentMessageIndex = -1;
            const selectedMessage = this.uiManager.selectionManager.getSelectedMessage();
            if (selectedMessage) {
                currentMessageIndex = allMessages.indexOf(selectedMessage);
            }
            
            let newMessageIndex = currentMessageIndex;
            
            switch (e.key) {
                case 'ArrowUp':
                    e.preventDefault();
                    newMessageIndex = currentMessageIndex > 0 ? currentMessageIndex - 1 : allMessages.length - 1;
                    break;
                case 'ArrowDown':
                    e.preventDefault();
                    newMessageIndex = currentMessageIndex < allMessages.length - 1 ? currentMessageIndex + 1 : 0;
                    break;
                case 'ArrowLeft':
                    e.preventDefault();
                    newMessageIndex = currentMessageIndex > 0 ? currentMessageIndex - 1 : -1;
                    break;
                case 'ArrowRight':
                    e.preventDefault();
                    newMessageIndex = currentMessageIndex < allMessages.length - 1 ? currentMessageIndex + 1 : -1;
                    break;
                default:
                    return;
            }
            
            // Navigate to the new message
            if (newMessageIndex >= 0 && newMessageIndex < allMessages.length) {
                const newMessage = allMessages[newMessageIndex];
                this.uiManager.selectionManager.selectMessage(newMessage);
                // Scroll the selected message into view
                newMessage.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            } else if (newMessageIndex === -1) {
                // Deselect if navigating to -1 (left/right arrow boundaries)
                this.uiManager.selectionManager.deselectAll();
            }
        });
    }

    checkEndCondition() {
        const condition = this.uiManager.endConditionSelect.value;
        const conversationTurns = Math.floor(this.chatService.getConversation().length / 2);
        const lastMessage = this.chatService.getConversation()[this.chatService.getConversation().length - 1];
        const userMessageForRegex = this.chatService.getConversation()[this.chatService.getConversation().length - 2];

        console.log(`[CheckEndCondition] Condition: ${condition}, Turns: ${conversationTurns}`);

        switch (condition) {
            case 'roundLimit':
                const limit = parseInt(this.uiManager.dialogueRoundLimitInput.value, 10);
                console.log(`[CheckEndCondition] Round limit: ${limit}, Current turns: ${conversationTurns}`);
                return conversationTurns >= limit;
            case 'assistantRegex':
                if (lastMessage && lastMessage.role === 'assistant') {
                    const regexPattern = this.uiManager.assistantRegexMatchInput.value;
                    const regex = new RegExp(regexPattern);
                    const isMatch = regex.test(lastMessage.content);
                    console.log(`[CheckEndCondition] Assistant Regex: /${regexPattern}/. Testing on: "${lastMessage.content}". Match: ${isMatch}`);
                    return isMatch;
                }
                return false;
            case 'userRegex':
                 if (userMessageForRegex && userMessageForRegex.role === 'user') {
                    const regexPattern = this.uiManager.userRegexMatchInput.value;
                    const regex = new RegExp(regexPattern);
                    const isMatch = regex.test(userMessageForRegex.content);
                    console.log(`[CheckEndCondition] User Regex: /${regexPattern}/. Testing on: "${userMessageForRegex.content}". Match: ${isMatch}`);
                    return isMatch;
                }
                return false;
            default:
                return false;
        }
    }

    async startAutoResponse() {
        this.setAutoRespondingState(true);
        this.autoResponseAbortController = new AbortController();
        const signal = this.autoResponseAbortController.signal;
 
        try {
            let autoGeneratedText = '';
 
            let newUserMessage = null;
            
            if (this.chatService.getConversation().length === 0) {
                autoGeneratedText = this.uiManager.initialResponseInput.value.trim();
                if (!autoGeneratedText) {
                    // Inform the user and return false so callers (like continuous mode) can stop looping.
                    alert("初始响应不能为空。");
                    return false;
                }
                this.chatService.addMessage('user', autoGeneratedText);
                this.renderMessages();
                this.uiManager.selectionManager.updateDebugOverlay();
                newUserMessage = this.chatService.getConversation().slice(-1)[0];
            } else {
                const autoResponseService = new ChatService(this.chatService.apiService.apiKey, this.chatService.apiService.modelName);
                autoResponseService.setSystemPrompt(this.uiManager.responsePromptInput.value.trim());
 
                const autoResponseContext = this.chatService.getConversation().map(msg => ({
                    ...msg,
                    role: msg.role === 'user' ? 'assistant' : 'user',
                }));
 
                // Add a placeholder message to the main state and render it once to create the DOM element.
                this.chatService.addMessage('user', '');
                this.renderMessages();
                this.uiManager.selectionManager.updateDebugOverlay();
                newUserMessage = this.chatService.getConversation().slice(-1)[0];
                
                // Mark this user message as streaming (auto-generating)
                this.uiManager.markMessageAsStreaming(newUserMessage.id);
 
                const tempHistory = [...autoResponseContext, { role: 'assistant', content: '' }];
 
                await autoResponseService.fetchBotResponse(
                    tempHistory,
                    this.defaultTemperature ?? 0.3, // temperature from toolbar or default
                    this.defaultTopP ?? 0.97, // top_p from toolbar or default
                    (content, reasoningContent) => { // onChunk
                        // Update the content in the main service's state object.
                        newUserMessage.content = content;
                        newUserMessage.reasoningContent = reasoningContent;
                        autoGeneratedText = content;
                        
                        // Perform a lightweight, targeted DOM update instead of a full re-render.
                        const messageElement = this.uiManager.chatContainer.querySelector(`.message[data-id='${newUserMessage.id}']`);
                        if (messageElement) {
                            // Update both content and reasoning content
                            this.uiManager.updateMessageContent(messageElement, content, reasoningContent);
                            
                            // Only auto-scroll if the user is already at the bottom.
                            const isScrolledToBottom = this.uiManager.chatContainer.scrollHeight - this.uiManager.chatContainer.scrollTop <= this.uiManager.chatContainer.clientHeight + 1;
                            if (isScrolledToBottom) {
                                // console.log('[Debug] Scrolling on chunk in startAutoResponse.');
                                this.uiManager.chatContainer.scrollTop = this.uiManager.chatContainer.scrollHeight;
                            }
                            // Update debug overlay during streaming
                            this.uiManager.selectionManager.updateDebugOverlay();
                        }
                    },
                    () => {}, // onFirstChunk
                    signal
                );
 
                if (signal.aborted) return false;
            }
            
            // Mark auto-generated user message as finished streaming
            if (newUserMessage) {
                this.uiManager.markMessageAsFinishedStreaming(newUserMessage.id);
                // Auto-generate analysis for the completed user message
                this.autoGenerateAnalysisForMessage(newUserMessage.id);
            }
 
            this.setAutoRespondingState(false);
 
            if (autoGeneratedText && !signal.aborted) {
                await this.fetchBotResponse(signal);
            }
 
            return true;
        } catch (error) {
            if (error.name !== 'AbortError') {
                alert(`自动响应出错: ${error.message}`);
            }
            return false;
        } finally {
            this.setAutoRespondingState(false);
            this.autoResponseAbortController = null;
            // A final render ensures all UI elements (like action buttons) are consistent after the stream.
            this.renderMessages();
            this.uiManager.selectionManager.updateDebugOverlay();
        }
    }


    async fetchBotResponse(externalSignal) {
        this.setGeneratingState(true);

        // Create an empty assistant message and render it
        this.chatService.addMessage('assistant', '');
        this.renderMessages();
        this.uiManager.selectionManager.updateDebugOverlay();

        const conversation = this.chatService.getConversation();
        const botMessage = conversation[conversation.length - 1];
        
        // Mark this message as streaming
        this.uiManager.markMessageAsStreaming(botMessage.id);
        const botMessageElement = this.uiManager.chatContainer.querySelector(`.message[data-id='${botMessage.id}']`);
        
        let waitingTimer = null;
        if (!this.headless && botMessageElement) {
            // console.log('[Debug] Unconditionally scrolling to bottom in fetchBotResponse.');
            this.uiManager.chatContainer.scrollTop = this.uiManager.chatContainer.scrollHeight;
            
            let waitingSeconds = 0;
            const contentSpan = botMessageElement.querySelector('span');
            contentSpan.textContent = '... 0.0s';
            waitingTimer = setInterval(() => {
                waitingSeconds += 0.1;
                contentSpan.textContent = `... ${waitingSeconds.toFixed(1)}s`;
            }, 100);
        }

        const clearWaitingIndicator = () => {
            if (waitingTimer) {
                clearInterval(waitingTimer);
                waitingTimer = null;
            }
            // Set generating state when first chunk arrives (text starts appearing)
            this.setGeneratingState(true);
        };

        // Set generating state to true when first chunk arrives and keep it true until streaming completes
        const onFirstChunkWithGeneratingState = () => {
            this.setGeneratingState(true);
            clearWaitingIndicator();
        };

        const temperature = this.defaultTemperature ?? 0.3; // temperature from toolbar or default
        const topP = this.defaultTopP ?? 0.97; // top_p from toolbar or default

        await this.chatService.fetchBotResponse(
            conversation,
            temperature,
            topP,
            (content, reasoningContent) => { // onChunk
                if (!this.headless && botMessageElement) {
                    const isScrolledToBottom = this.uiManager.chatContainer.scrollHeight - this.uiManager.chatContainer.scrollTop <= this.uiManager.chatContainer.clientHeight + 1;
                    
                    // Update both content and reasoning content
                    this.uiManager.updateMessageContent(botMessageElement, content, reasoningContent);
                    
                    if (isScrolledToBottom) {
                        // console.log('[Debug] Scrolling on chunk in fetchBotResponse.');
                        this.uiManager.chatContainer.scrollTop = this.uiManager.chatContainer.scrollHeight;
                    }
                    // Update debug overlay during streaming
                    this.uiManager.selectionManager.updateDebugOverlay();
                }
            },
            onFirstChunkWithGeneratingState, // onFirstChunk
            externalSignal // Add signal parameter
        );

        this.setGeneratingState(false);
        // Mark message as finished streaming after all text has been displayed
        this.uiManager.markMessageAsFinishedStreaming(botMessage.id);
        if (!this.headless) {
            this.renderMessages();
            this.uiManager.selectionManager.updateDebugOverlay();
        }
        
        // Auto-generate analysis for the completed message
        this.autoGenerateAnalysisForMessage(botMessage.id);
    }
    
    renderMessages(preserveScroll = false) {
        if (this.headless) return;
        
        console.log(`[Chat] renderMessages called with preserveScroll: ${preserveScroll}`);
        const conversation = this.chatService.getConversation();
        
        // Add to debug panel
        if (typeof window.debug !== 'undefined') {
            window.debug.set('Chat', 'renderCount', (window.debug.get('Chat', 'renderCount') || 0) + 1);
            window.debug.set('Chat', 'conversationLength', conversation.length);
            window.debug.set('Chat', 'lastRenderAction', new Date().toISOString());
        }
        
        this.uiManager.renderMessages(conversation, this.chatService.getSystemPrompt(), preserveScroll);
    }
    
    /**
     * Force a complete re-render of the conversation
     * This is useful when the conversation structure might be corrupted
     */
    forceReRender() {
        console.log(`[Chat] forceReRender called - performing complete conversation repair and re-render`);
        
        // Add to debug panel
        if (typeof window.debug !== 'undefined') {
            window.debug.set('Operations', 'forceReRender', new Date().toISOString());
        }
        
        // Repair conversation structure first
        this.chatService.repairConversationStructure();
        
        // Force complete re-render
        this.renderMessages(false);
        this.uiManager.selectionManager.updateDebugOverlay();
        
        console.log(`[Chat] forceReRender completed`);
    }

    updateSendButtonState() {
        if (this.headless) return;
        this.uiManager.updateSendButtonState(
            this.isContinuousResponding,
            this.isAutoResponding,
            this.isGenerating,
            this.isContinuousResponseEnabled,
            this.isAutoResponseEnabled
        );
    }

    clearChat() {
        // Halt generation if clear is performed during generation
        this.haltAllGeneration();
        this.initializeConversation();
        
        // Clear any selections and hide info panel
        if (this.uiManager.selectionManager) {
            this.uiManager.selectionManager.deselectAll();
            this.uiManager.selectionManager.hideInfoPanel();
        }
        
        this.uiManager.selectionManager.updateDebugOverlay();
    }

    deleteMessage(messageId) {
        console.log(`[Chat] deleteMessage called for ID: ${messageId}`);
        
        // Add to debug panel
        if (typeof window.debug !== 'undefined') {
            window.debug.set('Operations', 'deleteMessageId', messageId);
            window.debug.set('Operations', 'deleteTimestamp', new Date().toISOString());
        }
        
        // Clear selection before deletion
        this.uiManager.selectionManager.deselectAll();
        
        // Generation is already halted in handleChatActions
        this.chatService.deleteMessage(messageId);
        
        console.log(`[Chat] Calling renderMessages after deletion`);
        this.renderMessages();
        this.uiManager.selectionManager.updateDebugOverlay();
        
        console.log(`[Chat] deleteMessage completed`);
    }

    async regenResponse(userMessageId) {
        const success = await this.executeOperation('GENERATING', async (signal) => {
            const conversation = this.chatService.getConversation();
            const messageIndex = conversation.findIndex(msg => msg.id === userMessageId);
            if (messageIndex > -1 && conversation[messageIndex].role === 'user') {
                conversation.splice(messageIndex + 1);
                this.chatService.setConversation(conversation);

                // Clear selection before regen
                this.uiManager.selectionManager.deselectAll();

                this.renderMessages();
                this.uiManager.selectionManager.updateDebugOverlay();
                await this.fetchBotResponse(signal);
            }
        });

        if (!success) {
            console.log('Regen response operation was aborted or failed');
        }
    }

    /**
     * 初始化模型选择UI
     */
    initializeModelSelectionUI() {
        if (this.headless || !this.modelConfig) return;

        // 获取UI元素
        const chatProviderSelect = document.getElementById('chat-provider-select');
        const chatModelSelect = document.getElementById('chat-model-select');
        const psychologyModelSelect = document.getElementById('psychology-model-select');
        const qualityModelSelect = document.getElementById('quality-model-select');
        const salesModelSelect = document.getElementById('sales-model-select');

        if (!chatProviderSelect || !chatModelSelect) return;

        // 填充服务商选项
        this.populateProviderOptions();

        // 填充模型选项
        this.populateModelOptions();

        // 填充分析模型选项
        this.populateAnalysisModelOptions();

        // 绑定事件监听器
        this.setupModelSelectionEventListeners();

        // 更新当前模型显示
        this.updateCurrentModelDisplay();
    }

    /**
     * 填充服务商选项
     */
    populateProviderOptions() {
        const chatProviderSelect = document.getElementById('chat-provider-select');
        if (!chatProviderSelect || !this.modelConfig) return;

        const providers = this.modelConfig.getProviders();
        const currentProvider = this.modelConfig.getCurrentProvider();

        // 清空现有选项
        chatProviderSelect.innerHTML = '';

        providers.forEach(provider => {
            const option = document.createElement('option');
            option.value = provider.id;
            option.textContent = provider.name;
            if (provider.id === this.modelConfig.currentProvider) {
                option.selected = true;
            }
            chatProviderSelect.appendChild(option);

            // 同时为自定义选择器添加选项
            const customOption = document.createElement('span');
            customOption.className = 'custom-option';
            customOption.dataset.value = provider.id;
            customOption.textContent = provider.name;
            if (provider.id === this.modelConfig.currentProvider) {
                customOption.classList.add('selected');
            }

            const customOptions = chatProviderSelect.parentElement.querySelector('.custom-options');
            if (customOptions) {
                customOptions.appendChild(customOption);
            }
        });

        // 更新自定义选择器UI
        this.updateCustomSelectUI('chat-provider-select', currentProvider ? currentProvider.name : '选择服务商');
    }

    /**
     * 填充模型选项
     */
    populateModelOptions() {
        const chatModelSelect = document.getElementById('chat-model-select');
        if (!chatModelSelect || !this.modelConfig) return;

        const models = this.modelConfig.getProviderModels();
        const currentModel = this.modelConfig.getCurrentModel();

        // 清空现有选项
        chatModelSelect.innerHTML = '';

        models.forEach(model => {
            const option = document.createElement('option');
            option.value = model.id;
            option.textContent = model.name;
            if (model.id === this.modelConfig.currentModel) {
                option.selected = true;
            }
            chatModelSelect.appendChild(option);

            // 同时为自定义选择器添加选项
            const customOption = document.createElement('span');
            customOption.className = 'custom-option';
            customOption.dataset.value = model.id;
            customOption.textContent = model.name;
            if (model.id === this.modelConfig.currentModel) {
                customOption.classList.add('selected');
            }

            const customOptions = chatModelSelect.parentElement.querySelector('.custom-options');
            if (customOptions) {
                customOptions.appendChild(customOption);
            }
        });

        // 更新自定义选择器UI
        this.updateCustomSelectUI('chat-model-select', currentModel ? currentModel.name : '选择模型');
    }

    /**
     * 填充分析模型选项
     */
    populateAnalysisModelOptions() {
        if (!this.modelConfig) return;

        // 为每种分析类型填充模型选项
        const analysisTypes = ['psychology', 'quality', 'sales'];
        analysisTypes.forEach(type => {
            this.populateSpecificAnalysisModelOptions(type);
        });
    }

    /**
     * 填充特定分析类型的模型选项
     */
    populateSpecificAnalysisModelOptions(type) {
        const selectElement = document.getElementById(`${type}-model-select`);
        if (!selectElement) return;

        // 这里暂时使用所有可用模型，实际应该从分析配置中获取
        const models = this.modelConfig.getProviderModels();

        // 清空现有选项
        selectElement.innerHTML = '';

        models.forEach(model => {
            const option = document.createElement('option');
            option.value = model.id;
            option.textContent = model.name;
            selectElement.appendChild(option);

            // 同时为自定义选择器添加选项
            const customOption = document.createElement('span');
            customOption.className = 'custom-option';
            customOption.dataset.value = model.id;
            customOption.textContent = model.name;

            const customOptions = selectElement.parentElement.querySelector('.custom-options');
            if (customOptions) {
                customOptions.appendChild(customOption);
            }
        });

        // 设置默认选中项（暂时选择第一个）
        if (models.length > 0 && !selectElement.value) {
            selectElement.value = models[0].id;
        }

        // 更新自定义选择器UI
        const selectedModel = models.find(m => m.id === selectElement.value);
        this.updateCustomSelectUI(`${type}-model-select`, selectedModel ? selectedModel.name : '选择模型');
    }

    /**
     * 设置模型选择事件监听器
     */
    setupModelSelectionEventListeners() {
        if (!this.modelConfig) return;

        // 对话模型选择事件
        const chatProviderSelect = document.getElementById('chat-provider-select');
        const chatModelSelect = document.getElementById('chat-model-select');

        if (chatProviderSelect) {
            chatProviderSelect.addEventListener('change', (e) => {
                const providerId = e.target.value;
                if (this.modelConfig.switchProvider(providerId)) {
                    this.populateModelOptions();
                    this.updateChatServiceModel();
                    this.updateCurrentModelDisplay();
                }
            });
        }

        if (chatModelSelect) {
            chatModelSelect.addEventListener('change', (e) => {
                const modelId = e.target.value;
                if (this.modelConfig.switchModel(modelId)) {
                    this.updateChatServiceModel();
                    this.updateCurrentModelDisplay();
                }
            });
        }

        // 分析模型选择事件
        const analysisTypes = ['psychology', 'quality', 'sales'];
        analysisTypes.forEach(type => {
            const selectElement = document.getElementById(`${type}-model-select`);
            if (selectElement) {
                selectElement.addEventListener('change', (e) => {
                    this.updateAnalysisModelConfig(type, e.target.value);
                });
            }
        });
    }

    /**
     * 更新聊天服务模型配置
     */
    updateChatServiceModel() {
        if (this.chatService && this.modelConfig) {
            this.chatService.updateModelConfig(this.modelConfig);
        }
    }

    /**
     * 更新分析模型配置
     */
    updateAnalysisModelConfig(type, modelId) {
        // 更新分析管理器的模型配置
        if (this.uiManager && this.uiManager.selectionManager) {
            const config = {};
            config[`${type}Model`] = modelId;
            this.uiManager.selectionManager.updateAnalysisConfig(config);
        }
    }

    /**
     * 更新自定义选择器UI显示
     */
    updateCustomSelectUI(selectId, displayText) {
        const customSelect = document.querySelector(`#${selectId} + .custom-select .custom-select-trigger span`);
        if (customSelect) {
            customSelect.textContent = displayText;
        }
    }

    /**
     * 更新当前模型显示
     */
    updateCurrentModelDisplay() {
        if (!this.modelConfig) return;

        const currentModel = this.modelConfig.getCurrentModel();
        const currentProvider = this.modelConfig.getCurrentProvider();

        // 更新对话模型显示
        const currentChatModelElement = document.getElementById('current-chat-model');
        if (currentChatModelElement && currentProvider && currentModel) {
            currentChatModelElement.textContent = `${currentProvider.name} - ${currentModel.name}`;
        }

        // 更新分析模型显示（暂时显示为默认，后续需要从分析配置中获取实际配置）
        const analysisModelElements = ['psychology', 'quality', 'sales'].map(type =>
            document.getElementById(`current-${type}-model`)
        );

        analysisModelElements.forEach(element => {
            if (element && currentModel) {
                element.textContent = currentModel.name;
            }
        });
    }

    /**
     * 初始化自定义选择器功能
     */
    initializeCustomSelects() {
        if (this.headless) return;

        // 为每个自定义选择器添加事件监听器
        const customSelects = [
            'chat-provider-select',
            'chat-model-select',
            'psychology-model-select',
            'quality-model-select',
            'sales-model-select'
        ];

        customSelects.forEach(selectId => {
            this.initializeCustomSelect(selectId);
        });
    }

    /**
     * 初始化单个自定义选择器
     */
    initializeCustomSelect(selectId) {
        const selectElement = document.getElementById(selectId);
        if (!selectElement) return;

        const customSelect = selectElement.parentElement.querySelector('.custom-select');
        if (!customSelect) return;

        const selectTrigger = customSelect.querySelector('.custom-select-trigger');
        const options = customSelect.querySelectorAll('.custom-option');

        // 点击触发器切换选项显示
        selectTrigger.addEventListener('click', (e) => {
            e.stopPropagation();
            // 关闭其他所有自定义选择器
            document.querySelectorAll('.custom-select.open').forEach(cs => {
                if (cs !== customSelect) cs.classList.remove('open');
            });
            // 切换当前选择器
            customSelect.classList.toggle('open');
        });

        // 处理选项点击
        options.forEach(option => {
            option.addEventListener('click', (e) => {
                e.stopPropagation();

                // 更新选中状态
                customSelect.querySelectorAll('.custom-option').forEach(opt => opt.classList.remove('selected'));
                option.classList.add('selected');

                // 更新显示文本
                selectTrigger.querySelector('span').textContent = option.textContent;

                // 更新隐藏的select元素值
                selectElement.value = option.dataset.value;

                // 关闭选择器
                customSelect.classList.remove('open');

                // 触发change事件
                selectElement.dispatchEvent(new Event('change'));
            });
        });

        // 点击外部关闭选择器
        document.addEventListener('click', (e) => {
            if (!customSelect.contains(e.target)) {
                customSelect.classList.remove('open');
            }
        });
    }
}
