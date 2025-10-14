import { CustomerPsychologyService } from './CustomerPsychologyService.js';
import { MessageQualityService } from './MessageQualityService.js';
import { SalesPerformanceService } from './SalesPerformanceService.js';
import { ExtendedMessageInfo, ANALYSIS_CONFIG } from './AnalysisConfig.js';

/**
 * Main Analysis Manager
 * Coordinates all analysis services and manages analysis state
 */
export class AnalysisManager {
    constructor(apiKey, config = {}) {
        this.apiKey = apiKey;
        this.config = { ...ANALYSIS_CONFIG.DEFAULT_SETTINGS, ...config };
        
        // Override autoGenerate if provided
        if (config.autoGenerate !== undefined) {
            this.config.autoGenerate = config.autoGenerate;
        }
        
        // Analysis services
        this.customerPsychologyService = new CustomerPsychologyService(
            apiKey, 
            this.config.customerPsychologyModel, 
            this.config.analysisTemperature
        );
        
        this.messageQualityService = new MessageQualityService(
            apiKey, 
            this.config.messageQualityModel, 
            this.config.analysisTemperature
        );
        
        this.salesPerformanceService = new SalesPerformanceService(
            apiKey, 
            this.config.salesPerformanceModel, 
            this.config.analysisTemperature
        );
        
        // Extended message info storage
        this.extendedMessageInfo = new Map(); // messageId -> ExtendedMessageInfo
        
        // Active analysis tracking
        this.activeAnalyses = new Map(); // messageId -> AbortController
        
        // Event callbacks
        this.callbacks = {
            onAnalysisStart: null,
            onAnalysisProgress: null,
            onAnalysisComplete: null,
            onAnalysisError: null
        };
    }

