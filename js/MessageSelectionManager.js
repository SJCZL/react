import { AnalysisManager } from './analysis/AnalysisManager.js';
import { AnalysisUIRenderer } from './analysis/AnalysisUIRenderer.js';
import { ANALYSIS_CONFIG } from './analysis/AnalysisConfig.js';

export class MessageSelectionManager {
    constructor(chatContainer, infoPanel, chatUIManager) {
        console.log('[MessageSelectionManager] Constructor called with:', {
            chatContainer: !!chatContainer,
            infoPanel: !!infoPanel,
            chatUIManager: !!chatUIManager
        });
        
        this.chatContainer = chatContainer;
        this.infoPanel = infoPanel;
        this.chatUIManager = chatUIManager;
        
        // Selection state
        this.selectedPair = null;
        this.selectedMessage = null;
        
        // Analysis system
        this.analysisManager = null;
        this.uiRenderer = new AnalysisUIRenderer();
        
        // Event handlers
        this.handleClick = this.handleClick.bind(this);
        this.handleKeyDown = this.handleKeyDown.bind(this);
        this.handleKeyboardShortcut = this.handleKeyboardShortcut.bind(this);
        
        // Initialize
        this.setupEventListeners();
        
        console.log('[MessageSelectionManager] Constructor completed');
    }
    
    setupEventListeners() {
        console.log('[MessageSelectionManager] Setting up event listeners');
        
        // Handle clicks on the chat container
        this.chatContainer.addEventListener('click', this.handleClick);
        
        // Handle keyboard navigation
        document.addEventListener('keydown', this.handleKeyDown);
        
        // Handle analysis keyboard shortcuts
        document.addEventListener('keydown', this.handleKeyboardShortcut);
        
        console.log('[MessageSelectionManager] Event listeners setup completed');
    }
    
    /**
     * Initialize the analysis manager with API key and configuration
     */
    initializeAnalysis(apiKey, config = {}) {
        this.analysisManager = new AnalysisManager(apiKey, config);
        
        // Set up analysis event callbacks
        this.analysisManager.on('onAnalysisStart', (data) => {
            this.updateAnalysisDisplay(data.messageId);
        });
        
        this.analysisManager.on('onAnalysisProgress', (data) => {
            this.updateAnalysisDisplay(data.messageId);
        });
        
        this.analysisManager.on('onAnalysisComplete', (data) => {
            this.updateAnalysisDisplay(data.messageId);
        });
        
        this.analysisManager.on('onAnalysisError', (data) => {
            this.updateAnalysisDisplay(data.messageId);
        });
        
        console.log('[MessageSelectionManager] Analysis manager initialized');
    }
    
    /**
     * Update analysis configuration
     */
    updateAnalysisConfig(config) {
        if (this.analysisManager) {
            this.analysisManager.updateConfig(config);
        }
    }
    
    handleClick(event) {
        // Handle clicks on chat container blank space
        if (event.target === this.chatContainer) {
            this.deselectAll();
            return;
        }
        
        // Handle clicks on message pair blank space (within pair but not on message)
        const messagePair = event.target.closest('.message-pair');
        if (messagePair && !event.target.closest('.message')) {
            // Don't deselect if clicking on currently selected pair
            if (messagePair !== this.selectedPair) {
                this.deselectAll();
            }
            return;
        }
        
        // Handle clicks on message elements
        const messageElement = event.target.closest('.message');
        if (messageElement) {
            // Don't select if clicking on action buttons
            if (event.target.closest('.message-actions')) {
                return;
            }
            
            // Don't select system prompt messages
            if (messageElement.classList.contains('system-prompt-message')) {
                return;
            }
            
            // Don't select if message is under construction
            if (this.isMessageUnderConstruction(messageElement)) {
                return;
            }
            
            this.selectMessage(messageElement);
        }
    }
    
