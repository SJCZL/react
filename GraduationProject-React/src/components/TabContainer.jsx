import { useState, useEffect } from 'react';
import Chat from './Chat.jsx';
import ScenarioConfig from './ScenarioConfig.jsx';

function TabContainer({ modelConfig }) {
    const [activeTab, setActiveTab] = useState('chat-tab');

    // 确保modelConfig可用
    useEffect(() => {
        if (modelConfig) {
            console.log('TabContainer接收到modelConfig:', modelConfig.getCurrentProvider());
        }
    }, [modelConfig]);
    
    const tabs = [
        { id: 'chat-tab', label: '主对话', content: 'ChatTab' },
        { id: 'scenario-tab', label: '待测试prompt配置', content: 'ScenarioTab' },
        { id: 'parallel-tab', label: '并行测试', content: 'ParallelTab' },
        { id: 'preset-tab', label: '预设管理', content: 'PresetTab' }
    ];

    const handleTabClick = (tabId) => {
        setActiveTab(tabId);
    };

    useEffect(() => {
        // 初始化时显示默认激活的标签页
        handleTabClick(activeTab);
    }, []);

    return (
        <>
            <div className="tab-container">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        className={`tab-link ${activeTab === tab.id ? 'active' : ''}`}
                        data-tab={tab.id}
                        onClick={() => handleTabClick(tab.id)}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            <div id="chat-tab" className={`tab-content ${activeTab === 'chat-tab' ? 'active' : ''}`}>
                <Chat modelConfig={modelConfig} />
            </div>

            <div id="scenario-tab" className={`tab-content ${activeTab === 'scenario-tab' ? 'active' : ''}`}>
                <ScenarioConfig modelConfig={modelConfig} />
            </div>

            <div id="parallel-tab" className={`tab-content ${activeTab === 'parallel-tab' ? 'active' : ''}`}>
                <div id="parallel-container">
                    <h2>并行测试功能</h2>
                    <p>并行测试模块正在开发中...</p>
                    <div style={{padding: '20px', textAlign: 'center', color: '#666'}}>
                        🚧 此功能将在后续版本中提供，敬请期待！
                    </div>
                </div>
            </div>

            <div id="preset-tab" className={`tab-content ${activeTab === 'preset-tab' ? 'active' : ''}`}>
                <div id="preset-container">
                    <h2>预设管理功能</h2>
                    <p>预设管理模块正在开发中...</p>
                    <div style={{padding: '20px', textAlign: 'center', color: '#666'}}>
                        🚧 此功能将在后续版本中提供，敬请期待！
                    </div>
                </div>
            </div>
        </>
    );
}

export default TabContainer;