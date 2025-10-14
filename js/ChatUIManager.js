import { MessageSelectionManager } from './MessageSelectionManager.js';

export class ChatUIManager {
    constructor(options) {
        this.chatContainer = document.getElementById(options.chatContainerId);
        this.messageInput = document.getElementById(options.messageInputId);
        this.sendButton = document.getElementById(options.sendButtonId);
        this.clearChatButton = document.getElementById(options.clearChatButtonId);
        this.saveChatButton = document.getElementById(options.saveChatButtonId);
        this.loadChatButton = document.getElementById(options.loadChatButtonId);
        this.loadChatInput = document.getElementById(options.loadChatInputId);
        // Auto-response elements
        this.initialResponseInput = document.getElementById('initial-response');
        this.responsePromptInput = document.getElementById('response-prompt');
        this.autoResponseToggle = document.getElementById('auto-response-toggle');
        // Continuous-response elements
        this.continuousResponseToggle = document.getElementById('continuous-response-toggle');
        this.endConditionContainer = document.getElementById('end-condition-container');
        this.endConditionSelect = document.getElementById('end-condition-select');
        this.dialogueRoundLimitInput = document.getElementById('dialogue-round-limit-input');
        this.assistantRegexMatchInput = document.getElementById('assistant-regex-match-input');
        this.userRegexMatchInput = document.getElementById('user-regex-match-input');
        // Model and sampling controls (left toolbar)
        this.modelInput = document.getElementById('model-input');
        this.temperatureInput = document.getElementById('temperature-input');
        this.topPInput = document.getElementById('top-p-input');
        
        
        // Message selection state (managed by MessageSelectionManager)
        this.editingMessage = null;
        
        // Streaming state tracking
        this.streamingMessageIds = new Set();
        
        // Reference to chat instance (set by Chat class)
        this.chat = null;
        // Observer for external modifications to the system prompt DOM
        this.systemPromptObserver = null;
        this.systemPromptObservedElement = null;
        
        // Initialize message selection manager
        const infoPanel = document.getElementById('info-panel');
        console.log('[ChatUIManager] Initializing MessageSelectionManager:', {
            chatContainer: !!this.chatContainer,
            infoPanel: !!infoPanel,
            chatContainerId: this.chatContainer?.id,
            infoPanelId: infoPanel?.id
        });
        this.selectionManager = new MessageSelectionManager(this.chatContainer, infoPanel, this);
        console.log('[ChatUIManager] MessageSelectionManager initialized:', !!this.selectionManager);
        
        // Setup keyboard shortcut for reasoning content toggle
        this.setupReasoningToggleKeyboardShortcut();
    }

