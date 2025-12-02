import { ApiService } from '../api.js';
import { modelConfig } from '../config/ModelConfig.js';

/**
 * Base Service class for common functionality
 */
export class BaseService {
    constructor(apiKey = null, modelName = null, providerId = null) {
        // 使用传入的参数或从模型配置系统获取
        this.apiKey = apiKey || modelConfig.getApiKeyForProvider(providerId || modelConfig.currentProvider);
        this.modelName = modelName || modelConfig.currentModel;
        this.providerId = providerId || modelConfig.currentProvider;
        this.apiService = new ApiService(this.apiKey, this.modelName, this.providerId);
    }

    /**
     * 更新配置以使用模型配置系统
     */
    updateConfig(providerId = null) {
        const targetProvider = providerId || modelConfig.currentProvider;
        this.apiKey = modelConfig.getApiKeyForProvider(targetProvider);
        this.modelName = modelConfig.currentModel;
        this.providerId = targetProvider;
        this.apiService.updateConfig({
            providerId: targetProvider,
            modelName: this.modelName,
            apiKey: this.apiKey
        });
    }

    /**
     * Get response from LLM
     * @param {Array} messages - API messages
     * @param {Object} llmConfig - LLM configuration
     * @returns {Promise<string>} - LLM response
     */
    async getLLMResponse(messages, llmConfig = {}, signal = undefined) {
        const {
            temperature = 0.3,
            topP = 0.9,
            model: overrideModel,
            providerId: overrideProvider,
            apiKey: overrideApiKey
        } = llmConfig;

        try {
            const reader = await this.apiService.streamLLMResponse(
                messages,
                temperature,
                topP,
                signal,
                {
                    model: overrideModel,
                    providerId: overrideProvider,
                    apiKey: overrideApiKey
                }
            );

            const decoder = new TextDecoder();
            let response = '';

            while (true) {
                let value, done;
                try {
                    const res = await reader.read();
                    value = res.value; done = res.done;
                } catch (err) {
                    // If aborted while reading the stream, surface AbortError
                    if (err && err.name === 'AbortError') {
                        throw err;
                    }
                    throw err;
                }
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split('\n\n');

                for (const line of lines) {
                    if (line.startsWith('data:')) {
                        const dataStr = line.substring(5).trim();
                        if (dataStr === '[DONE]') return response;
                        
                        try {
                            const parsed = JSON.parse(dataStr);
                            const content = parsed.choices[0]?.delta?.content;
                            if (content) {
                                response += content;
                            }
                        } catch (e) {
                            console.warn('Failed to parse streaming data chunk:', e);
                        }
                    }
                }
            }

            return response;
        } catch (error) {
            if (error && error.name === 'AbortError') {
                // Propagate abort without wrapping to allow callers to detect
                throw error;
            }
            console.error('LLM API error:', error);
            throw new Error(`Failed to get LLM response: ${error.message}`);
        }
    }
}
