export class ApiService {
    constructor(apiKey, provider = 'aliyun', modelConfig = null) {
        this.apiKey = apiKey;
        this.provider = provider;
        this.modelConfig = modelConfig;
        this.endpointUrl = this.computeEndpointUrl(provider);
    }

    computeEndpointUrl(providerId) {
        try {
            const provider = this.getProviderObject(providerId);
            if (!provider) return '';
            // Ensure single slash join
            return `${provider.baseUrl.replace(/\/$/, '')}${provider.endpoint.startsWith('/') ? provider.endpoint : `/${provider.endpoint}`}`;
        } catch (e) {
            console.warn('Failed to compute endpoint URL:', e);
            return '';
        }
    }

    getProviderObject(providerId) {
        if (!this.modelConfig) return null;
        // Prefer built-in providers, then custom
        return this.modelConfig.providers?.[providerId] || this.modelConfig.customProviders?.[providerId] || null;
    }

    async sendMessage(messages, modelName = 'qwen-max', options = {}) {
        const url = this.endpointUrl || this.computeEndpointUrl(this.provider);
        if (!url) {
            return { success: false, error: '无效的API地址，请检查服务商配置。' };
        }

        try {
            const requestBody = {
                model: modelName,
                messages,
                temperature: options.temperature ?? 0.3,
                top_p: options.top_p ?? options.topP ?? 0.97,
                max_tokens: options.max_tokens ?? options.maxTokens ?? 1500,
                ...options
            };

            // Use fetch so that streaming (ReadableStream) works in the browser
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json',
                    // Many providers use SSE for streaming
                    'Accept': options.stream ? 'text/event-stream' : 'application/json'
                },
                body: JSON.stringify(requestBody),
                signal: options.signal
            });

            if (!response.ok) {
                const text = await response.text().catch(() => '');
                return {
                    success: false,
                    error: `HTTP ${response.status}: ${text || response.statusText}`,
                    status: response.status
                };
            }

            // Maintain compatibility with ChatService which expects
            // an object with { success, data: Response } and then reads data.body.getReader()
            return {
                success: true,
                data: response
            };
        } catch (error) {
            console.error('API请求失败:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    updateApiKey(apiKey) {
        this.apiKey = apiKey;
    }

    updateProvider(provider) {
        this.provider = provider;
        this.endpointUrl = this.computeEndpointUrl(provider);
    }

    updateModelConfig(modelConfig) {
        this.modelConfig = modelConfig;
        this.endpointUrl = this.computeEndpointUrl(modelConfig?.currentProvider || this.provider);
    }
}