    renderMessages(conversation, systemPrompt, preserveScroll = false) {
        if (!this.chatContainer) return;

        console.log(`[ChatUIManager] renderMessages called with ${conversation.length} messages`);
        console.log(`[ChatUIManager] Conversation:`, conversation.map(m => ({
            id: m.id,
            role: m.role,
            content: m.content.substring(0, 30) + '...',
            hasReasoningContent: !!(m.reasoningContent && m.reasoningContent.trim()),
            reasoningContentLength: m.reasoningContent ? m.reasoningContent.length : 0
        })));
        
        // Add to debug panel
        if (typeof window.debug !== 'undefined') {
            window.debug.set('Rendering', 'messageCount', conversation.length);
            window.debug.set('Rendering', 'preserveScroll', preserveScroll);
            window.debug.set('Rendering', 'lastRender', new Date().toISOString());
        }

        const scrollTop = this.chatContainer.scrollTop;
        const scrollHeight = this.chatContainer.scrollHeight;
        const clientHeight = this.chatContainer.clientHeight;
        const isScrolledToBottom = scrollHeight - scrollTop <= clientHeight + 1;

        // Store the currently selected pair index to restore after re-rendering
        const selectedPair = this.selectionManager.getSelectedPair();
        const selectedPairIndex = selectedPair ?
            parseInt(selectedPair.dataset.pairIndex) : null;
        
        // Disconnect any existing system prompt observer before we clear DOM (it would otherwise observe removed nodes)
        if (this.systemPromptObserver) {
            try { this.systemPromptObserver.disconnect(); } catch (e) {}
            this.systemPromptObserver = null;
            this.systemPromptObservedElement = null;
        }
        
        this.chatContainer.innerHTML = '';

        // Render system prompt at the top
        if (systemPrompt) {
            const systemMessageElement = document.createElement('div');
            systemMessageElement.classList.add('message', 'system-prompt-message');
            
            const contentElement = document.createElement('span');
            contentElement.textContent = systemPrompt;
            contentElement.classList.add('system-prompt-message-inner')
            systemMessageElement.appendChild(contentElement);
 
            const actionsContainer = document.createElement('div');
            actionsContainer.classList.add('message-actions');
            const editButton = document.createElement('button');
            editButton.classList.add('edit-btn');
            editButton.title = '编辑';
            editButton.textContent = '编辑';
            actionsContainer.appendChild(editButton);
            systemMessageElement.appendChild(actionsContainer);
 
            this.chatContainer.appendChild(systemMessageElement);
 
            // Observe external modifications to the system prompt span and sync to ChatService
            try {
                if (this.systemPromptObserver) {
                    this.systemPromptObserver.disconnect();
                }
                this.systemPromptObservedElement = contentElement;
                this.systemPromptObserver = new MutationObserver((mutations) => {
                    for (const mutation of mutations) {
                        // Watch for character data or childList changes under the span
                        if (mutation.type === 'characterData' || mutation.type === 'childList') {
                            const newText = contentElement.textContent || '';
                            const current = this.chat && this.chat.chatService ? this.chat.chatService.getSystemPrompt() : '';
                            if ((current || '').trim() !== newText.trim()) {
                                console.log('[ChatUIManager] Detected external change to system prompt DOM. Updating ChatService.');
                                try {
                                    if (this.chat && this.chat.chatService && typeof this.chat.chatService.setSystemPrompt === 'function') {
                                        this.chat.chatService.setSystemPrompt(newText);
                                    }
                                } catch (e) {
                                    console.error('[ChatUIManager] Failed to update ChatService.systemPrompt from DOM change', e);
                                }
                            }
                        }
                    }
                });
 
                this.systemPromptObserver.observe(contentElement, { characterData: true, childList: true, subtree: true });
            } catch (e) {
                console.warn('[ChatUIManager] Could not set up system prompt observer', e);
            }
        }

        const messagesToRender = conversation.filter(msg => msg.role !== 'system');
        console.log(`[ChatUIManager] Messages to render (excluding system): ${messagesToRender.length}`);

        // Group messages into pairs (user-assistant pairs) - more robust logic
        const pairs = [];
        let i = 0;
        
        while (i < messagesToRender.length) {
            const currentMsg = messagesToRender[i];
            
            if (currentMsg.role === 'user') {
                // This is a user message, look for next assistant message
                const nextMsg = i + 1 < messagesToRender.length ? messagesToRender[i + 1] : null;
                
                pairs.push({
                    user: currentMsg,
                    assistant: nextMsg && nextMsg.role === 'assistant' ? nextMsg : null
                });
                
                // Skip the assistant message if we paired it
                i += (nextMsg && nextMsg.role === 'assistant') ? 2 : 1;
            } else if (currentMsg.role === 'assistant') {
                // This is an orphaned assistant message (shouldn't happen after repairConversationStructure)
                // Put it in its own pair for visibility
                console.warn(`[ChatUIManager] Found orphaned assistant message during render:`, currentMsg);
                pairs.push({
                    user: null,
                    assistant: currentMsg
                });
                i += 1;
            } else {
                // Other message types - skip for now
                i += 1;
            }
        }
        
        console.log(`[ChatUIManager] Created ${pairs.length} pairs for rendering`);
        
        // Add to debug panel
        if (typeof window.debug !== 'undefined') {
            window.debug.set('Rendering', 'pairsCount', pairs.length);
            window.debug.set('Rendering', 'messagesToRender', messagesToRender.length);
        }

        // Render pairs
        pairs.forEach((pair, pairIndex) => {
            const pairElement = document.createElement('div');
            pairElement.classList.add('message-pair');
            pairElement.dataset.pairIndex = pairIndex;
            
            console.log(`[ChatUIManager] Rendering pair ${pairIndex}:`, {
                user: pair.user ? { id: pair.user.id, role: pair.user.role } : null,
                assistant: pair.assistant ? { id: pair.assistant.id, role: pair.assistant.role } : null
            });

            // Render user message if exists
            if (pair.user) {
                const userMessageElement = this.createMessageElement(pair.user, 'user');
                pairElement.appendChild(userMessageElement);
            }

            // Render assistant message if exists
            if (pair.assistant) {
                const assistantMessageElement = this.createMessageElement(pair.assistant, 'assistant');
                pairElement.appendChild(assistantMessageElement);
            }

            this.chatContainer.appendChild(pairElement);

            // Selection is now handled by MessageSelectionManager
            // No need to restore selection here as it will be re-established when needed
        });

        if (preserveScroll) {
            this.chatContainer.scrollTop = scrollTop;
            console.log(`[ChatUIManager] Preserved scroll position: ${scrollTop}`);
        } else if (isScrolledToBottom) {
            this.chatContainer.scrollTop = this.chatContainer.scrollHeight;
            console.log(`[ChatUIManager] Scrolled to bottom after render`);
        }
        
        console.log(`[ChatUIManager] Render completed. Total elements in container: ${this.chatContainer.children.length}`);
        
        // Add to debug panel
        if (typeof window.debug !== 'undefined') {
            window.debug.set('Rendering', 'domElements', this.chatContainer.children.length);
            window.debug.set('Rendering', 'scrollPreserved', preserveScroll);
        }
        
        // Consistency check: if we have significantly different DOM elements than expected,
        // log a warning to help with debugging
        const expectedMessageElements = conversation.filter(msg => msg.role !== 'system').length;
        const actualMessageElements = this.chatContainer.querySelectorAll('.message').length;
        
        if (Math.abs(expectedMessageElements - actualMessageElements) > 2) {
            console.warn(`[ChatUIManager] Rendering inconsistency detected! Expected ~${expectedMessageElements} message elements, got ${actualMessageElements}`);
            
            if (typeof window.debug !== 'undefined') {
                window.debug.set('Rendering', 'inconsistencyDetected', true);
                window.debug.set('Rendering', 'expectedMessages', expectedMessageElements);
                window.debug.set('Rendering', 'actualMessages', actualMessageElements);
            }
        }
    }

