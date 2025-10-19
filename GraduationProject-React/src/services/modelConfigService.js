import { SUPPORTED_PROVIDERS } from '../config/constants.js';

export class ModelConfigService {
    constructor() {
        this.currentProvider = 'aliyun'; // 默认使用阿里云，与原版JS一致
        this.currentModel = 'qwen3-max'; // 更新为新的默认模型，与原版JS一致
        this.providers = SUPPORTED_PROVIDERS;
        this.apiKeys = {};
        this.customProviders = {}; // 自定义服务商
        this.loadSavedConfig(); // 加载保存的配置
    }

    getProviders() {
        const builtInProviders = Object.values(this.providers).map(provider => ({
            id: provider.id,
            ...provider,
            type: 'builtin'
        }));

        const customProvidersList = Object.values(this.customProviders).map(provider => ({
            id: provider.id,
            ...provider,
            type: 'custom'
        }));

        return [...builtInProviders, ...customProvidersList];
    }

    getCurrentProvider() {
        return this.providers[this.currentProvider] || this.customProviders[this.currentProvider];
    }

    getCurrentModel() {
        const provider = this.getCurrentProvider();
        return provider?.models.find(m => m.id === this.currentModel);
    }

    switchProvider(providerId) {
        // 检查内置提供商和自定义提供商
        const provider = this.providers[providerId] || this.customProviders[providerId];
        if (provider) {
            this.currentProvider = providerId;
            // 切换提供商时，默认选择第一个可用模型（与原版JS完全一致）
            this.currentModel = provider.models[0]?.id || '';
            // 保存配置到本地存储
            this.saveConfig();
            return true;
        }
        return false;
    }

    switchModel(modelId) {
        const provider = this.getCurrentProvider();
        if (provider && provider.models.find(m => m.id === modelId)) {
            this.currentModel = modelId;
            // 保存配置到本地存储
            this.saveConfig();
            return true;
        }
        return false;
    }

    setApiKey(providerId, apiKey) {
        this.apiKeys[providerId] = apiKey;
        // 保存到本地存储，与原版JS保持一致
        const config = {
            currentProvider: this.currentProvider,
            currentModel: this.currentModel,
            apiKeys: this.apiKeys
        };
        localStorage.setItem('modelConfig', JSON.stringify(config));
    }

    getApiKeyForProvider(providerId) {
        return this.apiKeys[providerId] || '';
    }

    getApiBaseForProvider(providerId) {
        const provider = this.providers[providerId] || this.customProviders[providerId];
        return provider ? provider.baseUrl : '';
    }

    saveConfig() {
        const config = {
            currentProvider: this.currentProvider,
            currentModel: this.currentModel,
            apiKeys: this.apiKeys,
            customProviders: this.customProviders
        };
        localStorage.setItem('modelConfig', JSON.stringify(config));
    }

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

    validateConfig() {
        const currentProvider = this.getCurrentProvider();
        if (!currentProvider) return false;

        const apiKey = this.getApiKeyForProvider(this.currentProvider);
        return Boolean(apiKey && apiKey.trim());
    }
}