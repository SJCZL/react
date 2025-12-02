import { modelConfig } from './config/ModelConfig.js';

export class ApiService {
    constructor(apiKey = null, modelName = null, providerId = null) {
        this.apiKey = null;
        this.modelName = null;
        this.currentProvider = null;

        this.stats = {
            totalCharactersSent: 0,
            totalCharactersReceived: 0,
            totalRequests: 0
        };

        // 监听配置变化
        this.setupConfigListener();

        const initialOverrides = {};
        if (providerId) initialOverrides.providerId = providerId;
        if (modelName) initialOverrides.modelName = modelName;
        if (apiKey) initialOverrides.apiKey = apiKey;
        this.updateConfig(initialOverrides);
    }

    /**
     * 设置配置监听器
     */
    setupConfigListener() {
        // 可以在这里添加配置变化的监听逻辑
        // 目前通过updateConfig方法手动更新
    }

    /**
     * 更新配置
     * @param {{providerId?:string, modelName?:string, apiKey?:string}} overrides
     */
    updateConfig(overrides = {}) {
        // 兼容旧代码：传入整个 modelConfig 实例
        if (overrides && overrides.currentProvider && overrides.currentModel && typeof overrides.getApiKeyForProvider === 'function') {
            overrides = {
                providerId: overrides.currentProvider,
                modelName: overrides.currentModel,
                apiKey: overrides.getApiKeyForProvider(overrides.currentProvider)
            };
        }

        const providerId = overrides.providerId ?? modelConfig.currentProvider;
        this.currentProvider = providerId;

        if (overrides.modelName !== undefined) {
            this.modelName = overrides.modelName;
        } else if (providerId === modelConfig.currentProvider) {
            this.modelName = modelConfig.currentModel;
        }

        if (overrides.apiKey !== undefined) {
            this.apiKey = overrides.apiKey;
        } else {
            this.apiKey = modelConfig.getApiKeyForProvider(providerId);
        }
    }

    /**
     * 获取指定提供商的API URL
     */
    getApiUrl(providerId = null) {
        const provider = modelConfig.getProviderConfig(providerId || this.currentProvider);
        if (!provider) return '';
        return `${provider.baseUrl}${provider.endpoint}`;
    }

    /**
     * 生成认证头
     */
    buildAuthHeader(providerId, apiKey) {
        const provider = modelConfig.getProviderConfig(providerId);
        if (!provider || !apiKey) return '';
        return `${provider.authType === 'bearer' ? 'Bearer' : 'Api-Key'} ${apiKey}`;
    }

    async streamLLMResponse(messages, temperature, topP, signal, overrides = {}) {
        const effectiveProvider = overrides.providerId || this.currentProvider || modelConfig.currentProvider;
        this.updateConfig({
            providerId: overrides.providerId,
            modelName: overrides.model,
            apiKey: overrides.apiKey
        });

        const providerId = effectiveProvider;
        const provider = modelConfig.getProviderConfig(providerId);

        // 检查API密钥是否可用
        const apiKey = overrides.apiKey || this.apiKey || modelConfig.getApiKeyForProvider(providerId);
        if (!apiKey) {
            const errorMsg = 'API密钥未设置，请检查模型配置';
            console.error('[ApiService]', errorMsg);
            if (window.debug) {
                window.debug.set('ERROR', 'API Key', 'Missing API key');
            }
            throw new Error(errorMsg);
        }

        // 检查模型名称是否可用
        const modelName = overrides.model || this.modelName || modelConfig.currentModel;
        if (!modelName) {
            const errorMsg = '模型未选择，请检查模型配置';
            console.error('[ApiService]', errorMsg);
            if (window.debug) {
                window.debug.set('ERROR', 'Model', 'No model selected');
            }
            throw new Error(errorMsg);
        }

        // 检查API URL是否可用
        const apiUrl = this.getApiUrl(providerId);
        if (!apiUrl) {
            const errorMsg = 'API URL未设置，请检查模型配置';
            console.error('[ApiService]', errorMsg);
            if (window.debug) {
                window.debug.set('ERROR', 'API URL', 'Missing API URL');
            }
            throw new Error(errorMsg);
        }

        // Add logging for debugging
        console.log('[ApiService] Making request to:', apiUrl);
        console.log('[ApiService] Provider:', provider ? provider.name : providerId);
        console.log('[ApiService] Model:', modelName);
        console.log('[ApiService] API Key status:', apiKey ? `Present (length: ${apiKey.length})` : 'MISSING');
        console.log('[ApiService] Request payload:', {
            model: modelName,
            messages: messages,
            stream: true,
            temperature: temperature,
            top_p: topP,
        });

        const requestBody = {
            model: modelName,
            messages: messages,
            stream: true,
            temperature: temperature,
            top_p: topP,
        };

        const requestBodyString = JSON.stringify(requestBody);

        // Track characters sent
        this.stats.totalCharactersSent += requestBodyString.length;
        this.stats.totalRequests++;

        try {
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': this.buildAuthHeader(providerId, apiKey),
                },
                body: requestBodyString,
                signal: signal,
            });

            // console.log('[ApiService] Response status:', response.status);
            // console.log('[ApiService] Response headers:', Object.fromEntries(response.headers.entries()));

            if (!response.ok) {
                const errorText = await response.text();
                console.log('[ApiService] Error response:', errorText);
                if (window.debug) {
                    window.debug.set('ERROR', 'API Response', `${response.status}: ${errorText.substring(0, 100)}...`);
                }
                throw new Error(`API Error (${response.status}): ${errorText}`);
            }

            const reader = response.body.getReader();

            // Wrap the reader to track received characters
            const originalRead = reader.read.bind(reader);
            reader.read = async function() {
                const result = await originalRead();
                if (result.value) {
                    // Track characters received
                    this.stats.totalCharactersReceived += result.value.length;
                }
                return result;
            }.bind(this);

            return reader;
        } catch (error) {
            if (error.name === 'AbortError') {
                console.log('[ApiService] Request was aborted');
                if (window.debug) {
                    window.debug.set('INFO', 'Request Status', 'Aborted');
                }
            } else {
                console.error('[ApiService] Request failed:', error);
                if (window.debug) {
                    window.debug.set('ERROR', 'Request Failed', error.message);
                }
            }
            throw error;
        }
    }
    
    /**
     * Get API statistics
     */
    getStats() {
        return { ...this.stats };
    }
    
    /**
     * Reset API statistics
     */
    resetStats() {
        this.stats = {
            totalCharactersSent: 0,
            totalCharactersReceived: 0,
            totalRequests: 0
        };
    }
}