    createMessageElement(msg, role) {
        const messageElement = document.createElement('div');
        messageElement.classList.add('message', role === 'user' ? 'user-message' : 'bot-message');
        
        // Add streaming class if message is currently streaming
        if (this.isMessageStreaming(msg.id)) {
            messageElement.classList.add('streaming');
        }
        
        messageElement.dataset.id = msg.id;
        messageElement.dataset.role = role;
        
        // Create reasoning content element if present
        if (msg.reasoningContent && msg.reasoningContent.trim()) {
            console.log(`[ChatUIManager] Creating reasoning content for message ${msg.id} (${role}):`, {
                reasoningContentLength: msg.reasoningContent.length,
                reasoningContentPreview: msg.reasoningContent.substring(0, 100) + '...'
            });
            
            const reasoningElement = document.createElement('div');
            reasoningElement.classList.add('reasoning-content');
            
            // Create a wrapper for the original content
            const originalContent = document.createElement('span');
            originalContent.classList.add('original-content');
            originalContent.textContent = msg.reasoningContent;
            reasoningElement.appendChild(originalContent);
            
            messageElement.appendChild(reasoningElement);
            
            // Add separator line
            const separator = document.createElement('hr');
            separator.classList.add('reasoning-separator');
            messageElement.appendChild(separator);
        } else {
            console.log(`[ChatUIManager] No reasoning content for message ${msg.id} (${role})`);
        }
        
        const contentElement = document.createElement('span');
        contentElement.classList.add('message-content');
        contentElement.textContent = msg.content;
        messageElement.appendChild(contentElement);

        const actionsContainer = document.createElement('div');
        actionsContainer.classList.add('message-actions');

        const editButton = document.createElement('button');
        editButton.classList.add('edit-btn');
        editButton.title = '编辑';
        editButton.textContent = '编辑';
        actionsContainer.appendChild(editButton);

        const deleteButton = document.createElement('button');
        deleteButton.classList.add('delete-btn');
        deleteButton.title = '删除';
        deleteButton.textContent = '删除';
        actionsContainer.appendChild(deleteButton);

        if (role === 'user') {
            const regenButton = document.createElement('button');
            regenButton.classList.add('regen-btn');
            regenButton.title = '重新生成回复';
            regenButton.textContent = '重新生成';
            actionsContainer.appendChild(regenButton);
        }
        
        messageElement.appendChild(actionsContainer);

        return messageElement;
    }
    
