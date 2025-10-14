import { modelConfig } from './config/ModelConfig.js';

export class ApiService {
    constructor(apiKey = null, modelName = null) {
        // 使用提供的参数或从配置获取
        this.apiKey = apiKey || modelConfig.apiKey;
        this.modelName = modelName || modelConfig.currentModel;
        this.currentProvider = modelConfig.currentProvider;

        this.stats = {
            totalCharactersSent: 0,
            totalCharactersReceived: 0,
            totalRequests: 0
        };

        // 监听配置变化
        this.setupConfigListener();
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
     */
    updateConfig() {
        this.apiKey = modelConfig.getApiKeyForProvider(modelConfig.currentProvider);
        this.modelName = modelConfig.currentModel;
        this.currentProvider = modelConfig.currentProvider;
    }

    /**
     * 获取当前API URL
     */
    getApiUrl() {
        return modelConfig.getApiUrl();
    }

    /**
     * 获取认证头部
     */
    getAuthHeader() {
        const provider = modelConfig.getCurrentProvider();
        if (!provider) return '';

        const currentApiKey = modelConfig.getApiKeyForProvider(modelConfig.currentProvider);
        return `${provider.authType === 'bearer' ? 'Bearer' : 'Api-Key'} ${currentApiKey}`;
    }

    async streamLLMResponse(messages, temperature, topP, signal) {
        // 更新配置以获取最新设置
        this.updateConfig();

        // Add logging for debugging
        console.log('[ApiService] Making request to:', this.getApiUrl());
        console.log('[ApiService] Provider:', modelConfig.getCurrentProvider().name);
        console.log('[ApiService] Model:', this.modelName);
        console.log('[ApiService] API Key status:', this.apiKey ? `Present (length: ${this.apiKey.length})` : 'MISSING');
        console.log('[ApiService] Request payload:', {
            model: this.modelName,
            messages: messages,
            stream: true,
            temperature: temperature,
            top_p: topP,
        });

        const requestBody = {
            model: this.modelName,
            messages: messages,
            stream: true,
            temperature: temperature,
            top_p: topP,
        };

        const requestBodyString = JSON.stringify(requestBody);

        // Track characters sent
        this.stats.totalCharactersSent += requestBodyString.length;
        this.stats.totalRequests++;

        const response = await fetch(this.getApiUrl(), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': this.getAuthHeader(),
            },
            body: requestBodyString,
            signal: signal,
        });

        // console.log('[ApiService] Response status:', response.status);
        // console.log('[ApiService] Response headers:', Object.fromEntries(response.headers.entries()));

        if (!response.ok) {
            const errorText = await response.text();
            console.log('[ApiService] Error response:', errorText);
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