    handleKeyDown(event) {
        if (!this.selectedMessage) return;
        
        const selectableMessages = this.getAllSelectableMessages();
        if (selectableMessages.length === 0) return;
        
        const currentIndex = selectableMessages.indexOf(this.selectedMessage);
        let newIndex = currentIndex;
        
        switch (event.key) {
            case 'ArrowUp':
                event.preventDefault();
                newIndex = currentIndex > 0 ? currentIndex - 1 : selectableMessages.length - 1;
                break;
            case 'ArrowDown':
                event.preventDefault();
                newIndex = currentIndex < selectableMessages.length - 1 ? currentIndex + 1 : 0;
                break;
        }
        
        if (newIndex !== currentIndex) {
            this.selectMessage(selectableMessages[newIndex]);
        }
    }
    
    selectMessage(messageElement) {
        if (!messageElement) return;
        
        // Deselect previous selection
        this.deselectAll();
        
        // Find the pair containing this message
        const messagePair = messageElement.closest('.message-pair');
        
        // Select the pair if it exists
        if (messagePair) {
            messagePair.classList.add('selected');
            this.selectedPair = messagePair;
        }
        
        // Select the specific message
        messageElement.classList.add('selected');
        this.selectedMessage = messageElement;
        
        // Show info panel
        this.showInfoPanel(messageElement);
        
        // Update debug overlay
        this.updateDebugOverlay();
    }
    
    deselectAll() {
        // Remove visual selection
        if (this.selectedPair) {
            this.selectedPair.classList.remove('selected');
            this.selectedPair = null;
        }
        
        if (this.selectedMessage) {
            this.selectedMessage.classList.remove('selected');
            this.selectedMessage = null;
        }
        
        // Hide info panel
        this.hideInfoPanel();
        
        // Update debug overlay
        this.updateDebugOverlay();
    }
    
    getAllSelectableMessages() {
        const allMessages = Array.from(this.chatContainer.querySelectorAll('.message:not(.system-prompt-message)'));
        return allMessages.filter(msg => !this.isMessageUnderConstruction(msg));
    }
    
    isMessageUnderConstruction(messageElement) {
        // Check if message has streaming class (for actual streaming)
        if (messageElement.classList.contains('streaming')) {
            return true;
        }
        
        // Check if message is in countdown state (before streaming)
        const messageId = parseInt(messageElement.dataset.id, 10);
        if (this.chatUIManager && this.chatUIManager.isMessageStreaming) {
            return this.chatUIManager.isMessageStreaming(messageId);
        }
        
        return false;
    }
    
    showInfoPanel(messageElement) {
        if (!this.infoPanel) return;
        
        const messageData = this.getMessageDataFromElement(messageElement);
        if (!messageData) return;
        
        this.infoPanel.classList.remove('info-panel-hidden');
        this.infoPanel.classList.add('info-panel-visible');
        
        // Update message info content with analysis
        const messageInfo = this.infoPanel.querySelector('#message-info');
        if (messageInfo) {
            this.updateMessageInfoWithAnalysis(messageInfo, messageData);
        }
        
        // Adjust chat container padding
        this.chatContainer.style.paddingLeft = 'calc(33.333% + 40px)';
    }
    
    hideInfoPanel() {
        if (!this.infoPanel) return;
        
        this.infoPanel.classList.remove('info-panel-visible');
        this.infoPanel.classList.add('info-panel-hidden');
        
        // Reset chat container padding
        this.chatContainer.style.paddingLeft = '20px';
        
        // Clear message info
        const messageInfo = this.infoPanel.querySelector('#message-info');
        if (messageInfo) {
            messageInfo.innerHTML = '<p>选择一个消息以查看详细信息</p>';
        }
    }
    
    getMessageDataFromElement(messageElement) {
        const content = messageElement.querySelector('.message-content, span')?.textContent || messageElement.textContent;
        const role = messageElement.classList.contains('user-message') ? 'user' : 
                    messageElement.classList.contains('bot-message') ? 'assistant' : null;
        const messageId = messageElement.dataset.id;
        
        if (content && role) {
            return { content, role, messageId };
        }
        return null;
    }
    
    updateMessageInfo(messageInfoElement, messageData) {
        const roleText = messageData.role === 'user' ? '用户' : '助手';
        
        messageInfoElement.innerHTML = `
            <div class="message-detail">
                <strong>角色:</strong> ${roleText}
            </div>
            <div class="message-detail">
                <strong>内容长度:</strong> ${messageData.content.length} 字符
            </div>
            <div class="message-detail">
                <strong>消息ID:</strong> ${messageData.messageId}
            </div>
            <div class="message-detail">
                <strong>预览:</strong>
                <div class="message-preview">${messageData.content.substring(0, 100)}${messageData.content.length > 100 ? '...' : ''}</div>
            </div>
        `;
    }
    
