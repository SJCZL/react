import { initializeUI } from './ui.js';
import { Chat } from './chat.js';
import { SceneConfigManager } from './scene-config/SceneConfigManager.js';
import { DebugOverlay } from './DebugOverlay.js';
import HelpSystem from './HelpSystem.js';
import { PresetUIManager } from './preset-manager/PresetUIManager.js';
import { modelConfig } from './config/ModelConfig.js';
import { modelConfigUI } from './config/ModelConfigUI.js';
import { MODEL_NAME } from './config.js';
import { authManager } from './auth-manager.js';
// 引入测试脚本
import './config/quick-test.js';

// Debug logging for main.js initialization
console.log('[DEBUG main.js] main.js starting to load');

// 认证检查和重定向
function initAuthCheck() {
    if (!authManager.isAuthenticated()) {
        console.log('[main.js] User not authenticated, redirecting to login');
        window.location.href = '/login.html';
        return false;
    }
    return true;
}

document.addEventListener('DOMContentLoaded', () => {
    console.log('[DEBUG main.js] DOMContentLoaded fired');

    // 检查用户是否已登录
    if (!initAuthCheck()) {
        return; // 如果未登录，已重定向到登录页
    }

    // 添加用户界面元素
    addUserInterface();
    initializeUI();

    // 初始化模型配置
    modelConfigUI.init();

    // 模型配置按钮事件监听
    const modelConfigButton = document.getElementById('model-config-button');
    if (modelConfigButton) {
        modelConfigButton.addEventListener('click', () => {
            modelConfigUI.show();
        });
    }

    // 确保modelConfig在全局可用，供Chat类使用
    window.modelConfig = modelConfig;
    console.log('🔧 ModelConfig loaded:', modelConfig.getCurrentProvider().name);
    console.log('[DEBUG main.js] ModelConfig loaded, current provider:', modelConfig.getCurrentProvider()?.name);
    
    // Initialize the PresetUIManager
    const presetUIManager = new PresetUIManager();
    
    // Make presetUIManager globally accessible
    window.presetUIManager = presetUIManager;
    
    // After presets & UI are ready, parse URL params and apply designated presets if present.
    // This ensures preset files are loaded before we attempt to apply them.
    if (presetUIManager && presetUIManager.ready && typeof presetUIManager.parseAndApplyPresetsFromUrl === 'function') {
        presetUIManager.ready.then(() => {
            try {
                presetUIManager.parseAndApplyPresetsFromUrl();
            } catch (err) {
                console.error('[main.js] Failed to apply presets from URL:', err);
            }
        });
    }
    
    // 初始化时同步参数到模型配置面板
    setTimeout(() => {
        // 确保侧边栏中不存在的输入框不会影响初始化
        console.log('[main.js] Model config system initialized');
    }, 100);
    
    // Initialize the main chat instance for the UI
    // 从模型配置系统获取初始参数
    const initialModelName = modelConfig.currentModel || MODEL_NAME;
    console.log('[DEBUG main.js] Initial model name from modelConfig:', initialModelName);
    const initialTemperature = 0.3; // 默认温度值
    const initialTopP = 0.97; // 默认top_p值

    const chat = new Chat({
        apiKey: modelConfig.getApiKeyForProvider(modelConfig.currentProvider), // 从模型配置获取当前密钥
        modelName: modelConfig.currentModel, // 使用模型配置系统中的模型
        modelConfig: modelConfig, // 传递模型配置实例
        defaultTemperature: Number.isFinite(initialTemperature) ? initialTemperature : 0.3,
        defaultTopP: Number.isFinite(initialTopP) ? initialTopP : 0.97,
        headless: false, // This instance controls the UI
        chatContainerId: 'chat-container',
        messageInputId: 'message-input',
        sendButtonId: 'send-button',
        clearChatButtonId: 'clear-chat-button',
        saveChatButtonId: 'save-chat-button',
        loadChatButtonId: 'load-chat-button',
        loadChatInputId: 'load-chat-input',
        // Auto-response elements
        initialResponseInputId: 'initial-response',
        responsePromptInputId: 'response-prompt',
        autoResponseToggleId: 'auto-response-toggle',
        // Continuous-response elements
        continuousResponseToggleId: 'continuous-response-toggle',
        endConditionContainerId: 'end-condition-container',
        endConditionSelectId: 'end-condition-select',
        dialogueRoundLimitInputId: 'dialogue-round-limit-input',
        assistantRegexMatchInputId: 'assistant-regex-match-input',
        userRegexMatchInputId: 'user-regex-match-input',
    });

    console.log('[DEBUG main.js] Chat instance created successfully');

    // 模型参数现在由模型配置面板统一管理
    // 不再需要直接监听侧边栏输入框的变化

    // Make chat instance globally accessible for SceneConfigManager
    window.chatInstance = chat;

    // Initialize the SceneConfigManager
    const sceneConfigManager = new SceneConfigManager({
        apiKey: modelConfig.getApiKeyForProvider(modelConfig.currentProvider) // 使用当前提供商的API密钥
    });

    // Make sceneConfigManager globally accessible
    window.sceneConfigManager = sceneConfigManager;

    // 确保待测试prompt配置管理器在标签页激活时重新初始化模型选择器
    const scenarioTabBtn = document.querySelector('.tab-link[data-tab="scenario-tab"]');
    if (scenarioTabBtn) {
        scenarioTabBtn.addEventListener('click', () => {
            // 延迟一点时间确保DOM完全加载
            setTimeout(() => {
                if (window.sceneConfigManager) {
                    window.sceneConfigManager.initializePromptGenerationModelSelector();
                }
            }, 300);
        });
    }

    // API密钥变更监听（现在通过模型配置UI管理）
    // 不再需要直接监听输入框变化，由模型配置系统统一管理

    // Initialize help popup functionality
    HelpSystem.updateHelpContent();
    
    // Register API services with debug overlay for tracking
    setTimeout(() => {
        if (window.debug) {
            // Register main chat service
            if (window.chatInstance && window.chatInstance.chatService && window.chatInstance.chatService.apiService) {
                window.debug.registerApiService(window.chatInstance.chatService.apiService, 'MainChatService');
            }
            
            // Register scene config manager service
            if (window.sceneConfigManager) {
                const sceneService = window.sceneConfigManager.yamlDataManager?.yamlEditorManager?.promptGenerator?.llmGenerator?.apiService;
                if (sceneService) {
                    window.debug.registerApiService(sceneService, 'SceneConfigLLMGenerator');
                }
            }
            
            // Register analysis services
            if (window.chatInstance && window.chatInstance.messageSelectionManager && window.chatInstance.messageSelectionManager.analysisManager) {
                const analysisManager = window.chatInstance.messageSelectionManager.analysisManager;
                const services = [
                    { service: analysisManager.customerPsychologyService, name: 'CustomerPsychologyService' },
                    { service: analysisManager.messageQualityService, name: 'MessageQualityService' },
                    { service: analysisManager.salesPerformanceService, name: 'SalesPerformanceService' }
                ];
                
                services.forEach(({ service, name }) => {
                    if (service && service.apiService) {
                        window.debug.registerApiService(service.apiService, name);
                    }
                });
            }
            
            console.log('[main.js] Registered API services with debug overlay');
                }
            }, 1000); // Wait for services to be initialized
        });
        
        // 添加用户界面相关功能
        function addUserInterface() {
            const header = document.getElementById('header');
            if (header) {
                // 添加用户信息显示区域
                const userInfo = document.createElement('div');
                userInfo.id = 'user-info';
                userInfo.innerHTML = `
                    <span id="user-display-name">${authManager.getCurrentUser()?.username || '未知用户'}</span>
                    <button id="logout-btn" title="登出">登出</button>
                `;
                header.appendChild(userInfo);
        
                // 绑定登出事件
                const logoutBtn = document.getElementById('logout-btn');
                if (logoutBtn) {
                    logoutBtn.addEventListener('click', () => {
                        if (confirm('确定要登出吗？')) {
                            authManager.logout();
                        }
                    });
                }
            }
        }