    /**
     * Update message content during streaming
     */
    updateMessageContent(messageElement, content, reasoningContent) {
        // Update or create reasoning content
        let reasoningElement = messageElement.querySelector('.reasoning-content');
        let separator = messageElement.querySelector('.reasoning-separator');
        
        if (reasoningContent && reasoningContent.trim()) {
            if (!reasoningElement) {
                reasoningElement = document.createElement('div');
                reasoningElement.classList.add('reasoning-content');
                messageElement.insertBefore(reasoningElement, messageElement.querySelector('.message-content'));
                
                separator = document.createElement('hr');
                separator.classList.add('reasoning-separator');
                messageElement.insertBefore(separator, messageElement.querySelector('.message-content'));
            }
            
            // Update the original content span
            let originalContent = reasoningElement.querySelector('.original-content');
            if (!originalContent) {
                originalContent = document.createElement('span');
                originalContent.classList.add('original-content');
                reasoningElement.appendChild(originalContent);
            }
            originalContent.textContent = reasoningContent;
        } else if (reasoningElement) {
            reasoningElement.remove();
            if (separator) separator.remove();
        }
        
        // Update main content
        const contentElement = messageElement.querySelector('.message-content');
        if (contentElement) {
            contentElement.textContent = content;
        }
    }

    // Selection methods are now handled by MessageSelectionManager
    
    /**
     * Check if a message is currently streaming
     */
    isMessageStreaming(messageId) {
        return this.streamingMessageIds.has(messageId);
    }
    
    /**
     * Mark a message as streaming
     */
    markMessageAsStreaming(messageId) {
        this.streamingMessageIds.add(messageId);
        console.log(`[ChatUIManager] Marked message ${messageId} as streaming. Total streaming: ${this.streamingMessageIds.size}`);
        
        // Add streaming class to DOM element if it exists
        const messageElement = this.chatContainer.querySelector(`.message[data-id='${messageId}']`);
        if (messageElement) {
            messageElement.classList.add('streaming');
            console.log(`[ChatUIManager] Added streaming class to message element ${messageId}`);
        } else {
            console.warn(`[ChatUIManager] Could not find message element ${messageId} to mark as streaming`);
        }
    }
    
    /**
     * Mark a message as finished streaming
     */
    markMessageAsFinishedStreaming(messageId) {
        this.streamingMessageIds.delete(messageId);
        console.log(`[ChatUIManager] Marked message ${messageId} as finished streaming. Total streaming: ${this.streamingMessageIds.size}`);
        
        // Remove streaming class from DOM element if it exists
        const messageElement = this.chatContainer.querySelector(`.message[data-id='${messageId}']`);
        if (messageElement) {
            messageElement.classList.remove('streaming');
            console.log(`[ChatUIManager] Removed streaming class from message element ${messageId}`);
        }
    }
    
    /**
     * Clear all streaming markers
     */
    clearAllStreamingMarkers() {
        this.streamingMessageIds.clear();
        console.log(`[ChatUIManager] Cleared all streaming markers`);
        
        // Remove streaming class from all DOM elements
        const streamingElements = this.chatContainer.querySelectorAll('.message.streaming');
        streamingElements.forEach(element => {
            element.classList.remove('streaming');
        });
    }

    // Selection methods are now handled by MessageSelectionManager

    updateSendButtonState(isContinuousResponding, isAutoResponding, isGenerating, isContinuousResponseEnabled, isAutoResponseEnabled) {
        if (!this.sendButton) return;

        this.sendButton.classList.remove('autosend-mode', 'halt-auto-mode', 'halt-mode', 'continuous-mode', 'halt-continuous-mode');
        this.messageInput.disabled = isAutoResponseEnabled || isGenerating || isAutoResponding || isContinuousResponding;

        if (isContinuousResponding) {
            this.sendButton.textContent = '停止连续对话';
            this.sendButton.classList.add('halt-continuous-mode');
        } else if (isAutoResponding) {
            this.sendButton.textContent = '停止攥写';
            this.sendButton.classList.add('halt-auto-mode');
        } else if (isGenerating) {
            this.sendButton.textContent = '停止';
            this.sendButton.classList.add('halt-mode');
        } else if (isContinuousResponseEnabled) {
            this.sendButton.textContent = '连续自动';
            this.sendButton.classList.add('continuous-mode');
        } else if (isAutoResponseEnabled) {
            this.sendButton.textContent = '自动发送';
            this.sendButton.classList.add('autosend-mode');
        } else {
            this.sendButton.textContent = '发送';
        }
    }

