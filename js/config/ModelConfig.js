/**
 * 模型配置管理器 - 支持多家AI服务商
 * 支持的提供商：OpenAI、Anthropic、百度、腾讯、阿里云、智谱AI等
 */
import { authManager } from '../auth-manager.js';
export class ModelConfig {
    constructor() {
        this.currentProvider = 'aliyun'; // 默认使用阿里云
        this.currentModel = 'qwen3-max'; // 更新为新的默认模型
        this.apiKeys = {}; // 每个提供商独立的API密钥（已废弃，仅用于向后兼容）
        this.customProviders = {}; // 用户自定义的服务商
        this.backendApiKeys = {}; // 从后端加载的API密钥

        // 初始化提供商配置
        this.providers = this.initializeProviders();

        // 不再加载本地缓存的API密钥
        // this.loadSavedConfig();

        // 如果用户已登录，从后端加载API密钥
        if (authManager.isAuthenticated()) {
            this.loadApiKeysFromBackend().catch(error => {
                console.error('初始化时加载API密钥失败:', error);
            });
        }
    }

    /**
     * 初始化所有支持的模型提供商配置
     */
    initializeProviders() {
        return {
            aliyun: {
                name: '通义千问',
                models: [
                    { id: 'qwen3-max', name: 'Qwen3 Max', maxTokens: 32000 },
                    { id: 'qwen-image-plus', name: 'Qwen Image Plus', maxTokens: 32000 },
                    { id: 'qwen-flash', name: 'Qwen Flash', maxTokens: 128000 },
                    { id: 'qwen-plus', name: 'Qwen Plus', maxTokens: 128000 }
                ],
                baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
                endpoint: '/chat/completions',
                authType: 'bearer',
                keyPlaceholder: 'sk-xxxxxxxxxxxxxxxx',
                description: '阿里云通义千问系列模型'
            },
            openai: {
                name: 'OpenAI',
                models: [
                    { id: 'gpt-5-chat-latest', name: 'GPT-5 Chat Latest', maxTokens: 16384 },
                    { id: 'gpt-4o-mini-audio-preview-2024-12-17', name: 'GPT-4o Mini Audio', maxTokens: 16384 },
                    { id: 'gpt-5-mini-2025-08-07', name: 'GPT-5 Mini', maxTokens: 16384 },
                    { id: 'gpt-5-nano-2025-08-07', name: 'GPT-5 Nano', maxTokens: 16384 },
                    { id: 'gpt-4o', name: 'GPT-4o', maxTokens: 16384 }
                ],
                baseUrl: 'https://api.openai.com',
                endpoint: '/v1/chat/completions',
                authType: 'bearer',
                keyPlaceholder: 'sk-xxxxxxxxxxxxxxxxxxxxxxxx',
                description: 'OpenAI官方GPT系列模型'
            },
            claude: {
                name: 'Claude',
                models: [
                    { id: 'claude-opus-4-1', name: 'Claude Opus 4.1', maxTokens: 16384 },
                    { id: 'claude-opus-4-0', name: 'Claude Opus 4.0', maxTokens: 16384 },
                    { id: 'claude-sonnet-4-5', name: 'Claude Sonnet 4.5', maxTokens: 16384 },
                    { id: 'claude-sonnet-4-0', name: 'Claude Sonnet 4.0', maxTokens: 16384 },
                    { id: 'claude-3-7-sonnet-latest', name: 'Claude 3.7 Sonnet Latest', maxTokens: 16384 }
                ],
                baseUrl: 'https://api.anthropic.com',
                endpoint: '/v1/messages',
                authType: 'bearer',
                keyPlaceholder: 'sk-ant-api03-xxxxxxxxxxxxxxxx',
                description: 'Anthropic Claude系列模型'
            },
            gemini: {
                name: 'Gemini',
                models: [
                    { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', maxTokens: 16384 },
                    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', maxTokens: 16384 },
                    { id: 'models/gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash Lite', maxTokens: 16384 },
                    { id: 'models/gemini-2.0-flash', name: 'Gemini 2.0 Flash', maxTokens: 16384 }
                ],
                baseUrl: 'https://generativelanguage.googleapis.com',
                endpoint: '/v1beta/chat/completions',
                authType: 'bearer',
                keyPlaceholder: 'AIzaxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
                description: 'Google Gemini系列模型'
            },
            deepseek: {
                name: 'DeepSeek',
                models: [
                    { id: 'deepseek-chat', name: 'DeepSeek Chat', maxTokens: 128000 },
                    { id: 'deepseek-reasoner', name: 'DeepSeek Reasoner', maxTokens: 128000 }
                ],
                baseUrl: 'https://api.deepseek.com',
                endpoint: '/v1/chat/completions',
                authType: 'bearer',
                keyPlaceholder: 'sk-xxxxxxxxxxxxxxxxxxxxxxxx',
                description: 'DeepSeek开源模型服务'
            },
            zhipu: {
                name: '智谱AI',
                models: [
                    { id: 'glm-4.6', name: 'GLM-4.6', maxTokens: 128000 },
                    { id: 'glm-4.5', name: 'GLM-4.5', maxTokens: 128000 },
                    { id: 'glm-4.5-x', name: 'GLM-4.5 X', maxTokens: 128000 },
                    { id: 'glm-4.5-flash', name: 'GLM-4.5 Flash', maxTokens: 128000 },
                    { id: 'glm-4.5v', name: 'GLM-4.5V', maxTokens: 128000 },
                    { id: 'glm-4.5-air', name: 'GLM-4.5 Air', maxTokens: 128000 }
                ],
                baseUrl: 'https://open.bigmodel.cn/api/paas',
                endpoint: '/v4/chat/completions',
                authType: 'bearer',
                keyPlaceholder: '您的智谱AI API密钥',
                description: '智谱AI GLM系列模型'
            },
            doubao: {
                name: '豆包',
                models: [
                    { id: 'doubao-seed-1-6-250615', name: 'Doubao Seed 1.6', maxTokens: 128000 },
                    { id: 'doubao-1-5-pro-32k-250115', name: 'Doubao 1.5 Pro 32K', maxTokens: 32768 }
                ],
                baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
                endpoint: '/chat/completions',
                authType: 'bearer',
                keyPlaceholder: '您的豆包API密钥',
                description: '字节跳动豆包大模型系列'
            }
        };
    }

    /**
     * 获取当前提供商信息
     */
    getCurrentProvider() {
        return this.providers[this.currentProvider] || this.customProviders[this.currentProvider];
    }

    /**
     * 获取当前模型信息
     */
    getCurrentModel() {
        const provider = this.getCurrentProvider();
        if (!provider) return null;
        return provider.models.find(m => m.id === this.currentModel) || provider.models[0];
    }

    /**
     * 获取API完整URL
     */
    getApiUrl() {
        const provider = this.getCurrentProvider();
        if (!provider) return '';
        return `${provider.baseUrl}${provider.endpoint}`;
    }

    /**
     * 获取认证头部
     */
    getAuthHeader() {
        const provider = this.getCurrentProvider();
        if (!provider) return '';
        const currentApiKey = this.getApiKeyForProvider(this.currentProvider);
        return `${provider.authType === 'bearer' ? 'Bearer' : 'Api-Key'} ${currentApiKey}`;
    }

    /**
     * 获取指定提供商的API密钥
     */
    getApiKeyForProvider(providerId) {
        // 仅使用后端存储的API密钥，不再使用本地缓存
        return this.backendApiKeys[providerId] || '';
    }

    /**
     * 设置指定提供商的API密钥
     */
    async setApiKeyForProvider(providerId, apiKey) {
        try {
            // 如果用户已登录，保存到后端
            if (authManager.isAuthenticated()) {
                await authManager.saveApiKey(providerId, apiKey);
                this.backendApiKeys[providerId] = apiKey;
            } else {
                // 未登录时不保存任何地方（已废弃本地缓存）
                console.warn('未登录状态下无法保存API密钥');
            }
        } catch (error) {
            console.error('保存API密钥失败:', error);
            throw error;
        }
    }

    /**
     * 切换提供商
     */
    switchProvider(providerId) {
        // 检查内置提供商和自定义提供商
        const provider = this.providers[providerId] || this.customProviders[providerId];
        if (provider) {
            this.currentProvider = providerId;
            // 切换提供商时，默认选择第一个模型
            this.currentModel = provider.models[0].id;
            this.saveConfig();
            return true;
        }
        return false;
    }

    /**
     * 切换模型
     */
    switchModel(modelId) {
        const provider = this.getCurrentProvider();
        const model = provider.models.find(m => m.id === modelId);
        if (model) {
            this.currentModel = modelId;
            this.saveConfig();
            return true;
        }
        return false;
    }

    /**
     * 设置当前提供商的API密钥（为了向后兼容）
     */
    setApiKey(apiKey) {
        this.setApiKeyForProvider(this.currentProvider, apiKey);
    }

    /**
     * 获取当前提供商的API密钥（为了向后兼容）
     */
    get apiKey() {
        return this.getApiKeyForProvider(this.currentProvider);
    }

    /**
     * 获取所有提供商列表（包括自定义的）
     */
    getProviders() {
        const builtInProviders = Object.keys(this.providers).map(key => ({
            id: key,
            type: 'builtin',
            ...this.providers[key]
        }));

        const customProvidersList = Object.keys(this.customProviders).map(key => ({
            id: key,
            type: 'custom',
            ...this.customProviders[key]
        }));

        return [...builtInProviders, ...customProvidersList];
    }

    /**
     * 获取指定提供商的模型列表
     */
    getProviderModels(providerId = null) {
        const provider = providerId ? (this.providers[providerId] || this.customProviders[providerId]) : this.getCurrentProvider();
        return provider ? provider.models : [];
    }

    /**
     * 添加自定义服务商
     */
    addCustomProvider(providerId, config) {
        this.customProviders[providerId] = {
            name: config.name,
            models: config.models || [],
            baseUrl: config.baseUrl,
            endpoint: config.endpoint,
            authType: config.authType || 'bearer',
            keyPlaceholder: config.keyPlaceholder || '请输入API密钥',
            description: config.description || '用户自定义服务商'
        };
        this.saveConfig();
        return true;
    }

    /**
     * 删除自定义服务商
     */
    removeCustomProvider(providerId) {
        if (this.customProviders[providerId]) {
            delete this.customProviders[providerId];
            this.saveConfig();
            return true;
        }
        return false;
    }

    /**
     * 保存配置到本地存储
     */
    saveConfig() {
        const config = {
            currentProvider: this.currentProvider,
            currentModel: this.currentModel,
            apiKeys: this.apiKeys,
            customProviders: this.customProviders
        };
        localStorage.setItem('modelConfig', JSON.stringify(config));
    }

    /**
     * 从本地存储加载配置
     */
    loadSavedConfig() {
        try {
            const saved = localStorage.getItem('modelConfig');
            if (saved) {
                const config = JSON.parse(saved);
                if (config.currentProvider && (this.providers[config.currentProvider] || this.customProviders[config.currentProvider])) {
                    this.currentProvider = config.currentProvider;
                }
                if (config.currentModel) {
                    this.currentModel = config.currentModel;
                }
                if (config.apiKeys) {
                    this.apiKeys = config.apiKeys;
                }
                if (config.customProviders) {
                    this.customProviders = config.customProviders;
                }
            }
        } catch (error) {
            console.warn('Failed to load saved model config:', error);
        }
    }

    /**
     * 导出配置
     */
    exportConfig() {
        return {
            currentProvider: this.currentProvider,
            currentModel: this.currentModel,
            apiKeys: this.apiKeys,
            customProviders: this.customProviders,
            providerInfo: this.getCurrentProvider(),
            modelInfo: this.getCurrentModel()
        };
    }

    /**
     * 重置为默认配置
     */
    resetToDefault() {
        this.currentProvider = 'aliyun';
        this.currentModel = 'qwen3-max';
        this.apiKeys = {};
        this.customProviders = {};
        this.saveConfig();
    }

    /**
     * 从后端加载API密钥
     */
    async loadApiKeysFromBackend() {
        try {
            console.log('🔄 开始从后端加载API密钥...');
            console.log('👤 当前用户:', authManager.getCurrentUser());
            this.backendApiKeys = {};

            // 为每个提供商分别获取API密钥
            const providers = Object.keys(this.providers);
            console.log('📋 需要加载的提供商:', providers);

            for (const provider of providers) {
                try {
                    console.log(`🔍 正在加载 ${provider} 的API密钥...`);
                    const response = await authManager.getApiKey(provider);
                    console.log(`📡 ${provider} API响应:`, response);

                    if (response.success && response.data && response.data.api_key) {
                        this.backendApiKeys[provider] = response.data.api_key;
                        console.log(`✅ 加载API密钥: ${provider} -> ${response.data.api_key.substring(0, 10)}...`);
                    } else {
                        console.log(`⚠️ ${provider} 的API密钥不存在或为空`);
                    }
                } catch (error) {
                    console.warn(`❌ 加载 ${provider} API密钥失败:`, error.message);
                }
            }

            console.log('🎉 成功从后端加载API密钥，共', Object.keys(this.backendApiKeys).length, '个');
            console.log('🔑 当前backendApiKeys:', Object.keys(this.backendApiKeys));
        } catch (error) {
            console.error('❌ 从后端加载API密钥失败:', error);
            console.error('详细错误:', error.message);
            this.backendApiKeys = {}; // 清空
        }
    }

    /**
     * 验证当前配置是否有效
     */
    validateConfig() {
        const currentApiKey = this.getApiKeyForProvider(this.currentProvider);
        return !!(currentApiKey && this.currentProvider && this.currentModel);
    }
}

// 创建全局实例
export const modelConfig = new ModelConfig();