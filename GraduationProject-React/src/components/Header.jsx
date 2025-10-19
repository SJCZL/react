import { useState } from 'react';
import HelpSystem from './HelpSystem.jsx';
import ModelConfig from './ModelConfig.jsx';

function Header({ modelConfig }) {
    const [showHelp, setShowHelp] = useState(false);
    const [showModelConfig, setShowModelConfig] = useState(false);

    const handleHelpClick = () => {
        setShowHelp(true);
    };

    const handleCloseHelp = () => {
        setShowHelp(false);
    };

    const handleModelConfigClick = () => {
        setShowModelConfig(true);
    };

    const handleCloseModelConfig = () => {
        setShowModelConfig(false);
    };

    return (
        <>
            <div id="header">
                <h1>
                    提示词结构演示
                    <span style={{fontSize: '0.2em', color: '#888', fontWeight: 'normal', marginLeft: '10px'}}>
                        8.20-1
                    </span>
                    <span
                        id="help-icon"
                        className="help-icon"
                        title="快捷键和技巧"
                        onClick={handleHelpClick}
                        style={{cursor: 'pointer'}}
                    >
                        ?
                    </span>
                </h1>
                <div id="chat-controls">
                    <button
                        id="model-config-button"
                        title="模型配置"
                        onClick={handleModelConfigClick}
                        style={{
                            position: 'relative'
                        }}
                    >
                        ⚙️ 模型设置
                        {modelConfig && modelConfig.getCurrentModel() && (
                            <span style={{
                                position: 'absolute',
                                top: '-6px',
                                right: '-6px',
                                background: '#28a745',
                                color: 'white',
                                borderRadius: '50%',
                                width: '12px',
                                height: '12px',
                                fontSize: '8px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}>
                                ✓
                            </span>
                        )}
                    </button>
                </div>
            </div>

            {showHelp && (
                <HelpSystem onClose={handleCloseHelp} />
            )}

            {showModelConfig && (
                <ModelConfig
                    isOpen={showModelConfig}
                    onClose={handleCloseModelConfig}
                    modelConfig={modelConfig}
                    onConfigChange={(config) => {
                        // 将配置传递给父组件或全局状态管理
                        window.modelConfig = config;
                    }}
                />
            )}
        </>
    );
}

export default Header;