    /**
     * Update configuration
     */
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };

        // Update service configurations if models are provided
        if (newConfig.customerPsychologyModel) {
            this.customerPsychologyService.model = newConfig.customerPsychologyModel;
        }
        if (newConfig.messageQualityModel) {
            this.messageQualityService.model = newConfig.messageQualityModel;
        }
        if (newConfig.salesPerformanceModel) {
            this.salesPerformanceService.model = newConfig.salesPerformanceModel;
        }

        // Update temperature for all services
        if (newConfig.analysisTemperature !== undefined) {
            this.customerPsychologyService.temperature = newConfig.analysisTemperature;
            this.messageQualityService.temperature = newConfig.analysisTemperature;
            this.salesPerformanceService.temperature = newConfig.analysisTemperature;
        }
    }

    /**
     * Get current model configuration for analysis services
     */
    getModelConfig() {
        return {
            customerPsychologyModel: this.config.customerPsychologyModel,
            messageQualityModel: this.config.messageQualityModel,
            salesPerformanceModel: this.config.salesPerformanceModel,
            analysisTemperature: this.config.analysisTemperature
        };
    }

    /**
     * Update specific analysis model
     */
    updateAnalysisModel(type, modelId) {
        const config = {};
        config[`${type}Model`] = modelId;
        this.updateConfig(config);
    }

    /**
     * Analyze a message based on its role
     */
    async analyzeMessage(messageId, systemPrompt, conversationHistory, currentMessage, force = false) {
        // Get or create extended message info
        let messageInfo = this.extendedMessageInfo.get(messageId);
        if (!messageInfo) {
            messageInfo = new ExtendedMessageInfo(messageId);
            this.extendedMessageInfo.set(messageId, messageInfo);
        }
        
        // Skip if already completed and not forced
        if (messageInfo.analysisState === ANALYSIS_CONFIG.ANALYSIS_STATE.COMPLETED && !force) {
            return messageInfo;
        }
        
        // Cancel any existing analysis for this message
        if (this.activeAnalyses.has(messageId)) {
            this.cancelAnalysis(messageId);
        }
        
        // Set up abort controller
        const abortController = new AbortController();
        this.activeAnalyses.set(messageId, abortController);
        
        try {
            this.updateMessageState(messageId, ANALYSIS_CONFIG.ANALYSIS_STATE.GENERATING);
            this.triggerCallback('onAnalysisStart', { messageId, messageInfo });
            
            // Analyze based on message role
            if (currentMessage.role === 'assistant') {
                // Customer message - analyze psychology and quality
                await this.analyzeCustomerMessage(messageInfo, systemPrompt, conversationHistory, currentMessage);
            } else if (currentMessage.role === 'user') {
                // Sales rep message - analyze performance
                await this.analyzeSalesMessage(messageInfo, systemPrompt, conversationHistory, currentMessage);
            }
            
            this.updateMessageState(messageId, ANALYSIS_CONFIG.ANALYSIS_STATE.COMPLETED);
            this.triggerCallback('onAnalysisComplete', { messageId, messageInfo });
            
            return messageInfo;
            
        } catch (error) {
            console.error(`Analysis failed for message ${messageId}:`, error);
            
            this.updateMessageState(messageId, ANALYSIS_CONFIG.ANALYSIS_STATE.ERROR);
            messageInfo.error = error.message;
            
            this.triggerCallback('onAnalysisError', { messageId, messageInfo, error });
            
            // Auto-reanalysis on error
            if (this.config.autoReanalysisOnerror !== false) {
                console.log(`[AnalysisManager] Auto-reanalyzing message ${messageId} after error...`);
                setTimeout(async () => {
                    try {
                        await this.analyzeMessage(
                            messageId,
                            systemPrompt,
                            conversationHistory,
                            currentMessage,
                            true // force = true
                        );
                    } catch (retryError) {
                        console.error(`Auto-reanalysis failed for message ${messageId}:`, retryError);
                    }
                }, 2000); // Wait 2 seconds before retry
            }
            
            throw error;
            
        } finally {
            this.activeAnalyses.delete(messageId);
        }
    }

    /**
     * Analyze customer message (assistant role)
     */
    async analyzeCustomerMessage(messageInfo, systemPrompt, conversationHistory, currentMessage) {
        // Run psychology and quality analysis in parallel
        const [psychologyResult, qualityResult] = await Promise.allSettled([
            this.customerPsychologyService.analyzeCustomerPsychology(
                systemPrompt, 
                conversationHistory, 
                currentMessage, 
                this.config.expertCount,
                {
                    onStateChange: (state) => {
                        this.triggerCallback('onAnalysisProgress', { 
                            messageId: messageInfo.messageId, 
                            type: 'psychology', 
                            state 
                        });
                    }
                }
            ),
            this.messageQualityService.analyzeMessageQuality(
                systemPrompt, 
                conversationHistory, 
                currentMessage,
                {
                    onStateChange: (state) => {
                        this.triggerCallback('onAnalysisProgress', { 
                            messageId: messageInfo.messageId, 
                            type: 'quality', 
                            state 
                        });
                    }
                }
            )
        ]);
        
        // Store results
        if (psychologyResult.status === 'fulfilled') {
            messageInfo.customerPsychology = psychologyResult.value;
        } else {
            console.warn('Customer psychology analysis failed:', psychologyResult.reason);
        }
        
        if (qualityResult.status === 'fulfilled') {
            messageInfo.messageQuality = qualityResult.value;
        } else {
            console.warn('Message quality analysis failed:', qualityResult.reason);
        }
        
        messageInfo.lastUpdated = new Date().toISOString();
    }

    /**
     * Analyze sales message (user role)
     */
    async analyzeSalesMessage(messageInfo, systemPrompt, conversationHistory, currentMessage) {
        try {
            const result = await this.salesPerformanceService.analyzeSalesPerformance(
                systemPrompt, 
                conversationHistory, 
                currentMessage,
                {
                    onStateChange: (state) => {
                        this.triggerCallback('onAnalysisProgress', { 
                            messageId: messageInfo.messageId, 
                            type: 'sales', 
                            state 
                        });
                    }
                }
            );
            
            messageInfo.salesPerformance = result;
            messageInfo.lastUpdated = new Date().toISOString();
        } catch (error) {
            console.warn(`Sales performance analysis failed for message ${messageInfo.messageId}:`, error);
            
            // Create a fallback analysis to prevent UI issues
            messageInfo.salesPerformance = this.createFallbackSalesAnalysis(error);
            messageInfo.lastUpdated = new Date().toISOString();
        }
    }

    /**
     * Create fallback sales analysis when analysis fails
     */
    createFallbackSalesAnalysis(error) {
        const analysis = new SalesPerformanceAnalysis();
        
        analysis.overallScore = 0.5;
        analysis.techniquesUsed = ['分析失败'];
        analysis.suggestions = ['请重试分析'];
        analysis.analysis = `销售绩效分析失败: ${error.message}`;
        analysis.analysisTimestamp = new Date().toISOString();
        
        return analysis;
    }

    /**
     * Cancel analysis for a specific message
     */
    cancelAnalysis(messageId) {
        const abortController = this.activeAnalyses.get(messageId);
        if (abortController) {
            abortController.abort();
            this.activeAnalyses.delete(messageId);
            
            const messageInfo = this.extendedMessageInfo.get(messageId);
            if (messageInfo) {
                this.updateMessageState(messageId, ANALYSIS_CONFIG.ANALYSIS_STATE.PENDING);
            }
        }
    }

    /**
     * Cancel all active analyses
     */
    cancelAllAnalyses() {
        for (const [messageId, abortController] of this.activeAnalyses) {
            abortController.abort();
            
            const messageInfo = this.extendedMessageInfo.get(messageId);
            if (messageInfo) {
                this.updateMessageState(messageId, ANALYSIS_CONFIG.ANALYSIS_STATE.PENDING);
            }
        }
        this.activeAnalyses.clear();
    }

    /**
     * Get extended message info
     */
    getMessageInfo(messageId) {
        return this.extendedMessageInfo.get(messageId);
    }

    /**
     * Update message analysis state
     */
    updateMessageState(messageId, state) {
        const messageInfo = this.extendedMessageInfo.get(messageId);
        if (messageInfo) {
            messageInfo.analysisState = state;
            messageInfo.lastUpdated = new Date().toISOString();
        }
    }

    /**
     * Register event callbacks
     */
    on(event, callback) {
        if (this.callbacks.hasOwnProperty(event)) {
            this.callbacks[event] = callback;
        }
    }

    /**
     * Trigger event callback
     */
    triggerCallback(event, data) {
        if (this.callbacks[event]) {
            try {
                this.callbacks[event](data);
            } catch (error) {
                console.error(`Analysis callback error (${event}):`, error);
            }
        }
    }

    /**
     * Clear all stored analysis data
     */
    clear() {
        this.cancelAllAnalyses();
        this.extendedMessageInfo.clear();
    }

    /**
     * Get analysis statistics
     */
    getStats() {
        const totalMessages = this.extendedMessageInfo.size;
        const completedAnalyses = Array.from(this.extendedMessageInfo.values())
            .filter(info => info.analysisState === ANALYSIS_CONFIG.ANALYSIS_STATE.COMPLETED).length;
        
        const activeAnalyses = this.activeAnalyses.size;
        
        return {
            totalMessages,
            completedAnalyses,
            activeAnalyses,
            completionRate: totalMessages > 0 ? completedAnalyses / totalMessages : 0
        };
    }
}