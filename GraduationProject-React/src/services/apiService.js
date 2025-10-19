import axios from 'axios';

export class ApiService {
    constructor(apiKey, provider = 'dashscope', modelConfig = null) {
        this.apiKey = apiKey;
        this.provider = provider;
        this.modelConfig = modelConfig;
        this.baseURL = modelConfig ? modelConfig.getApiBaseForProvider(provider) : 'https://dashscope.aliyuncs.com/compatible-mode/v1';
    }

    async sendMessage(messages, modelName = 'qwen-max', options = {}) {
        try {
            const requestBody = {
                model: modelName,
                messages: messages,
                temperature: options.temperature || 0.3,
                top_p: options.topP || 0.97,
                max_tokens: options.maxTokens || 1500,
                ...options
            };

            const response = await axios.post(this.baseURL, requestBody, {
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                },
                timeout: 30000
            });

            return {
                success: true,
                data: response.data,
                usage: response.data.usage
            };
        } catch (error) {
            console.error('API请求失败:', error);
            return {
                success: false,
                error: error.message,
                status: error.response?.status
            };
        }
    }

    updateApiKey(apiKey) {
        this.apiKey = apiKey;
    }

    updateProvider(provider) {
        this.provider = provider;
    }
}