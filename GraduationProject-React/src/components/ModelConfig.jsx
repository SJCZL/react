import { useState, useEffect, useMemo } from 'react';
import { ModelConfigService } from '../services/modelConfigService.js';

function ModelConfig({ isOpen, onClose, onConfigChange, modelConfig: externalModelConfig }) {
    const modelConfig = externalModelConfig || new ModelConfigService();
    const [providers, setProviders] = useState([]);
    const [currentProvider, setCurrentProvider] = useState(null);
    const [currentModel, setCurrentModel] = useState(null);
    const [apiKeys, setApiKeys] = useState({});
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    useEffect(() => {
        if (isOpen) {
            loadConfig();
        }
    }, [isOpen]);

    const loadConfig = () => {
        const providersList = modelConfig.getProviders();
        const currentProv = modelConfig.getCurrentProvider();
        const currentMod = modelConfig.getCurrentModel();

        setProviders(providersList);
        setCurrentProvider(currentProv);
        setCurrentModel(currentMod);
        setApiKeys({...modelConfig.apiKeys});
    };

    const currentProviderModels = useMemo(() => {
        if (!currentProvider) return [];
        return currentProvider.models || [];
    }, [currentProvider, refreshTrigger]);

    const handleProviderChange = (providerId) => {
        if (modelConfig.switchProvider(providerId)) {
            loadConfig();
            // 切换提供商后触发模型列表刷新
            setRefreshTrigger(prev => prev + 1);
            onConfigChange && onConfigChange(modelConfig);
        }
    };

    const handleModelChange = (modelId) => {
        if (modelConfig.switchModel(modelId)) {
            loadConfig();
            onConfigChange && onConfigChange(modelConfig);
        }
    };

    const handleApiKeyChange = (providerId, apiKey) => {
        modelConfig.setApiKey(providerId, apiKey);
        setApiKeys({...modelConfig.apiKeys});
        onConfigChange && onConfigChange(modelConfig);
    };

    if (!isOpen) return null;

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            zIndex: 10000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0, 0, 0, 0.5)',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
        }} onClick={onClose}>
            {/* API密钥配置部分 */}
            <div style={{
                position: 'absolute',
                top: '20px',
                right: '20px',
                background: 'white',
                padding: '20px',
                borderRadius: '12px',
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
                minWidth: '300px',
                zIndex: 10001
            }} onClick={(e) => e.stopPropagation()}>
                <h4 style={{margin: '0 0 16px 0', color: '#333', fontSize: '16px', fontWeight: '600'}}>
                    🔑 API密钥配置
                </h4>
                <div style={{marginBottom: '16px'}}>
                    <label style={{display: 'block', marginBottom: '8px', fontWeight: '500', color: '#333'}}>
                        {currentProvider ? `${currentProvider.name} API密钥：` : '当前服务商API密钥：'}
                    </label>
                    <div style={{display: 'flex', gap: '8px', alignItems: 'center'}}>
                        <input
                            type="password"
                            value={apiKeys[currentProvider?.id || ''] || ''}
                            onChange={(e) => handleApiKeyChange(currentProvider?.id || '', e.target.value)}
                            placeholder={currentProvider?.keyPlaceholder || '请输入API密钥'}
                            style={{
                                flex: 1,
                                padding: '8px 12px',
                                border: '1px solid #dee2e6',
                                borderRadius: '4px',
                                fontSize: '14px'
                            }}
                        />
                        <button
                            onClick={() => {
                                const input = document.querySelector('input[type="password"]');
                                if (input) {
                                    input.type = input.type === 'password' ? 'text' : 'password';
                                }
                            }}
                            style={{
                                background: 'none',
                                border: '1px solid #dee2e6',
                                padding: '8px',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '14px'
                            }}
                        >
                            👁
                        </button>
                    </div>
                </div>

                {/* 所有服务商密钥管理 */}
                <div>
                    <h5 style={{margin: '16px 0 12px 0', color: '#666', fontSize: '14px', fontWeight: '600'}}>
                        所有服务商密钥管理
                    </h5>
                    <div style={{
                        maxHeight: '200px',
                        overflowY: 'auto',
                        border: '1px solid #eee',
                        borderRadius: '4px'
                    }}>
                        {providers.map(provider => (
                            <div key={provider.id} style={{
                                padding: '12px',
                                borderBottom: '1px solid #f0f0f0',
                                background: provider.id === currentProvider?.id ? '#f8f9fa' : 'white'
                            }}>
                                <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px'}}>
                                    <span style={{fontWeight: '500', color: '#333'}}>{provider.name}</span>
                                    <span style={{fontSize: '12px', color: '#666'}}>{provider.type === 'custom' ? '自定义' : '内置'}</span>
                                </div>
                                <div style={{display: 'flex', gap: '8px', alignItems: 'center'}}>
                                    <input
                                        type="password"
                                        value={apiKeys[provider.id] || ''}
                                        onChange={(e) => handleApiKeyChange(provider.id, e.target.value)}
                                        placeholder={provider.keyPlaceholder}
                                        style={{
                                            flex: 1,
                                            padding: '6px 8px',
                                            border: '1px solid #dee2e6',
                                            borderRadius: '3px',
                                            fontSize: '12px'
                                        }}
                                    />
                                    <button
                                        onClick={() => {
                                            const inputs = document.querySelectorAll(`input[placeholder*="${provider.keyPlaceholder}"]`);
                                            inputs.forEach(input => {
                                                if (input.placeholder === provider.keyPlaceholder) {
                                                    input.type = input.type === 'password' ? 'text' : 'password';
                                                }
                                            });
                                        }}
                                        style={{
                                            background: 'none',
                                            border: '1px solid #dee2e6',
                                            padding: '6px',
                                            borderRadius: '3px',
                                            cursor: 'pointer',
                                            fontSize: '12px'
                                        }}
                                    >
                                        👁
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* 主配置面板 */}
            <div style={{
                background: 'white',
                borderRadius: '12px',
                width: '100%',
                maxWidth: '800px',
                maxHeight: '90vh',
                overflowY: 'auto',
                boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)'
            }} onClick={(e) => e.stopPropagation()}>
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '20px 24px',
                    borderBottom: '1px solid #eee',
                    background: '#f8f9fa',
                    borderRadius: '12px 12px 0 0'
                }}>
                    <h3 style={{margin: 0, color: '#333', fontSize: '18px', fontWeight: '600'}}>🤖 模型配置</h3>
                    <button
                        style={{
                            background: 'none',
                            border: 'none',
                            fontSize: '24px',
                            cursor: 'pointer',
                            width: '32px',
                            height: '32px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderRadius: '50%',
                            color: '#666',
                            transition: 'all 0.2s ease'
                        }}
                        onClick={onClose}
                    >
                        &times;
                    </button>
                </div>

                <div style={{padding: '24px'}}>
                    <div style={{marginBottom: '32px'}}>
                        <h4 style={{margin: '0 0 16px 0', color: '#333', fontSize: '16px', fontWeight: '600'}}>🤖 选择AI服务商</h4>
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                            gap: '12px',
                            marginBottom: '16px'
                        }}>
                            {providers.map(provider => {
                                const isActive = provider.id === currentProvider?.id;
                                return (
                                    <div
                                        key={provider.id}
                                        style={{
                                            padding: '16px',
                                            border: isActive ? '2px solid #007bff' : '2px solid #e9ecef',
                                            borderRadius: '8px',
                                            textAlign: 'center',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s ease',
                                            background: isActive ? '#e7f1ff' : 'white',
                                            userSelect: 'none'
                                        }}
                                        onClick={() => handleProviderChange(provider.id)}
                                        onMouseEnter={(e) => {
                                            if (!isActive) {
                                                e.target.style.borderColor = '#007bff';
                                                e.target.style.background = '#f8f9fa';
                                            }
                                        }}
                                        onMouseLeave={(e) => {
                                            if (!isActive) {
                                                e.target.style.borderColor = '#e9ecef';
                                                e.target.style.background = 'white';
                                            }
                                        }}
                                    >
                                        <div style={{fontSize: '24px', marginBottom: '8px'}}>
                                            {provider.id === 'aliyun' ? '🦄' :
                                             provider.id === 'openai' ? '🔮' :
                                             provider.id === 'claude' ? '💎' :
                                             provider.id === 'gemini' ? '⭐' :
                                             provider.id === 'deepseek' ? '🔍' :
                                             provider.id === 'zhipu' ? '🌟' :
                                             provider.id === 'doubao' ? '🎯' : '🤖'}
                                        </div>
                                        <div style={{fontWeight: '600', color: '#333', marginBottom: '4px'}}>{provider.name}</div>
                                        <div style={{fontSize: '12px', color: '#666', lineHeight: '1.4'}}>
                                            {provider.description || 'AI模型服务提供商'}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {currentProvider && (
                        <div style={{marginBottom: '32px'}}>
                            <h4 style={{margin: '0 0 16px 0', color: '#333', fontSize: '16px', fontWeight: '600'}}>
                                选择模型 - {currentProvider.name}
                            </h4>
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
                                gap: '8px'
                            }}>
                                {currentProviderModels.map(model => {
                                    const isActive = currentModel?.id === model.id;
                                    return (
                                        <div
                                            key={model.id}
                                            style={{
                                                padding: '12px',
                                                border: isActive ? '1px solid #007bff' : '1px solid #dee2e6',
                                                borderRadius: '6px',
                                                textAlign: 'center',
                                                cursor: 'pointer',
                                                transition: 'all 0.2s ease',
                                                background: isActive ? '#e7f1ff' : 'white'
                                            }}
                                            onClick={() => handleModelChange(model.id)}
                                            onMouseEnter={(e) => {
                                                if (!isActive) {
                                                    e.target.style.borderColor = '#007bff';
                                                    e.target.style.background = '#f8f9fa';
                                                }
                                            }}
                                            onMouseLeave={(e) => {
                                                if (!isActive) {
                                                    e.target.style.borderColor = '#dee2e6';
                                                    e.target.style.background = 'white';
                                                }
                                            }}
                                        >
                                            <div style={{fontWeight: '500', color: '#333'}}>{model.name}</div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* 当前配置信息 */}
                    {currentProvider && currentModel && (
                        <div style={{marginBottom: '32px'}}>
                            <h4 style={{margin: '0 0 16px 0', color: '#333', fontSize: '16px', fontWeight: '600'}}>
                                当前配置
                            </h4>
                            <div style={{
                                background: '#f8f9fa',
                                padding: '16px',
                                borderRadius: '6px',
                                border: '1px solid #e9ecef'
                            }}>
                                <p style={{margin: '8px 0', fontSize: '14px', color: '#555'}}>
                                    <strong>服务商：</strong>{currentProvider.name}
                                </p>
                                <p style={{margin: '8px 0', fontSize: '14px', color: '#555'}}>
                                    <strong>模型：</strong>{currentModel.name}
                                </p>
                                <p style={{margin: '8px 0', fontSize: '14px', color: '#555'}}>
                                    <strong>最大token：</strong>{currentModel.maxTokens.toLocaleString()}
                                </p>
                                <p style={{margin: '8px 0', fontSize: '14px', color: '#555'}}>
                                    <strong>API地址：</strong>
                                    <span style={{fontFamily: 'monospace', fontSize: '12px', color: '#666'}}>
                                        {currentProvider.baseUrl}{currentProvider.endpoint}
                                    </span>
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default ModelConfig;