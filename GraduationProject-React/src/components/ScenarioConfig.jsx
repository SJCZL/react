import { useState, useEffect } from 'react';

function ScenarioConfig({ modelConfig }) {
    const [activeTab, setActiveTab] = useState('yaml-editor');
    const [yamlData, setYamlData] = useState({});
    const [yamlText, setYamlText] = useState('');
    const [mappingType, setMappingType] = useState('template');
    const [template, setTemplate] = useState('');
    const [llmContext, setLlmContext] = useState('');
    const [llmInstruction, setLlmInstruction] = useState('');
    const [directOutput, setDirectOutput] = useState('');
    const [generatedPrompt, setGeneratedPrompt] = useState('');
    const [generatedSceneInfo, setGeneratedSceneInfo] = useState('');

    // 自动填充弹窗状态
    const [showAutoFill, setShowAutoFill] = useState(false);
    const [autoFillInput, setAutoFillInput] = useState('');

    // 基础的YAML数据结构
    const defaultYamlData = {
        '顾客画像': {
            '基本信息': {
                '姓名': '...',
                '年龄': 0,
                '性别': '...',
                '职业': '...',
                '收入水平': '...'
            },
            '性格特征': {
                '性格类型': '...',
                '沟通风格': '...',
                '决策风格': '...'
            },
            '购物习惯': {
                '购物频率': '...',
                '偏好品牌': '...',
                '价格敏感度': '...'
            }
        },
        '场景信息': {
            '销售场景': '...',
            '产品类型': '...',
            '销售目标': '...'
        }
    };

    useEffect(() => {
        setYamlData(defaultYamlData);
        setYamlText(generateYamlText(defaultYamlData));
    }, []);

    const generateYamlText = (data) => {
        // 简单的YAML生成（实际项目中会使用js-yaml库）
        let yaml = '';
        Object.entries(data).forEach(([key, value]) => {
            yaml += `${key}:\n`;
            if (typeof value === 'object' && value !== null) {
                Object.entries(value).forEach(([subKey, subValue]) => {
                    yaml += `  ${subKey}:\n`;
                    if (typeof subValue === 'object' && subValue !== null) {
                        Object.entries(subValue).forEach(([subSubKey, subSubValue]) => {
                            yaml += `    ${subSubKey}: ${subSubValue}\n`;
                        });
                    } else {
                        yaml += `    ${subValue}\n`;
                    }
                });
            } else {
                yaml += `  ${value}\n`;
            }
        });
        return yaml;
    };

    const handleYamlChange = (newYamlText) => {
        setYamlText(newYamlText);
        try {
            // 这里应该解析YAML，但在简化版本中暂时跳过
            console.log('YAML更新:', newYamlText);
        } catch (error) {
            console.error('YAML解析错误:', error);
        }
    };

    const handleMappingTypeChange = (type) => {
        setMappingType(type);
    };

    const handleGeneratePrompt = async () => {
        try {
            let prompt = '';

            switch (mappingType) {
                case 'template':
                    prompt = generateTemplatePrompt();
                    break;
                case 'llm':
                    prompt = await generateLLMPrompt();
                    break;
                case 'direct':
                    prompt = directOutput;
                    break;
                default:
                    prompt = '请选择映射方式';
            }

            setGeneratedPrompt(prompt);
        } catch (error) {
            console.error('生成提示词失败:', error);
            alert('生成提示词失败: ' + error.message);
        }
    };

    const generateTemplatePrompt = () => {
        // 简单的模板替换逻辑
        let result = template || '请设置模板内容';

        // 替换基本的占位符
        result = result.replace(/\{\{姓名\}\}/g, yamlData?.顾客画像?.基本信息?.姓名 || '...');

        return result;
    };

    const generateLLMPrompt = async () => {
        // 简化版本，直接返回组合的提示词
        const yamlInfo = JSON.stringify(yamlData, null, 2);
        return `基于以下信息生成系统提示词：

场景信息：${yamlInfo}

上下文：${llmContext}

指令：${llmInstruction}

请生成合适的系统提示词。`;
    };

    const handleApplyToChat = () => {
        if (generatedPrompt.trim()) {
            // 通过事件通知Chat组件更新系统提示词
            const event = new CustomEvent('systemPromptUpdated', {
                detail: { systemPrompt: generatedPrompt }
            });
            window.dispatchEvent(event);

            alert('系统提示词已应用到主对话！');
        } else {
            alert('请先生成系统提示词');
        }
    };

    const handleAnonymize = () => {
        const anonymized = anonymizeData(yamlData);
        setYamlData(anonymized);
        setYamlText(generateYamlText(anonymized));
    };

    const anonymizeData = (data) => {
        if (typeof data === 'string') return '...';
        if (typeof data === 'number') return 0;
        if (typeof data === 'boolean') return false;
        if (data === null || data === undefined) return data;
        if (Array.isArray(data)) return data.map(anonymizeData);
        if (typeof data === 'object') {
            const result = {};
            Object.entries(data).forEach(([key, value]) => {
                result[key] = anonymizeData(value);
            });
            return result;
        }
        return data;
    };

    const handleAutoFill = async () => {
        if (!autoFillInput.trim()) {
            alert('请输入您的自定义信息');
            return;
        }

        setShowAutoFill(false);

        try {
            // 简化的自动填充逻辑
            const filledData = {
                ...yamlData,
                '顾客画像': {
                    ...yamlData.顾客画像,
                    '基本信息': {
                        ...yamlData.顾客画像.基本信息,
                        '自定义信息': autoFillInput
                    }
                }
            };

            setYamlData(filledData);
            setYamlText(generateYamlText(filledData));
            setAutoFillInput('');

            alert('自动填充完成！');
        } catch (error) {
            console.error('自动填充失败:', error);
            alert('自动填充失败: ' + error.message);
        }
    };

    return (
        <div id="scenario-tab" className="tab-content active">
            <div id="scenario-container">
                {/* YAML编辑器和映射方式区域 */}
                <div className="top-section-container">
                    {/* YAML编辑器部分 */}
                    <div className="scenario-section yaml-editor-section">
                        <div className="section-header">
                            <h2>YAML 配置编辑器</h2>
                            <div className="header-buttons">
                                <button
                                    className="auto-fill-btn"
                                    onClick={() => setShowAutoFill(true)}
                                >
                                    自动字段填充
                                </button>
                                <button
                                    className="anonymize-btn"
                                    onClick={handleAnonymize}
                                >
                                    匿名化
                                </button>
                            </div>
                        </div>

                        <div id="yaml-editor-container">
                            <div className="yaml-editor-view-container">
                                <div className="yaml-editor-header">YAML 编辑器</div>
                                <textarea
                                    className="yaml-editor-textarea"
                                    value={yamlText}
                                    onChange={(e) => handleYamlChange(e.target.value)}
                                    placeholder="在这里编辑YAML配置..."
                                    style={{
                                        flex: 1,
                                        width: '100%',
                                        padding: '15px',
                                        border: 'none',
                                        resize: 'none',
                                        fontFamily: 'Consolas, Monaco, Courier New, monospace',
                                        fontSize: '14px',
                                        lineHeight: '1.6',
                                        background: '#f9f9f9',
                                        overflowY: 'auto'
                                    }}
                                />
                            </div>

                            <div className="yaml-form-view-container">
                                <div className="form-view-header">表单视图</div>
                                <div className="form-view-container" style={{
                                    background: '#f9f9f9',
                                    overflowY: 'auto',
                                    padding: '10px',
                                    flex: 1
                                }}>
                                    {Object.entries(yamlData).map(([key, value]) => (
                                        <div key={key} className="form-row" style={{
                                            display: 'flex',
                                            alignItems: 'flex-start',
                                            marginBottom: '4px',
                                            padding: '4px 8px',
                                            borderRadius: '4px',
                                            transition: 'all 0.2s ease'
                                        }}>
                                            <div className="form-row-key" style={{
                                                flex: '0 0 60px',
                                                padding: '4px',
                                                fontWeight: 'bold',
                                                color: '#333',
                                                fontSize: '14px',
                                                wordBreak: 'break-word',
                                                cursor: 'pointer'
                                            }}>{key}:</div>
                                            <div className="form-row-value" style={{
                                                flex: 1,
                                                marginLeft: '8px',
                                                minWidth: 0
                                            }}>
                                                {typeof value === 'object' && value !== null ? (
                                                    Object.entries(value).map(([subKey, subValue]) => (
                                                        <div key={subKey} className="form-row" style={{
                                                            display: 'flex',
                                                            alignItems: 'flex-start',
                                                            marginBottom: '4px',
                                                            padding: '4px 8px',
                                                            borderRadius: '4px'
                                                        }}>
                                                            <div className="form-row-key" style={{
                                                                flex: '0 0 60px',
                                                                padding: '4px',
                                                                fontWeight: 'bold',
                                                                color: '#333',
                                                                fontSize: '14px'
                                                            }}>{subKey}:</div>
                                                            <div className="form-row-value" style={{
                                                                flex: 1,
                                                                marginLeft: '8px'
                                                            }}>
                                                                {typeof subValue === 'object' && subValue !== null ? (
                                                                    Object.entries(subValue).map(([subSubKey, subSubValue]) => (
                                                                        <div key={subSubKey} className="form-row" style={{
                                                                            display: 'flex',
                                                                            alignItems: 'flex-start',
                                                                            marginBottom: '4px',
                                                                            padding: '4px 8px'
                                                                        }}>
                                                                            <div className="form-row-key" style={{
                                                                                flex: '0 0 60px',
                                                                                padding: '4px',
                                                                                fontWeight: 'bold',
                                                                                color: '#333',
                                                                                fontSize: '14px'
                                                                            }}>{subSubKey}:</div>
                                                                            <div className="form-row-value" style={{
                                                                                flex: 1,
                                                                                marginLeft: '8px'
                                                                            }}>
                                                                                <input
                                                                                    className="form-field-input"
                                                                                    value={subSubValue}
                                                                                    onChange={(e) => {
                                                                                        const newData = JSON.parse(JSON.stringify(yamlData));
                                                                                        newData[key][subKey][subSubKey] = e.target.value;
                                                                                        setYamlData(newData);
                                                                                        setYamlText(generateYamlText(newData));
                                                                                    }}
                                                                                    style={{
                                                                                        width: '100%',
                                                                                        padding: '10px 12px',
                                                                                        border: '1px solid #ccc',
                                                                                        borderRadius: '20px',
                                                                                        fontSize: '14px',
                                                                                        fontFamily: 'inherit',
                                                                                        boxSizing: 'border-box',
                                                                                        resize: 'none',
                                                                                        height: 'auto',
                                                                                        textOverflow: 'ellipsis',
                                                                                        whiteSpace: 'pre-wrap',
                                                                                        wordBreak: 'break-word'
                                                                                    }}
                                                                                />
                                                                            </div>
                                                                        </div>
                                                                    ))
                                                                ) : (
                                                                    <input
                                                                        className="form-field-input"
                                                                        value={subValue}
                                                                        onChange={(e) => {
                                                                            const newData = JSON.parse(JSON.stringify(yamlData));
                                                                            newData[key][subKey] = e.target.value;
                                                                            setYamlData(newData);
                                                                            setYamlText(generateYamlText(newData));
                                                                        }}
                                                                        style={{
                                                                            width: '100%',
                                                                            padding: '10px 12px',
                                                                            border: '1px solid #ccc',
                                                                            borderRadius: '20px',
                                                                            fontSize: '14px',
                                                                            fontFamily: 'inherit',
                                                                            boxSizing: 'border-box',
                                                                            resize: 'none',
                                                                            height: 'auto'
                                                                        }}
                                                                    />
                                                                )}
                                                            </div>
                                                        </div>
                                                    ))
                                                ) : (
                                                    <input
                                                        className="form-field-input"
                                                        value={value}
                                                        onChange={(e) => {
                                                            const newData = JSON.parse(JSON.stringify(yamlData));
                                                            newData[key] = e.target.value;
                                                            setYamlData(newData);
                                                            setYamlText(generateYamlText(newData));
                                                        }}
                                                        style={{
                                                            width: '100%',
                                                            padding: '10px 12px',
                                                            border: '1px solid #ccc',
                                                            borderRadius: '20px',
                                                            fontSize: '14px',
                                                            fontFamily: 'inherit',
                                                            boxSizing: 'border-box',
                                                            resize: 'none',
                                                            height: 'auto'
                                                        }}
                                                    />
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 映射方式部分 */}
                    <div className="scenario-section mapping-section">
                        <h2>映射方式</h2>
                        <div className="mapping-selector">
                            <div className="mapping-option">
                                <input
                                    type="radio"
                                    id="template-mapping"
                                    name="mapping-type"
                                    value="template"
                                    checked={mappingType === 'template'}
                                    onChange={() => handleMappingTypeChange('template')}
                                />
                                <label htmlFor="template-mapping">模板替换</label>
                            </div>
                            <div className="mapping-option">
                                <input
                                    type="radio"
                                    id="llm-mapping"
                                    name="mapping-type"
                                    value="llm"
                                    checked={mappingType === 'llm'}
                                    onChange={() => handleMappingTypeChange('llm')}
                                />
                                <label htmlFor="llm-mapping">LLM生成</label>
                            </div>
                            <div className="mapping-option">
                                <input
                                    type="radio"
                                    id="direct-mapping"
                                    name="mapping-type"
                                    value="direct"
                                    checked={mappingType === 'direct'}
                                    onChange={() => handleMappingTypeChange('direct')}
                                />
                                <label htmlFor="direct-mapping">直接输出</label>
                            </div>
                        </div>

                        <div className="mapping-config">
                            {mappingType === 'template' && (
                                <div id="template-config" className="config-panel active">
                                    <label htmlFor="template-input">模板内容：</label>
                                    <textarea
                                        id="template-input"
                                        value={template}
                                        onChange={(e) => setTemplate(e.target.value)}
                                        placeholder="使用 {{字段名}} 或 {{路径.字段名}} 作为占位符"
                                        rows="8"
                                    />
                                </div>
                            )}

                            {mappingType === 'llm' && (
                                <div id="llm-config" className="config-panel active">
                                    <div className="model-selector-section">
                                        <label>生成模型选择</label>
                                        <div className="model-selector-row">
                                            <div className="custom-select-wrapper" style={{width: '48%'}}>
                                                <select id="prompt-gen-provider" style={{display: 'none'}}>
                                                    <option value="dashscope">DashScope</option>
                                                </select>
                                                <div className="custom-select">
                                                    <div className="custom-select-trigger">
                                                        <span>{modelConfig?.getCurrentProvider()?.name || '选择服务商'}</span>
                                                        <div className="arrow"></div>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="custom-select-wrapper" style={{width: '48%'}}>
                                                <select id="prompt-gen-model" style={{display: 'none'}}>
                                                    <option value={modelConfig?.currentModel || 'qwen-max'}>
                                                        {modelConfig?.getCurrentModel()?.name || 'Qwen Max'}
                                                    </option>
                                                </select>
                                                <div className="custom-select">
                                                    <div className="custom-select-trigger">
                                                        <span>{modelConfig?.getCurrentModel()?.name || '选择模型'}</span>
                                                        <div className="arrow"></div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <label htmlFor="llm-context">LLM上下文：</label>
                                    <textarea
                                        id="llm-context"
                                        value={llmContext}
                                        onChange={(e) => setLlmContext(e.target.value)}
                                        placeholder="为LLM提供额外的上下文信息"
                                        rows="4"
                                    />

                                    <label htmlFor="llm-instruction">生成指令：</label>
                                    <textarea
                                        id="llm-instruction"
                                        value={llmInstruction}
                                        onChange={(e) => setLlmInstruction(e.target.value)}
                                        placeholder="告诉LLM如何生成系统提示"
                                        rows="4"
                                    />
                                </div>
                            )}

                            {mappingType === 'direct' && (
                                <div id="direct-config" className="config-panel active">
                                    <label htmlFor="direct-output">直接输出内容：</label>
                                    <textarea
                                        id="direct-output"
                                        value={directOutput}
                                        onChange={(e) => setDirectOutput(e.target.value)}
                                        placeholder="输入要直接输出的固定文本"
                                        rows="4"
                                    />
                                </div>
                            )}
                        </div>

                        <div className="generate-section">
                            <button className="generate-btn" onClick={handleGeneratePrompt}>
                                生成系统提示
                            </button>
                        </div>
                    </div>
                </div>

                {/* 预览区域 */}
                <div className="scenario-section preview-section">
                    <h2>输出预览</h2>
                    <div className="preview-container">
                        <div className="preview-column">
                            <div className="preview-card">
                                <div className="preview-header">
                                    <span>生成的系统提示：</span>
                                    <div className="preview-actions">
                                        <button className="copy-btn">复制</button>
                                        <button className="apply-btn" onClick={handleApplyToChat}>
                                            应用到主对话
                                        </button>
                                    </div>
                                </div>
                                <div className="preview-content">
                                    <textarea
                                        id="generated-prompt"
                                        value={generatedPrompt}
                                        readOnly
                                        placeholder="生成的系统提示将显示在这里..."
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="preview-column">
                            <div className="scene-info-card">
                                <div className="preview-header">
                                    <span>场景信息：</span>
                                    <div className="preview-actions">
                                        <button className="copy-btn">复制</button>
                                    </div>
                                </div>
                                <div className="preview-content">
                                    <textarea
                                        id="generated-scene-info"
                                        value={generatedSceneInfo}
                                        readOnly
                                        placeholder="场景信息将显示在这里..."
                                        className="scene-info-textarea"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* 自动填充弹窗 */}
            {showAutoFill && (
                <div className="auto-fill-popup">
                    <div className="auto-fill-popup-content">
                        <div className="auto-fill-popup-header">
                            <h3>自动字段填充</h3>
                            <span className="close-popup" onClick={() => setShowAutoFill(false)}>
                                &times;
                            </span>
                        </div>
                        <div className="auto-fill-popup-body">
                            <div className="auto-fill-input-container">
                                <label htmlFor="auto-fill-input">请输入您的自定义信息：</label>
                                <textarea
                                    id="auto-fill-input"
                                    value={autoFillInput}
                                    onChange={(e) => setAutoFillInput(e.target.value)}
                                    rows="8"
                                    placeholder="描述您希望如何填充YAML字段，例如顾客具体信息等。"
                                />
                            </div>
                            <div className="auto-fill-actions">
                                <button className="cancel-btn" onClick={() => setShowAutoFill(false)}>
                                    取消
                                </button>
                                <button className="confirm-btn" onClick={handleAutoFill}>
                                    确认
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default ScenarioConfig;