    updateDebugOverlay() {
        if (typeof window.debug !== 'undefined') {
            if (this.selectedPair) {
                const pairIndex = this.selectedPair.dataset.pairIndex;
                const userMessage = this.selectedPair.querySelector('.user-message');
                const assistantMessage = this.selectedPair.querySelector('.bot-message');
                
                window.debug.set('Selection', 'pairIndex', parseInt(pairIndex));
                window.debug.set('Selection', 'hasUser', !!userMessage);
                window.debug.set('Selection', 'hasAssistant', !!assistantMessage);
                
                if (userMessage) {
                    const userContent = userMessage.querySelector('.message-content')?.textContent || '';
                    window.debug.set('Selection', 'userMessage', userContent.substring(0, 50) + (userContent.length > 50 ? '...' : ''));
                }
                
                if (assistantMessage) {
                    const assistantContent = assistantMessage.querySelector('.message-content')?.textContent || '';
                    window.debug.set('Selection', 'assistantMessage', assistantContent.substring(0, 50) + (assistantContent.length > 50 ? '...' : ''));
                }
            } else {
                window.debug.set('Selection', 'pairIndex', null);
                window.debug.set('Selection', 'hasUser', null);
                window.debug.set('Selection', 'hasAssistant', null);
                window.debug.set('Selection', 'userMessage', null);
                window.debug.set('Selection', 'assistantMessage', null);
            }
        }
    }
    
    // Public methods for external integration
    getSelectedPair() {
        return this.selectedPair;
    }
    
    getSelectedMessage() {
        return this.selectedMessage;
    }
    
    hasSelection() {
        return this.selectedMessage !== null;
    }
    
    // Handle action button clicks (should be called by action handlers)
    handleActionButtonClick() {
        this.deselectAll();
    }
    
    /**
     * Handle keyboard shortcuts for analysis
     */
    handleKeyboardShortcut(event) {
        // Alt + R or Option + R: Start/force regenerate analysis for selected message
        if (event.altKey && event.keyCode === 82) {
            console.log('[MessageSelectionManager] Alt+R/Option+R detected, regenerating analysis...');
            console.log('[MessageSelectionManager] Event details:', {
                altKey: event.altKey,
                keyCode: event.keyCode,
                key: event.key,
                code: event.code
            });
            event.preventDefault();
            this.regenerateAnalysis();
        }
    }
    
    /**
     * Update message info with analysis display
     */
    updateMessageInfoWithAnalysis(messageInfoElement, messageData) {
        if (!this.analysisManager) {
            // Fallback to basic message info if analysis manager is not available
            this.updateMessageInfo(messageInfoElement, messageData);
            return;
        }
        
        const messageId = parseInt(messageData.messageId);
        const messageInfo = this.analysisManager.getMessageInfo(messageId);
        
        // Render analysis using the UI renderer
        this.uiRenderer.renderAnalysis(messageInfo, messageInfoElement);
    }
    
    /**
     * Update analysis display for a specific message
     */
    updateAnalysisDisplay(messageId) {
        if (!this.selectedMessage || !this.analysisManager) return;
        
        const selectedMessageId = parseInt(this.selectedMessage.dataset.id);
        if (selectedMessageId === messageId) {
            const messageInfo = this.analysisManager.getMessageInfo(messageId);
            const messageInfoElement = this.infoPanel.querySelector('#message-info');
            if (messageInfoElement) {
                this.uiRenderer.updateAnalysisState(messageInfo, messageInfoElement);
            }
        }
    }
    
