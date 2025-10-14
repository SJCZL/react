import { modelConfig } from './ModelConfig.js';

/**
 * 模型配置UI管理器
 */
export class ModelConfigUI {
    constructor() {
        this.container = null;
        this.isVisible = false;
        this.init();
    }

    /**
     * 初始化UI
     */
    init() {
        this.createUI();
        this.setupEventListeners();
        this.loadParametersFromSidebar(); // 从侧边栏加载现有参数
        this.updateDisplay();
    }

    /**
     * 从侧边栏加载现有参数值
     */
    loadParametersFromSidebar() {
        // 从侧边栏获取当前参数值（如果还存在的话）
        const tempInput = document.getElementById('temperature-input');
        const topPInput = document.getElementById('top-p-input');

        if (tempInput && tempInput.value) {
            console.log('[ModelConfigUI] Loaded temperature from sidebar:', tempInput.value);
        }

        if (topPInput && topPInput.value) {
            console.log('[ModelConfigUI] Loaded top_p from sidebar:', topPInput.value);
        }
    }

    /**
     * 创建UI元素
     */
    createUI() {
        // 创建主容器
        this.container = document.createElement('div');
        this.container.id = 'model-config-container';
        this.container.className = 'model-config-container';
        this.container.innerHTML = `
            <div class="model-config-overlay">
                <div class="model-config-panel">
                    <div class="model-config-header">
                        <h3>🤖 模型配置</h3>
                        <button class="close-model-config" title="关闭">×</button>
                    </div>
                    <div class="model-config-body">
                        <!-- 提供商选择 -->
                        <div class="config-section">
                            <h4>选择AI服务商</h4>
                            <div class="provider-grid" id="provider-grid">
                                ${this.renderProviders()}
                            </div>
                        </div>

                        <!-- 模型选择 -->
                        <div class="config-section">
                            <h4>选择模型</h4>
                            <div class="model-grid" id="model-grid">
                                ${this.renderModels()}
                            </div>
                        </div>

                        <!-- API密钥配置 -->
                        <div class="config-section">
                            <h4>API密钥配置</h4>
                            <div class="provider-keys">
                                <div class="current-provider-key">
                                    <label id="current-key-label">当前服务商API密钥：</label>
                                    <div class="input-group">
                                        <input type="password" id="model-api-key" placeholder="请输入当前服务商的API密钥" />
                                        <button id="toggle-api-key" class="toggle-visibility">👁</button>
                                    </div>
                                </div>
                                <div class="key-status" id="key-status"></div>
                                <div class="all-keys-section">
                                    <h5>所有服务商密钥管理</h5>
                                    <div class="keys-grid" id="keys-grid">
                                        ${this.renderAllProviderKeys()}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- 自定义服务商 -->
                        <div class="config-section">
                            <h4>自定义服务商</h4>
                            <div class="custom-providers">
                                <div class="add-provider-form" id="add-provider-form" style="display: none;">
                                    <h5>添加新服务商</h5>
                                    <div class="form-row">
                                        <input type="text" id="provider-id" placeholder="服务商ID (如: myapi)" />
                                        <input type="text" id="provider-name" placeholder="服务商名称" />
                                    </div>
                                    <div class="form-row">
                                        <input type="url" id="provider-baseurl" placeholder="API基础地址" />
                                        <input type="text" id="provider-endpoint" placeholder="接口端点 (/v1/chat/completions)" />
                                    </div>
                                    <div class="form-row">
                                        <input type="text" id="provider-key-placeholder" placeholder="密钥提示文字" />
                                        <select id="provider-auth-type">
                                            <option value="bearer">Bearer Token</option>
                                            <option value="api-key">API Key</option>
                                        </select>
                                    </div>
                                    <div class="form-row">
                                        <textarea id="provider-models" placeholder="模型列表 (一行一个，格式: model-id,Model Name,maxTokens,描述)"></textarea>
                                    </div>
                                    <div class="form-actions">
                                        <button id="save-provider" class="btn-primary">保存服务商</button>
                                        <button id="cancel-add-provider" class="btn-secondary">取消</button>
                                    </div>
                                </div>
                                <div class="custom-providers-list">
                                    <button id="add-new-provider" class="btn-secondary">➕ 添加自定义服务商</button>
                                    <div id="custom-providers-grid" class="custom-providers-grid">
                                        ${this.renderCustomProviders()}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- 当前配置信息 -->
                        <div class="config-section">
                            <h4>当前配置</h4>
                            <div class="current-config" id="current-config">
                                ${this.renderCurrentConfig()}
                            </div>
                        </div>

                        <!-- 模型参数配置 -->
                        <div class="config-section">
                            <h4>模型参数设置</h4>
                            <div class="model-parameters" id="model-parameters">
                                ${this.renderModelParameters()}
                            </div>
                        </div>

                        <!-- 操作按钮 -->
                        <div class="config-actions">
                            <button id="test-connection" class="btn-primary">测试连接</button>
                            <button id="reset-config" class="btn-secondary">重置默认</button>
                            <button id="export-config" class="btn-secondary">导出配置</button>
                            <button id="import-config" class="btn-secondary">导入配置</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // 添加样式
        this.addStyles();

        document.body.appendChild(this.container);

        // 隐藏文件输入框
        this.fileInput = document.createElement('input');
        this.fileInput.type = 'file';
        this.fileInput.accept = '.json';
        this.fileInput.style.display = 'none';
        this.fileInput.id = 'import-config-file';
        document.body.appendChild(this.fileInput);
    }

    /**
     * 渲染提供商列表
     */
    renderProviders() {
        return modelConfig.getProviders().map(provider => `
            <div class="provider-card ${modelConfig.currentProvider === provider.id ? 'active' : ''}"
                 data-provider="${provider.id}">
                <div class="provider-icon">${this.getProviderIcon(provider.id)}</div>
                <div class="provider-name">${provider.name}</div>
                <div class="provider-desc">${provider.description}</div>
            </div>
        `).join('');
    }

    /**
     * 渲染模型列表
     */
    renderModels() {
        const currentProvider = modelConfig.getCurrentProvider();
        if (!currentProvider) return '<p>请选择服务商</p>';

        return currentProvider.models.map(model => `
            <div class="model-card ${modelConfig.currentModel === model.id ? 'active' : ''}"
                 data-model="${model.id}">
                <div class="model-name">${model.name}</div>
                <div class="model-tokens">${model.maxTokens.toLocaleString()} tokens</div>
                ${model.description ? `<div class="model-desc">${model.description}</div>` : ''}
            </div>
        `).join('');
    }

    /**
     * 渲染模型参数设置
     */
    renderModelParameters() {
        const currentModel = modelConfig.getCurrentModel();
        const currentProvider = modelConfig.getCurrentProvider();

        // 从侧边栏获取当前参数值，如果有的话
        const tempInput = document.getElementById('temperature-input');
        const topPInput = document.getElementById('top-p-input');
        const modelInput = document.getElementById('model-input');

        const temperature = tempInput ? tempInput.value : '0.3';
        const topP = topPInput ? topPInput.value : '0.97';
        const modelName = modelInput ? modelInput.value : currentModel?.name || '';

        return `
            <div class="parameter-group">
                <label for="model-temp">温度 (Temperature)</label>
                <input type="number" id="model-temp" min="0" max="2" step="0.01" value="${temperature}" />
                <span class="param-desc">控制生成内容的创造性，0-2之间</span>
            </div>
            <div class="parameter-group">
                <label for="model-top-p">Top P (top_p)</label>
                <input type="number" id="model-top-p" min="0" max="1" step="0.01" value="${topP}" />
                <span class="param-desc">控制生成内容的多样性，0-1之间</span>
            </div>
            <div class="parameter-group">
                <label for="model-name-display">当前模型</label>
                <input type="text" id="model-name-display" value="${modelName}" readonly />
                <span class="param-desc">当前使用的模型名称</span>
            </div>
        `;
    }

    /**
     * 渲染所有提供商的密钥管理
     */
    renderAllProviderKeys() {
        return modelConfig.getProviders().map(provider => `
            <div class="provider-key-item ${modelConfig.currentProvider === provider.id ? 'current' : ''}">
                <div class="provider-key-header">
                    <span class="provider-name">${provider.name}</span>
                    <span class="provider-type">${provider.type === 'custom' ? '自定义' : '内置'}</span>
                </div>
                <div class="provider-key-input">
                    <input type="password" data-provider="${provider.id}"
                           placeholder="${provider.keyPlaceholder}"
                           value="${modelConfig.getApiKeyForProvider(provider.id)}" />
                    <button class="toggle-key-visibility" data-provider="${provider.id}">👁</button>
                </div>
            </div>
        `).join('');
    }

    /**
     * 渲染自定义服务商列表
     */
    renderCustomProviders() {
        const customProviders = Object.keys(modelConfig.customProviders);
        if (customProviders.length === 0) {
            return '<p class="no-custom-providers">暂无自定义服务商</p>';
        }

        return customProviders.map(providerId => {
            const provider = modelConfig.customProviders[providerId];
            return `
                <div class="custom-provider-card">
                    <div class="provider-info">
                        <div class="provider-name">${provider.name}</div>
                        <div class="provider-desc">${provider.description}</div>
                        <div class="provider-models-count">${provider.models.length} 个模型</div>
                    </div>
                    <div class="provider-actions">
                        <button class="btn-small edit-provider" data-provider="${providerId}">编辑</button>
                        <button class="btn-small delete-provider" data-provider="${providerId}">删除</button>
                    </div>
                </div>
            `;
        }).join('');
    }

    /**
     * 渲染当前配置信息
     */
    renderCurrentConfig() {
        const provider = modelConfig.getCurrentProvider();
        const model = modelConfig.getCurrentModel();
        return `
            <div class="config-info">
                <p><strong>服务商：</strong>${provider.name}</p>
                <p><strong>模型：</strong>${model.name}</p>
                <p><strong>最大token：</strong>${model.maxTokens.toLocaleString()}</p>
                <p><strong>API地址：</strong><span class="api-url">${modelConfig.getApiUrl()}</span></p>
            </div>
        `;
    }

    /**
     * 获取提供商图标
     */
    getProviderIcon(providerId) {
        const icons = {
            aliyun: '🦄',
            openai: '🔮',
            claude: '💎',
            gemini: '⭐',
            deepseek: '🔍',
            zhipu: '🌟'
        };
        return icons[providerId] || '🤖';
    }

    /**
     * 设置事件监听器
     */
    setupEventListeners() {
        // 关闭按钮
        const closeBtn = this.container.querySelector('.close-model-config');
        closeBtn.addEventListener('click', () => this.hide());

        // 点击遮罩层关闭
        this.container.querySelector('.model-config-overlay').addEventListener('click', (e) => {
            if (e.target === e.currentTarget) {
                this.hide();
            }
        });

        // 提供商选择
        const providerGrid = this.container.querySelector('#provider-grid');
        providerGrid.addEventListener('click', (e) => {
            const card = e.target.closest('.provider-card');
            if (card) {
                const providerId = card.dataset.provider;
                this.selectProvider(providerId);
            }
        });

        // 模型选择
        const modelGrid = this.container.querySelector('#model-grid');
        modelGrid.addEventListener('click', (e) => {
            const card = e.target.closest('.model-card');
            if (card) {
                const modelId = card.dataset.model;
                this.selectModel(modelId);
            }
        });

        // 当前服务商API密钥输入
        const apiKeyInput = this.container.querySelector('#model-api-key');
        apiKeyInput.addEventListener('input', (e) => {
            modelConfig.setApiKeyForProvider(modelConfig.currentProvider, e.target.value);
            this.updateKeyStatus();
            // 触发模型配置变化事件，通知其他组件（如并行测试）
            document.dispatchEvent(new CustomEvent('modelConfigChanged'));
        });

        // 切换当前密码可见性
        const toggleBtn = this.container.querySelector('#toggle-api-key');
        toggleBtn.addEventListener('click', () => {
            const input = this.container.querySelector('#model-api-key');
            input.type = input.type === 'password' ? 'text' : 'password';
            toggleBtn.textContent = input.type === 'password' ? '👁' : '🙈';
        });

        // 所有提供商密钥输入事件
        const keysGrid = this.container.querySelector('#keys-grid');
        keysGrid.addEventListener('input', (e) => {
            if (e.target.type === 'password' && e.target.dataset.provider) {
                const providerId = e.target.dataset.provider;
                modelConfig.setApiKeyForProvider(providerId, e.target.value);
                this.updateKeyStatus();
                // 触发模型配置变化事件，通知其他组件（如并行测试）
                document.dispatchEvent(new CustomEvent('modelConfigChanged'));
            }
        });

        // 所有提供商密码可见性切换
        keysGrid.addEventListener('click', (e) => {
            if (e.target.classList.contains('toggle-key-visibility')) {
                const providerId = e.target.dataset.provider;
                const input = this.container.querySelector(`input[data-provider="${providerId}"]`);
                if (input) {
                    input.type = input.type === 'password' ? 'text' : 'password';
                    e.target.textContent = input.type === 'password' ? '👁' : '🙈';
                }
            }
        });

        // 添加自定义服务商按钮
        const addProviderBtn = this.container.querySelector('#add-new-provider');
        addProviderBtn.addEventListener('click', () => {
            this.showAddProviderForm();
        });

        // 保存自定义服务商
        const saveProviderBtn = this.container.querySelector('#save-provider');
        saveProviderBtn.addEventListener('click', () => {
            this.saveCustomProvider();
        });

        // 取消添加服务商
        const cancelAddBtn = this.container.querySelector('#cancel-add-provider');
        cancelAddBtn.addEventListener('click', () => {
            this.hideAddProviderForm();
        });

        // 删除自定义服务商
        const customProvidersGrid = this.container.querySelector('#custom-providers-grid');
        customProvidersGrid.addEventListener('click', (e) => {
            if (e.target.classList.contains('delete-provider')) {
                const providerId = e.target.dataset.provider;
                this.deleteCustomProvider(providerId);
            }
        });

        // 模型参数变化监听
        const modelParams = this.container.querySelector('#model-parameters');
        modelParams.addEventListener('input', (e) => {
            if (e.target.id === 'model-temp' || e.target.id === 'model-top-p') {
                this.syncParametersToMainUI();
            }
        });

        // 测试连接
        const testBtn = this.container.querySelector('#test-connection');
        testBtn.addEventListener('click', () => this.testConnection());

        // 重置配置
        const resetBtn = this.container.querySelector('#reset-config');
        resetBtn.addEventListener('click', () => this.resetConfig());

        // 导出配置
        const exportBtn = this.container.querySelector('#export-config');
        exportBtn.addEventListener('click', () => this.exportConfig());

        // 导入配置
        const importBtn = this.container.querySelector('#import-config');
        importBtn.addEventListener('click', () => this.fileInput.click());

        this.fileInput.addEventListener('change', (e) => {
            if (e.target.files[0]) {
                this.importConfig(e.target.files[0]);
            }
        });

        // ESC键关闭
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isVisible) {
                this.hide();
            }
        });
    }

    /**
     * 选择提供商
     */
    selectProvider(providerId) {
        if (modelConfig.switchProvider(providerId)) {
            this.updateDisplay();
            this.showNotification(`已切换到 ${modelConfig.getCurrentProvider().name}`, 'success');
            // 触发模型配置变化事件，通知其他组件（如并行测试）
            document.dispatchEvent(new CustomEvent('modelConfigChanged'));
        }
    }

    /**
     * 选择模型
     */
    selectModel(modelId) {
        if (modelConfig.switchModel(modelId)) {
            this.updateDisplay();
            this.syncParametersToMainUI(); // 同步参数和模型到主界面
            const model = modelConfig.getCurrentModel();
            this.showNotification(`已选择模型 ${model.name}`, 'success');
            // 触发模型配置变化事件，通知其他组件（如并行测试）
            document.dispatchEvent(new CustomEvent('modelConfigChanged'));
        }
    }

    /**
     * 更新显示
     */
    updateDisplay() {
        // 更新提供商选择
        const providerCards = this.container.querySelectorAll('.provider-card');
        providerCards.forEach(card => {
            card.classList.toggle('active', card.dataset.provider === modelConfig.currentProvider);
        });

        // 更新模型选择
        const modelCards = this.container.querySelectorAll('.model-card');
        modelCards.forEach(card => {
            card.classList.toggle('active', card.dataset.model === modelConfig.currentModel);
        });

        // 更新当前配置信息
        const currentConfig = this.container.querySelector('#current-config');
        currentConfig.innerHTML = this.renderCurrentConfig();

        // 更新当前服务商API密钥输入框
        const apiKeyInput = this.container.querySelector('#model-api-key');
        apiKeyInput.value = modelConfig.getApiKeyForProvider(modelConfig.currentProvider);

        // 更新当前密钥标签
        const keyLabel = this.container.querySelector('#current-key-label');
        const currentProvider = modelConfig.getCurrentProvider();
        keyLabel.textContent = `${currentProvider.name} API密钥：`;

        // 更新模型网格
        const modelGrid = this.container.querySelector('#model-grid');
        modelGrid.innerHTML = this.renderModels();

        // 更新模型参数显示
        const modelParams = this.container.querySelector('#model-parameters');
        modelParams.innerHTML = this.renderModelParameters();

        // 更新所有提供商密钥网格
        const keysGrid = this.container.querySelector('#keys-grid');
        keysGrid.innerHTML = this.renderAllProviderKeys();

        // 更新自定义服务商网格
        const customProvidersGrid = this.container.querySelector('#custom-providers-grid');
        customProvidersGrid.innerHTML = this.renderCustomProviders();

        // 重新绑定模型选择事件
        this.setupModelSelectionEvents();

        // 重新绑定参数事件
        this.setupParameterEvents();

        this.updateKeyStatus();
    }

    /**
     * 设置模型选择事件（因为DOM重新渲染需要重新绑定）
     */
    setupModelSelectionEvents() {
        const modelGrid = this.container.querySelector('#model-grid');
        modelGrid.addEventListener('click', (e) => {
            const card = e.target.closest('.model-card');
            if (card) {
                const modelId = card.dataset.model;
                this.selectModel(modelId);
            }
        });
    }

    /**
     * 设置参数事件监听
     */
    setupParameterEvents() {
        const modelParams = this.container.querySelector('#model-parameters');
        modelParams.addEventListener('input', (e) => {
            if (e.target.id === 'model-temp' || e.target.id === 'model-top-p') {
                this.syncParametersToMainUI();
            }
        });
    }

    /**
     * 显示添加服务商表单
     */
    showAddProviderForm() {
        const form = this.container.querySelector('#add-provider-form');
        form.style.display = 'block';

        // 清空表单
        const formInputs = form.querySelectorAll('input, textarea');
        formInputs.forEach(input => input.value = '');
    }

    /**
     * 隐藏添加服务商表单
     */
    hideAddProviderForm() {
        const form = this.container.querySelector('#add-provider-form');
        form.style.display = 'none';
    }

    /**
     * 保存自定义服务商
     */
    saveCustomProvider() {
        const providerId = this.container.querySelector('#provider-id').value.trim();
        const providerName = this.container.querySelector('#provider-name').value.trim();
        const baseUrl = this.container.querySelector('#provider-baseurl').value.trim();
        const endpoint = this.container.querySelector('#provider-endpoint').value.trim();
        const keyPlaceholder = this.container.querySelector('#provider-key-placeholder').value.trim();
        const authType = this.container.querySelector('#provider-auth-type').value;
        const modelsText = this.container.querySelector('#provider-models').value.trim();

        // 验证必填字段
        if (!providerId || !providerName || !baseUrl || !endpoint || !modelsText) {
            this.showNotification('请填写所有必填字段', 'error');
            return;
        }

        // 解析模型列表
        const models = modelsText.split('\n').filter(line => line.trim()).map(line => {
            const parts = line.split(',').map(p => p.trim());
            if (parts.length >= 3) {
                return {
                    id: parts[0],
                    name: parts[1],
                    maxTokens: parseInt(parts[2]) || 4096,
                    description: parts[3] || ''
                };
            }
            return null;
        }).filter(model => model !== null);

        if (models.length === 0) {
            this.showNotification('请正确填写模型列表', 'error');
            return;
        }

        // 创建配置对象
        const config = {
            name: providerName,
            baseUrl,
            endpoint,
            authType,
            keyPlaceholder,
            models
        };

        // 添加到配置
        if (modelConfig.addCustomProvider(providerId, config)) {
            this.showNotification(`服务商 ${providerName} 添加成功`, 'success');
            this.hideAddProviderForm();
            this.updateDisplay();
        } else {
            this.showNotification('添加失败，服务商ID已存在', 'error');
        }
    }

    /**
     * 删除自定义服务商
     */
    deleteCustomProvider(providerId) {
        const provider = modelConfig.customProviders[providerId];
        if (confirm(`确定要删除服务商 "${provider.name}" 吗？`)) {
            if (modelConfig.removeCustomProvider(providerId)) {
                this.showNotification(`服务商 ${provider.name} 已删除`, 'success');
                this.updateDisplay();
            }
        }
    }

    /**
     * 同步参数到主界面
     */
    syncParametersToMainUI() {
        // 获取参数值
        const modelTempInput = document.getElementById('model-temp');
        const modelTopPInput = document.getElementById('model-top-p');

        if (modelTempInput) {
            const tempValue = parseFloat(modelTempInput.value);
            if (Number.isFinite(tempValue) && window.chatInstance) {
                window.chatInstance.defaultTemperature = tempValue;
                console.log('[ModelConfigUI] Updated chat temperature to:', tempValue);
            }
        }

        if (modelTopPInput) {
            const topPValue = parseFloat(modelTopPInput.value);
            if (Number.isFinite(topPValue) && window.chatInstance) {
                window.chatInstance.defaultTopP = topPValue;
                console.log('[ModelConfigUI] Updated chat topP to:', topPValue);
            }
        }

        // 更新模型名称显示和Chat实例
        const modelNameDisplay = document.getElementById('model-name-display');
        if (modelNameDisplay) {
            const currentModel = modelConfig.getCurrentModel();
            modelNameDisplay.value = currentModel ? currentModel.name : '';

            if (window.chatInstance && window.chatInstance.chatService) {
                window.chatInstance.chatService.updateModelName(modelConfig.currentModel);
                console.log('[ModelConfigUI] Updated chat model to:', modelConfig.currentModel);
            }
        }
    }

    /**
     * 设置模型选择事件（因为DOM重新渲染需要重新绑定）
     */
    setupModelSelectionEvents() {
        const modelGrid = this.container.querySelector('#model-grid');
        modelGrid.addEventListener('click', (e) => {
            const card = e.target.closest('.model-card');
            if (card) {
                const modelId = card.dataset.model;
                this.selectModel(modelId);
            }
        });
    }

    /**
     * 更新密钥状态
     */
    updateKeyStatus() {
        const status = this.container.querySelector('#key-status');
        if (modelConfig.apiKey) {
            status.textContent = '✅ API密钥已配置';
            status.className = 'key-status valid';
        } else {
            status.textContent = '❌ 请配置API密钥';
            status.className = 'key-status invalid';
        }
    }

    /**
     * 测试连接
     */
    async testConnection() {
        const testBtn = this.container.querySelector('#test-connection');
        const originalText = testBtn.textContent;

        if (!modelConfig.validateConfig()) {
            this.showNotification('请先配置完整的API信息', 'error');
            return;
        }

        testBtn.textContent = '测试中...';
        testBtn.disabled = true;

        try {
            // 发送测试请求
            const response = await fetch(modelConfig.getApiUrl(), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': modelConfig.getAuthHeader(),
                },
                body: JSON.stringify({
                    model: modelConfig.currentModel,
                    messages: [{ role: 'user', content: 'Hello' }],
                    max_tokens: 10,
                    stream: false
                })
            });

            if (response.ok) {
                this.showNotification('连接测试成功！', 'success');
            } else {
                const error = await response.text();
                this.showNotification(`连接测试失败: ${error}`, 'error');
            }
        } catch (error) {
            this.showNotification(`连接测试失败: ${error.message}`, 'error');
        } finally {
            testBtn.textContent = originalText;
            testBtn.disabled = false;
        }
    }

    /**
     * 重置配置
     */
    resetConfig() {
        if (confirm('确定要重置为默认配置吗？')) {
            modelConfig.resetToDefault();
            this.updateDisplay();
            this.showNotification('已重置为默认配置', 'success');
        }
    }

    /**
     * 导出配置
     */
    exportConfig() {
        const config = modelConfig.exportConfig();
        const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `model-config-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        this.showNotification('配置已导出', 'success');
    }

