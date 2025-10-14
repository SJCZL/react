import { ApiService } from '../api.js';
import { ANALYSIS_CONFIG } from './AnalysisConfig.js';

/**
 * Base Analysis Service with common functionality
 */
export class BaseAnalysisService {
    constructor(apiKey, model, temperature) {
        this.apiService = new ApiService(apiKey);
        this.model = model;
        this.temperature = temperature;
        this.abortController = null;
    }

    /**
     * Execute analysis with retry mechanism and robust error handling
     */
    async executeAnalysis(prompt, options = {}) {
        const {
            maxRetries = ANALYSIS_CONFIG.DEFAULT_SETTINGS.retryCount,
            timeoutMs = ANALYSIS_CONFIG.DEFAULT_SETTINGS.timeoutMs,
            onRetry = null,
            onStateChange = null
        } = options;

        let lastError = null;
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                if (onStateChange) {
                    onStateChange(attempt > 1 ? ANALYSIS_CONFIG.ANALYSIS_STATE.RETRYING : ANALYSIS_CONFIG.ANALYSIS_STATE.GENERATING);
                }

                // Create abort controller for this attempt
                this.abortController = new AbortController();
                
                // Set up timeout
                const timeoutPromise = new Promise((_, reject) => {
                    setTimeout(() => reject(new Error('Analysis timeout')), timeoutMs);
                });

                // Execute the API call
                const apiPromise = this.apiService.streamLLMResponse(
                    [{ role: 'user', content: prompt }],
                    this.temperature,
                    0.97, // topP
                    this.abortController.signal
                );

                // Race between API call and timeout
                const reader = await Promise.race([apiPromise, timeoutPromise]);
                
                // Process the response
                const result = await this.processStreamResponse(reader);
                
                if (onStateChange) {
                    onStateChange(ANALYSIS_CONFIG.ANALYSIS_STATE.COMPLETED);
                }
                
                return result;

            } catch (error) {
                lastError = error;
                console.warn(`Analysis attempt ${attempt} failed:`, error.message);
                
                if (onRetry) {
                    onRetry(attempt, error);
                }
                
                // Abort current attempt
                if (this.abortController) {
                    this.abortController.abort();
                }
                
                // Don't retry on abort errors
                if (error.name === 'AbortError') {
                    throw error;
                }
                
                // Wait before retry (exponential backoff)
                if (attempt < maxRetries) {
                    const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        }
        
        if (onStateChange) {
            onStateChange(ANALYSIS_CONFIG.ANALYSIS_STATE.ERROR);
        }
        
        throw new Error(`Analysis failed after ${maxRetries} attempts. Last error: ${lastError.message}`);
    }

    /**
     * Process streaming response and extract content
     */
    async processStreamResponse(reader) {
        const decoder = new TextDecoder();
        let content = '';
        
        try {
            while (true) {
                const { value, done } = await reader.read();
                if (done) break;
                
                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split('\n\n');
                
                for (const line of lines) {
                    if (line.startsWith('data:')) {
                        const dataStr = line.substring(5).trim();
                        if (dataStr === '[DONE]') return content;
                        
                        try {
                            const parsed = JSON.parse(dataStr);
                            const deltaContent = parsed.choices[0]?.delta?.content;
                            if (deltaContent) {
                                content += deltaContent;
                            }
                        } catch (e) {
                            // Ignore parsing errors, continue collecting content
                        }
                    }
                }
            }
        } finally {
            // Ensure reader is properly closed
            try {
                reader.releaseLock();
            } catch (e) {
                // Ignore release lock errors
            }
        }
        
        return content;
    }

    /**
     * Abort current analysis
     */
    abort() {
        if (this.abortController) {
            this.abortController.abort();
        }
    }

    /**
     * Parse JSON from LLM response with fallback
     */
    parseJsonFromResponse(response, fallback = null) {
        try {
            // Try to find JSON in the response (look for JSON objects)
            const jsonMatch = response.match(/\{[\s\S]*?\}(?=[^}]*$)/);
            if (jsonMatch) {
                const jsonStr = jsonMatch[0];
                // Clean up common JSON formatting issues
                const cleanedJson = jsonStr
                    .replace(/,\s*}/g, '}')  // Remove trailing commas
                    .replace(/,\s*]/g, ']')  // Remove trailing commas in arrays
                    .replace(/[\u201C\u201D]/g, '"')  // Replace smart quotes
                    .replace(/[\u2018\u2019]/g, "'")  // Replace smart single quotes
                    .trim();
                
                return JSON.parse(cleanedJson);
            }
            
            // Try to parse the entire response as JSON
            return JSON.parse(response);
        } catch (error) {
            console.warn('Failed to parse JSON from response:', error.message);
            console.warn('Response preview:', response.substring(0, 200) + '...');
            return fallback;
        }
    }

    /**
     * Create a standardized analysis prompt
     */
    createAnalysisPrompt(systemPrompt, conversationHistory, currentMessage, analysisInstructions) {
        const formattedHistory = conversationHistory.map(msg => {
            const role = msg.role === 'user' ? 'Sales Rep' : 'Customer';
            return `${role}: ${msg.content}`;
        }).join('\n');
        
        const currentRole = currentMessage.role === 'user' ? 'Sales Rep' : 'Customer';
        
        return `
You are an expert sales conversation analyst. Below is a conversation history and a message to analyze.

SYSTEM PROMPT:
${systemPrompt}

CONVERSATION HISTORY:
${formattedHistory}

CURRENT MESSAGE (${currentRole}):
${currentMessage.content}

ANALYSIS INSTRUCTIONS:
${analysisInstructions}

Please provide your analysis in the requested format. Be thorough, objective, and specific.
`.trim();
    }
}