    /**
     * Clear analysis data for a specific message
     */
    clearAnalysisData(messageId) {
        if (!this.analysisManager) return;
        
        // Cancel any ongoing analysis
        this.analysisManager.cancelAnalysis(messageId);
        
        // Get the message info and reset analysis data
        const messageInfo = this.analysisManager.getMessageInfo(messageId);
        if (messageInfo) {
            // Reset all analysis data
            messageInfo.customerPsychology = null;
            messageInfo.messageQuality = null;
            messageInfo.salesPerformance = null;
            messageInfo.analysisState = ANALYSIS_CONFIG.ANALYSIS_STATE.PENDING;
            messageInfo.error = null;
            messageInfo.lastUpdated = new Date().toISOString();
        }
        
        // Force immediate UI refresh if this is the currently selected message
        if (this.selectedMessage && parseInt(this.selectedMessage.dataset.id) === messageId) {
            const messageInfoElement = this.infoPanel.querySelector('#message-info');
            if (messageInfoElement && messageInfo) {
                this.uiRenderer.renderAnalysis(messageInfo, messageInfoElement);
            }
        }
        
        console.log(`[MessageSelectionManager] Cleared analysis data for message ${messageId}`);
    }
    
    /**
     * Regenerate analysis for the selected message
     */
    async regenerateAnalysis() {
        console.log('[MessageSelectionManager] regenerateAnalysis called:', {
            selectedMessage: !!this.selectedMessage,
            analysisManager: !!this.analysisManager
        });
        
        if (!this.selectedMessage || !this.analysisManager) {
            console.log('[MessageSelectionManager] Cannot regenerate analysis - missing required components');
            return;
        }
        
        const messageId = parseInt(this.selectedMessage.dataset.id);
        const messageData = this.getMessageDataFromElement(this.selectedMessage);
        
        if (!messageData) return;
        
        try {
            // Clear existing analysis data immediately
            this.clearAnalysisData(messageId);
            
            // Set message state to GENERATING immediately
            const messageInfo = this.analysisManager.getMessageInfo(messageId);
            if (messageInfo) {
                messageInfo.analysisState = ANALYSIS_CONFIG.ANALYSIS_STATE.GENERATING;
                
                // Force immediate UI refresh to show generating state
                const messageInfoElement = this.infoPanel.querySelector('#message-info');
                if (messageInfoElement) {
                    this.uiRenderer.renderAnalysis(messageInfo, messageInfoElement);
                }
            }
            
            // Get conversation context
            const conversation = this.getConversationContext();
            const systemPrompt = this.getSystemPrompt();
            
            // Find the current message in conversation
            const currentMessage = conversation.find(msg => msg.id === messageId);
            if (!currentMessage) return;
            
            // Get previous messages for context
            const messageIndex = conversation.findIndex(msg => msg.id === messageId);
            const previousMessages = conversation.slice(0, messageIndex);
            
            // Force regenerate analysis
            await this.analysisManager.analyzeMessage(
                messageId,
                systemPrompt,
                previousMessages,
                currentMessage,
                true // force = true
            );
            
        } catch (error) {
            console.error('Failed to regenerate analysis:', error);
        }
    }
    
    /**
     * Get conversation context for analysis
     */
    getConversationContext() {
        if (this.chatUIManager && this.chatUIManager.chat) {
            return this.chatUIManager.chat.chatService.getConversation();
        }
        return [];
    }
    
    /**
     * Get system prompt for analysis
     */
    getSystemPrompt() {
        if (this.chatUIManager && this.chatUIManager.chat) {
            return this.chatUIManager.chat.chatService.getSystemPrompt();
        }
        return '';
    }
    
    /**
     * Auto-generate analysis for a message (called when message is completed)
     */
    async autoGenerateAnalysis(messageId, autoGenerate = true) {
        if (!this.analysisManager) return;
        
        // Check if auto-analysis is enabled
        if (!autoGenerate) return;
        
        try {
            const conversation = this.getConversationContext();
            const systemPrompt = this.getSystemPrompt();
            
            // Find the message in conversation
            const currentMessage = conversation.find(msg => msg.id === messageId);
            if (!currentMessage) return;
            
            // Get previous messages for context
            const messageIndex = conversation.findIndex(msg => msg.id === messageId);
            const previousMessages = conversation.slice(0, messageIndex);
            
            // Start analysis (don't force if already exists)
            await this.analysisManager.analyzeMessage(
                messageId,
                systemPrompt,
                previousMessages,
                currentMessage,
                false // force = false
            );
            
        } catch (error) {
            console.error('Failed to auto-generate analysis:', error);
        }
    }
}