    /**
     * 导入配置
     */
    async importConfig(file) {
        try {
            const text = await file.text();
            const config = JSON.parse(text);

            if (config.currentProvider && config.currentModel) {
                modelConfig.currentProvider = config.currentProvider;
                modelConfig.currentModel = config.currentModel;
                if (config.apiKey) {
                    modelConfig.apiKey = config.apiKey;
                }
                modelConfig.saveConfig();
                this.updateDisplay();
                this.showNotification('配置已导入', 'success');
            } else {
                this.showNotification('配置文件格式错误', 'error');
            }
        } catch (error) {
            this.showNotification('导入失败：' + error.message, 'error');
        }
    }

    /**
     * 显示通知
     */
    showNotification(message, type = 'info') {
        // 移除现有的通知
        const existing = this.container.querySelector('.notification');
        if (existing) {
            existing.remove();
        }

        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;

        this.container.querySelector('.model-config-panel').appendChild(notification);

        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 3000);
    }

    /**
     * 显示配置面板
     */
    show() {
        this.isVisible = true;
        this.container.style.display = 'block';
        document.body.style.overflow = 'hidden';
    }

    /**
     * 隐藏配置面板
     */
    hide() {
        this.isVisible = false;
        this.container.style.display = 'none';
        document.body.style.overflow = '';
    }

    /**
     * 添加样式
     */
    addStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .model-config-container {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                z-index: 10000;
                display: none;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            }

            .model-config-overlay {
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.5);
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 20px;
            }

            .model-config-panel {
                background: white;
                border-radius: 12px;
                width: 100%;
                max-width: 800px;
                max-height: 90vh;
                overflow-y: auto;
                box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
                animation: slideIn 0.3s ease;
            }

            @keyframes slideIn {
                from { transform: translateY(-20px); opacity: 0; }
                to { transform: translateY(0); opacity: 1; }
            }

            .model-config-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 20px 24px;
                border-bottom: 1px solid #eee;
                background: #f8f9fa;
                border-radius: 12px 12px 0 0;
            }

            .model-config-header h3 {
                margin: 0;
                color: #333;
                font-size: 18px;
                font-weight: 600;
            }

            .close-model-config {
                background: none;
                border: none;
                font-size: 24px;
                cursor: pointer;
                width: 32px;
                height: 32px;
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: 50%;
                color: #666;
                transition: all 0.2s ease;
            }

            .close-model-config:hover {
                background: #e9ecef;
                color: #333;
            }

            .model-config-body {
                padding: 24px;
            }

            .config-section {
                margin-bottom: 32px;
            }

            .config-section h4 {
                margin: 0 0 16px 0;
                color: #333;
                font-size: 16px;
                font-weight: 600;
            }

            .provider-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                gap: 12px;
                margin-bottom: 16px;
            }

            .provider-card {
                padding: 16px;
                border: 2px solid #e9ecef;
                border-radius: 8px;
                text-align: center;
                cursor: pointer;
                transition: all 0.2s ease;
                background: white;
            }

            .provider-card:hover {
                border-color: #007bff;
                background: #f8f9fa;
            }

            .provider-card.active {
                border-color: #007bff;
                background: #e7f1ff;
            }

            .provider-icon {
                font-size: 24px;
                margin-bottom: 8px;
            }

            .provider-name {
                font-weight: 600;
                color: #333;
                margin-bottom: 4px;
            }

            .provider-desc {
                font-size: 12px;
                color: #666;
                line-height: 1.4;
            }

            .model-grid {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
                gap: 8px;
            }

            .model-card {
                padding: 12px;
                border: 1px solid #dee2e6;
                border-radius: 6px;
                text-align: center;
                cursor: pointer;
                transition: all 0.2s ease;
                background: white;
            }

            .model-card:hover {
                border-color: #007bff;
                background: #f8f9fa;
            }

            .model-card.active {
                border-color: #007bff;
                background: #e7f1ff;
            }

            .model-name {
                font-weight: 500;
                color: #333;
                margin-bottom: 4px;
            }

            .model-tokens {
                font-size: 11px;
                color: #666;
            }

            .api-key-config {
                margin-top: 16px;
            }

            .api-key-config label {
                display: block;
                margin-bottom: 8px;
                font-weight: 500;
                color: #333;
            }

            .input-group {
                display: flex;
                gap: 8px;
                align-items: center;
            }

            .input-group input {
                flex: 1;
                padding: 8px 12px;
                border: 1px solid #dee2e6;
                border-radius: 4px;
                font-size: 14px;
            }

            .toggle-visibility {
                background: none;
                border: 1px solid #dee2e6;
                padding: 8px;
                border-radius: 4px;
                cursor: pointer;
                font-size: 14px;
            }

            .key-status {
                margin-top: 8px;
                padding: 8px;
                border-radius: 4px;
                font-size: 12px;
                font-weight: 500;
            }

            .key-status.valid {
                background: #d4edda;
                color: #155724;
                border: 1px solid #c3e6cb;
            }

            .key-status.invalid {
                background: #f8d7da;
                color: #721c24;
                border: 1px solid #f5c6cb;
            }

            .current-config {
                background: #f8f9fa;
                padding: 16px;
                border-radius: 6px;
                border: 1px solid #e9ecef;
            }

            .config-info p {
                margin: 8px 0;
                font-size: 14px;
                color: #555;
            }

            .api-url {
                font-family: monospace;
                font-size: 12px;
                word-break: break-all;
                color: #666;
            }

            .config-actions {
                display: flex;
                gap: 12px;
                flex-wrap: wrap;
                padding-top: 16px;
                border-top: 1px solid #e9ecef;
            }

            .btn-primary, .btn-secondary {
                padding: 10px 20px;
                border: none;
                border-radius: 6px;
                cursor: pointer;
                font-size: 14px;
                font-weight: 500;
                transition: all 0.2s ease;
            }

            .btn-primary {
                background: #007bff;
                color: white;
            }

            .btn-primary:hover {
                background: #0056b3;
            }

            .btn-primary:disabled {
                background: #6c757d;
                cursor: not-allowed;
            }

            .btn-secondary {
                background: #6c757d;
                color: white;
            }

            .btn-secondary:hover {
                background: #545b62;
            }

            .notification {
                position: absolute;
                top: 20px;
                right: 20px;
                padding: 12px 16px;
                border-radius: 6px;
                color: white;
                font-size: 14px;
                font-weight: 500;
                z-index: 10001;
                animation: slideInRight 0.3s ease;
            }

            .notification.success {
                background: #28a745;
            }

            .notification.error {
                background: #dc3545;
            }

            .notification.info {
                background: #17a2b8;
            }

            @keyframes slideInRight {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }

            @media (max-width: 768px) {
                .provider-grid {
                    grid-template-columns: 1fr;
                }

                .model-grid {
                    grid-template-columns: 1fr;
                }

                .config-actions {
                    flex-direction: column;
                }

                .btn-primary, .btn-secondary {
                    width: 100%;
                }
            }
        `;
        document.head.appendChild(style);
    }
}

// 创建全局UI实例
export const modelConfigUI = new ModelConfigUI();