    editSystemPrompt(messageElement, originalContent, saveCallback) {
        const contentSpan = messageElement.querySelector('span');
        // Disconnect the system prompt observer while editing to avoid reacting to our own changes
        if (this.systemPromptObserver) {
            try { this.systemPromptObserver.disconnect(); } catch (e) {}
            this.systemPromptObserver = null;
            this.systemPromptObservedElement = null;
        }
        const originalWidth = messageElement.offsetWidth;
 
        const editArea = document.createElement('textarea');
        editArea.value = originalContent;
        editArea.classList.add('editing-textarea');
        editArea.style.width = `${originalWidth}px`;
 
        messageElement.replaceChild(editArea, contentSpan);
        messageElement.classList.add('editing');
        this.editingMessage = messageElement;
        editArea.focus();
        editArea.style.height = 'auto';
        editArea.style.height = (editArea.scrollHeight) + 'px';
 
        editArea.addEventListener('input', () => {
            editArea.style.height = 'auto';
            editArea.style.height = editArea.scrollHeight + 'px';
        });
 
        const saveChanges = () => {
            const newContent = editArea.value.trim();
            messageElement.classList.remove('editing');
            this.editingMessage = null;
            saveCallback(newContent);
        };
 
        editArea.addEventListener('blur', saveChanges);
        editArea.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                editArea.blur();
            } else if (e.key === 'Escape') {
                editArea.value = originalContent;
                editArea.blur();
            }
        });
    }

    editMessage(messageElement, originalContent, saveCallback) {
        const contentSpan = messageElement.querySelector('.message-content');
        const originalWidth = messageElement.offsetWidth;

        const editArea = document.createElement('textarea');
        editArea.value = originalContent;
        editArea.classList.add('editing-textarea');
        editArea.style.width = `${originalWidth}px`;

        messageElement.replaceChild(editArea, contentSpan);
        messageElement.classList.add('editing');
        this.editingMessage = messageElement;
        editArea.focus();
        editArea.style.height = 'auto';
        editArea.style.height = editArea.scrollHeight + 'px';

        editArea.addEventListener('input', () => {
            editArea.style.height = 'auto';
            editArea.style.height = editArea.scrollHeight + 'px';
        });

        const saveChanges = () => {
            const newContent = editArea.value.trim();
            messageElement.classList.remove('editing');
            this.editingMessage = null;
            saveCallback(newContent);
        };

        editArea.addEventListener('blur', saveChanges);
        editArea.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                editArea.blur();
            } else if (e.key === 'Escape') {
                editArea.value = originalContent;
                editArea.blur();
            }
        });
    }
    
    /**
     * Toggle reasoning content visibility
     */
    toggleReasoningContent() {
        const reasoningElements = this.chatContainer.querySelectorAll('.reasoning-content');
        const hasHiddenContent = Array.from(reasoningElements).some(el => el.classList.contains('hidden'));
        
        reasoningElements.forEach(element => {
            if (hasHiddenContent) {
                // Show all reasoning content
                element.classList.remove('hidden');
            } else {
                // Hide all reasoning content
                element.classList.add('hidden');
            }
        });
        
        return !hasHiddenContent; // Return new visibility state
    }
    
    /**
     * Setup keyboard event listener for reasoning content toggle
     */
    setupReasoningToggleKeyboardShortcut() {
        document.addEventListener('keydown', (e) => {
            // Check for Option+H (macOS) or Alt+H (Windows/Linux)
            // Use both 'h' and 'H' to handle case sensitivity, and keycode 72 for 'H'
            if ((e.altKey || e.metaKey) && (e.key === 'h' || e.key === 'H' || e.keyCode === 72)) {
                e.preventDefault();
                this.toggleReasoningContent();
            }
        });
    }
}