/**
 * PresetUIManager - Handles the UI interactions for the preset manager
 */
import { PresetManager } from './PresetManager.js';

export class PresetUIManager {
    constructor() {
        this.presetManager = new PresetManager();
        this.container = null;
        this.currentPreset = null;
        this.currentIndex = -1; // tracks the index of the selected preset in the filtered list
        // init() returns a promise; expose it as `ready` so external code can wait until UI & presets are loaded
        this.ready = this.init();
    }

    async init() {
        await this.presetManager.init();
        this.createUI();
        this.bindEvents();
        this.renderPresets();
    }

    createUI() {
        this.container = document.getElementById('preset-container');
        if (!this.container) return;

        this.container.innerHTML = `
            <div class="preset-manager">
                <div class="preset-header">
                    <h2>预设管理器</h2>
                    <div class="preset-actions">
                        <button id="export-presets-btn" class="preset-btn">导出</button>
                        <button id="import-presets-btn" class="preset-btn">导入</button>
                        <button id="add-preset-btn" class="preset-btn primary">添加预设</button>
                    </div>
                </div>

                <div class="preset-filters">
                    <div class="filter-group">
                        <label>标签筛选:</label>
                        <div class="custom-select" id="tab-filter-custom">
                            <div class="custom-select-trigger"><span>全部标签</span></div>
                            <div class="custom-options" id="tab-filter-options">
                                <span class="custom-option selected" data-value="">全部标签</span>
                            </div>
                            <select id="tab-filter" style="display:none">
                                <option value="">全部标签</option>
                            </select>
                        </div>
                    </div>
                    <div class="filter-group">
                        <label>文本框筛选:</label>
                        <div class="custom-select" id="textbox-filter-custom">
                            <div class="custom-select-trigger"><span>全部文本框</span></div>
                            <div class="custom-options" id="textbox-filter-options">
                                <span class="custom-option selected" data-value="">全部文本框</span>
                            </div>
                            <select id="textbox-filter" style="display:none">
                                <option value="">全部文本框</option>
                            </select>
                        </div>
                    </div>
                    <div class="filter-group">
                        <label for="search-input">搜索:</label>
                        <input type="text" id="search-input" placeholder="搜索预设...">
                    </div>
                </div>

                <div class="preset-content">
                    <div class="preset-list">
                        <div class="preset-list-header">
                            <h3>预设列表</h3>
                            <span id="preset-count">0 个预设</span>
                        </div>
                        <div id="preset-items" class="preset-items">
                            <!-- Preset items will be rendered here -->
                        </div>
                    </div>

                    <div class="preset-details">
                        <div class="preset-details-header">
                            <h3>预设详情</h3>
                            <div class="preset-details-actions">
                                <button id="edit-preset-btn" class="preset-btn" style="display: none;">编辑</button>
                                <button id="delete-preset-btn" class="preset-btn danger" style="display: none;">删除</button>
                                <button id="apply-preset-btn" class="preset-btn success" style="display: none;">应用</button>
                            </div>
                        </div>
                        <div id="preset-details-content" class="preset-details-content">
                            <div class="no-preset-selected">
                                <p>选择一个预设以查看详情</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Hidden file input for import -->
            <input type="file" id="import-file-input" accept=".json" style="display: none;">

            <!-- Add/Edit Preset Modal -->
            <div id="preset-modal" class="preset-modal" style="display: none;">
                <div class="preset-modal-content">
                    <div class="preset-modal-header">
                        <h3 id="modal-title">添加预设</h3>
                        <span id="close-modal" class="close-modal">&times;</span>
                    </div>
                    <div class="preset-modal-body">
                        <div class="form-group">
                            <label for="preset-name">预设名称:</label>
                            <input type="text" id="preset-name" placeholder="输入预设名称">
                        </div>
                        <div class="form-group">
                            <label for="preset-description">描述:</label>
                            <textarea id="preset-description" rows="3" placeholder="输入预设描述"></textarea>
                        </div>
                        <div class="form-group">
                            <label>适用标签:</label>
                            <div class="checkbox-group">
                                <label><input type="checkbox" value="主对话"> 主对话</label>
                                <label><input type="checkbox" value="待测试prompt配置"> 待测试prompt配置</label>
                                <label><input type="checkbox" value="并行测试"> 并行测试</label>
                            </div>
                        </div>
                        <div class="form-group">
                            <label>适用文本框:</label>
                            <div class="checkbox-group" id="textbox-checkboxes">
                                <!-- Textbox checkboxes will be populated based on selected tabs -->
                            </div>
                        </div>
                        <div class="form-group">
                            <label for="preset-text">预设文本:</label>
                            <textarea id="preset-text" rows="8" placeholder="输入预设文本内容"></textarea>
                        </div>
                    </div>
                    <div class="preset-modal-footer">
                        <button id="cancel-modal-btn" class="preset-btn">取消</button>
                        <button id="save-modal-btn" class="preset-btn primary">保存</button>
                    </div>
                </div>
            </div>
        `;

        this.updateFilterOptions();
    }

    bindEvents() {
        // Custom select behaviors (same pattern as main chat tab)
        const tabCustom = document.getElementById('tab-filter-custom');
        const tabTrigger = tabCustom.querySelector('.custom-select-trigger');
        const tabOptions = tabCustom.querySelectorAll('.custom-option');
        const tabHidden = document.getElementById('tab-filter');

        // Open on hover for mouse/trackpad; keep click toggle as fallback
        let tabHoverTimer = null;
        tabCustom.addEventListener('mouseenter', () => {
            clearTimeout(tabHoverTimer);
            tabCustom.classList.add('open');
        });
        tabCustom.addEventListener('mouseleave', () => {
            tabHoverTimer = setTimeout(() => tabCustom.classList.remove('open'), 50);
        });
        tabTrigger.addEventListener('click', () => {
            tabCustom.classList.toggle('open');
        });

        tabOptions.forEach(option => {
            option.addEventListener('click', () => {
                tabOptions.forEach(opt => opt.classList.remove('selected'));
                option.classList.add('selected');
                tabTrigger.querySelector('span').textContent = option.textContent;
                tabCustom.classList.remove('open');

                // update hidden select and trigger change
                tabHidden.value = option.dataset.value;
                const changeEvent = new Event('change', { bubbles: true });
                tabHidden.dispatchEvent(changeEvent);
            });
        });

        // Textbox custom select
        const tbCustom = document.getElementById('textbox-filter-custom');
        const tbTrigger = tbCustom.querySelector('.custom-select-trigger');
        const tbHidden = document.getElementById('textbox-filter');

        const rebuildTextboxOptions = () => {
            const optionsContainer = document.getElementById('textbox-filter-options');
            const current = this.presetManager.getAvailableTextBoxes(document.getElementById('tab-filter').value);

            // reset options
            optionsContainer.innerHTML = '';
            const allOpt = document.createElement('span');
            allOpt.className = 'custom-option selected';
            allOpt.dataset.value = '';
            allOpt.textContent = '全部文本框';
            optionsContainer.appendChild(allOpt);

            current.forEach(textBox => {
                const opt = document.createElement('span');
                opt.className = 'custom-option';
                opt.dataset.value = textBox;
                opt.textContent = textBox;
                optionsContainer.appendChild(opt);
            });

            // update listeners
            const tbOptions = optionsContainer.querySelectorAll('.custom-option');
            tbOptions.forEach(option => {
                option.addEventListener('click', () => {
                    tbOptions.forEach(opt => opt.classList.remove('selected'));
                    option.classList.add('selected');
                    tbTrigger.querySelector('span').textContent = option.textContent;
                    tbCustom.classList.remove('open');

                    tbHidden.value = option.dataset.value;
                    const changeEvent = new Event('change', { bubbles: true });
                    tbHidden.dispatchEvent(changeEvent);
                });
            });
        };

        // Open on hover for mouse/trackpad; keep click toggle as fallback
        let tbHoverTimer = null;
        tbCustom.addEventListener('mouseenter', () => {
            clearTimeout(tbHoverTimer);
            tbCustom.classList.add('open');
        });
        tbCustom.addEventListener('mouseleave', () => {
            tbHoverTimer = setTimeout(() => tbCustom.classList.remove('open'), 50);
        });
        tbTrigger.addEventListener('click', () => {
            tbCustom.classList.toggle('open');
        });

        // Keep native 'change' driven logic for filters
        tabHidden.addEventListener('change', (e) => {
            this.presetManager.setFilter('tab', e.target.value);
            // on tab change, reset textbox display and rebuild its options
            document.getElementById('textbox-filter').value = '';
            const tbOptionsContainer = document.getElementById('textbox-filter-options');
            tbOptionsContainer.querySelectorAll('.custom-option').forEach(opt => opt.classList.remove('selected'));
            // set first option (全部文本框) as selected and update trigger text
            const first = tbOptionsContainer.querySelector('.custom-option[data-value=""]');
            if (first) {
                first.classList.add('selected');
                tbTrigger.querySelector('span').textContent = first.textContent;
            }
            this.updateTextboxFilter(); // maintain data source
            rebuildTextboxOptions();    // rebuild custom options
            this.renderPresets();
        });

        document.getElementById('textbox-filter').addEventListener('change', (e) => {
            this.presetManager.setFilter('textbox', e.target.value);
            this.renderPresets();
        });

        document.getElementById('search-input').addEventListener('input', (e) => {
            this.presetManager.setFilter('search', e.target.value);
            this.renderPresets();
        });

        // Close custom selects when clicking outside
        window.addEventListener('click', (e) => {
            [tabCustom, tbCustom].forEach(cs => {
                if (cs && !cs.contains(e.target)) cs.classList.remove('open');
            });
        });

        // Accessibility: open on keyboard focus, close on blur
        [tabTrigger, tbTrigger].forEach(trigger => {
            trigger.setAttribute('tabindex', '0');
            trigger.addEventListener('focus', () => trigger.parentElement.classList.add('open'));
            trigger.addEventListener('blur', () => trigger.parentElement.classList.remove('open'));
        });

        // Action button events
        document.getElementById('export-presets-btn').addEventListener('click', () => this.exportPresets());
        document.getElementById('import-presets-btn').addEventListener('click', () => this.triggerImport());
        document.getElementById('add-preset-btn').addEventListener('click', () => this.showAddPresetModal());
        document.getElementById('edit-preset-btn').addEventListener('click', () => this.showEditPresetModal());
        document.getElementById('delete-preset-btn').addEventListener('click', () => this.deleteCurrentPreset());
        document.getElementById('apply-preset-btn').addEventListener('click', () => this.applyCurrentPreset());

        // Modal events
        document.getElementById('close-modal').addEventListener('click', () => this.hideModal());
        document.getElementById('cancel-modal-btn').addEventListener('click', () => this.hideModal());
        document.getElementById('save-modal-btn').addEventListener('click', () => this.savePresetFromModal());

        // Tab checkbox events
        document.querySelectorAll('#preset-modal input[type="checkbox"][value]').forEach(checkbox => {
            if (['主对话', '待测试prompt配置', '并行测试'].includes(checkbox.value)) {
                checkbox.addEventListener('change', () => this.updateTextboxCheckboxes());
            }
        });
    
        // File input event
        document.getElementById('import-file-input').addEventListener('change', (e) => this.handleImportFile(e));
    
        // Keyboard navigation for preset list: Up/Down to change selection, Enter to apply
        // Make the preset-items container focusable so it receives keyboard events
        const presetItemsContainer = document.getElementById('preset-items');
        if (presetItemsContainer) {
            presetItemsContainer.setAttribute('tabindex', '0');
            presetItemsContainer.addEventListener('keydown', (e) => {
                const items = Array.from(presetItemsContainer.querySelectorAll('.preset-item'));
                if (items.length === 0) return;
    
                if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    if (this.currentIndex < items.length - 1) this.currentIndex++;
                    else this.currentIndex = 0;
    
                    const item = items[this.currentIndex];
                    const presetName = item.dataset.presetName;
                    const preset = this.presetManager.getPresetByName(presetName);
                    if (preset) this.selectPreset(preset, item);
                    item.scrollIntoView({ block: 'nearest' });
                } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    if (this.currentIndex > 0) this.currentIndex--;
                    else this.currentIndex = items.length - 1;
    
                    const item = items[this.currentIndex];
                    const presetName = item.dataset.presetName;
                    const preset = this.presetManager.getPresetByName(presetName);
                    if (preset) this.selectPreset(preset, item);
                    item.scrollIntoView({ block: 'nearest' });
                } else if (e.key === 'Enter') {
                    e.preventDefault();
                    if (this.currentPreset) this.applyCurrentPreset();
                }
            });
        }
    }

    updateFilterOptions() {
        // Update tab filter (hidden select + custom options)
        const tabFilter = document.getElementById('tab-filter');
        const tabOptionsContainer = document.getElementById('tab-filter-options');
        // clear existing (keep default first option in hidden select)
        tabFilter.innerHTML = '<option value="">全部标签</option>';
        tabOptionsContainer.innerHTML = '';
        // default custom option
        const allOpt = document.createElement('span');
        allOpt.className = 'custom-option selected';
        allOpt.dataset.value = '';
        allOpt.textContent = '全部标签';
        tabOptionsContainer.appendChild(allOpt);

        const tabs = this.presetManager.getAvailableTabs();
        tabs.forEach(tab => {
            // hidden select option
            const option = document.createElement('option');
            option.value = tab;
            option.textContent = tab;
            tabFilter.appendChild(option);
            // custom option
            const copt = document.createElement('span');
            copt.className = 'custom-option';
            copt.dataset.value = tab;
            copt.textContent = tab;
            tabOptionsContainer.appendChild(copt);
        });

        // update trigger text
        const tabTrigger = document.querySelector('#tab-filter-custom .custom-select-trigger span');
        if (tabTrigger) tabTrigger.textContent = '全部标签';

        // Re-bind custom option clicks for tab filter
        const tabCustom = document.getElementById('tab-filter-custom');
        const tabOptions = tabCustom.querySelectorAll('.custom-option');
        const tabHidden = document.getElementById('tab-filter');
        tabOptions.forEach(option => {
            option.addEventListener('click', () => {
                tabOptions.forEach(opt => opt.classList.remove('selected'));
                option.classList.add('selected');
                tabTrigger.textContent = option.textContent;
                tabCustom.classList.remove('open');
                tabHidden.value = option.dataset.value;
                tabHidden.dispatchEvent(new Event('change', { bubbles: true }));
            });
        });

        // Update textbox filter datasource and custom options
        this.updateTextboxFilter();
    }

    updateTextboxFilter() {
        const textboxFilter = document.getElementById('textbox-filter');
        const selectedTab = document.getElementById('tab-filter').value;
        const textBoxes = this.presetManager.getAvailableTextBoxes(selectedTab);
        
        // Rebuild hidden select options
        textboxFilter.innerHTML = '<option value="">全部文本框</option>';
        textBoxes.forEach(textBox => {
            const option = document.createElement('option');
            option.value = textBox;
            option.textContent = textBox;
            textboxFilter.appendChild(option);
        });

        // Rebuild custom options list
        const tbOptionsContainer = document.getElementById('textbox-filter-options');
        tbOptionsContainer.innerHTML = '';
        const allOpt = document.createElement('span');
        allOpt.className = 'custom-option selected';
        allOpt.dataset.value = '';
        allOpt.textContent = '全部文本框';
        tbOptionsContainer.appendChild(allOpt);

        textBoxes.forEach(textBox => {
            const copt = document.createElement('span');
            copt.className = 'custom-option';
            copt.dataset.value = textBox;
            copt.textContent = textBox;
            tbOptionsContainer.appendChild(copt);
        });

        // reset trigger label
        const tbTrigger = document.querySelector('#textbox-filter-custom .custom-select-trigger span');
        if (tbTrigger) tbTrigger.textContent = '全部文本框';

        // Bind click handlers to custom options
        const tbCustom = document.getElementById('textbox-filter-custom');
        const tbOptions = tbCustom.querySelectorAll('.custom-option');
        const tbHidden = document.getElementById('textbox-filter');
        tbOptions.forEach(option => {
            option.addEventListener('click', () => {
                tbOptions.forEach(opt => opt.classList.remove('selected'));
                option.classList.add('selected');
                tbTrigger.textContent = option.textContent;
                tbCustom.classList.remove('open');
                tbHidden.value = option.dataset.value;
                tbHidden.dispatchEvent(new Event('change', { bubbles: true }));
            });
        });
    }

    updateTextboxCheckboxes() {
        const container = document.getElementById('textbox-checkboxes');
        const selectedTabs = Array.from(document.querySelectorAll('#preset-modal input[type="checkbox"][value]:checked'))
            .map(cb => cb.value);

        const allTextBoxes = new Set();
        selectedTabs.forEach(tab => {
            // Get all possible textboxes for this tab from the mapping
            const textBoxesForTab = this.presetManager.textBoxMappings[tab];
            if (textBoxesForTab) {
                Object.keys(textBoxesForTab).forEach(textBox => allTextBoxes.add(textBox));
            }
        });

        container.innerHTML = '';
        if (allTextBoxes.size === 0) {
            container.innerHTML = '<p style="color: #999; font-style: italic;">请先选择适用标签</p>';
        } else {
            allTextBoxes.forEach(textBox => {
                const label = document.createElement('label');
                label.innerHTML = `<input type="checkbox" value="${textBox}"> ${textBox}`;
                container.appendChild(label);
            });
        }
    }

    renderPresets() {
        const container = document.getElementById('preset-items');
        const presets = this.presetManager.getFilteredPresets();
        const countElement = document.getElementById('preset-count');
    
        countElement.textContent = `${presets.length} 个预设`;
    
        container.innerHTML = '';
        presets.forEach((preset, idx) => {
            const item = document.createElement('div');
            item.className = 'preset-item';
            item.dataset.index = idx;
            item.dataset.presetName = preset.name;
            item.tabIndex = 0;
            item.innerHTML = `
                <div class="preset-item-header">
                    <h4>${preset.name}</h4>
                    <div class="preset-item-tags">
                        ${(Array.isArray(preset.tabs) ? preset.tabs : []).map(tab => `<span class="tag">${tab}</span>`).join('')}
                    </div>
                </div>
                <p class="preset-item-description">${preset.description}</p>
                <div class="preset-item-textboxes">
                    ${(Array.isArray(preset.textboxes) ? preset.textboxes : []).map(textBox => `<span class="textbox-tag">${textBox}</span>`).join('')}
                </div>
            `;
    
            item.addEventListener('click', (e) => {
                this.currentIndex = idx;
                this.selectPreset(preset, e.currentTarget);
            });
            container.appendChild(item);
        });
    
        if (presets.length === 0) {
            container.innerHTML = '<div class="no-presets">没有找到匹配的预设</div>';
            this.currentIndex = -1;
            this.currentPreset = null;
            // hide action buttons
            document.getElementById('edit-preset-btn').style.display = 'none';
            document.getElementById('delete-preset-btn').style.display = 'none';
            document.getElementById('apply-preset-btn').style.display = 'none';
        } else {
            // if a previous selection index is still valid, restore selection
            if (this.currentIndex >= 0 && this.currentIndex < presets.length) {
                const selEl = container.querySelector(`.preset-item[data-index="${this.currentIndex}"]`);
                if (selEl) {
                    const preset = presets[this.currentIndex];
                    this.selectPreset(preset, selEl);
                }
            }
        }
    }

    selectPreset(preset, element) {
        // preset: preset object; element: the .preset-item DOM element that was selected
        this.currentPreset = preset;
        if (element && element.dataset && typeof element.dataset.index !== 'undefined') {
            this.currentIndex = parseInt(element.dataset.index, 10);
        }
    
        // Update UI to show selected preset
        document.querySelectorAll('.preset-item').forEach(item => {
            item.classList.remove('selected');
        });
        if (element) element.classList.add('selected');
    
        // Show preset details
        this.showPresetDetails(preset);
    
        // Enable action buttons
        document.getElementById('edit-preset-btn').style.display = 'inline-block';
        document.getElementById('delete-preset-btn').style.display = 'inline-block';
        document.getElementById('apply-preset-btn').style.display = 'inline-block';
    }

    showPresetDetails(preset) {
        const container = document.getElementById('preset-details-content');
        container.innerHTML = `
            <div class="preset-detail">
                <h4>${preset.name}</h4>
                <p class="preset-description">${preset.description}</p>
                <div class="preset-meta">
                    <div class="meta-section">
                        <h5>适用标签:</h5>
                        <div class="tag-list">
                            ${(Array.isArray(preset.tabs) ? preset.tabs : []).map(tab => `<span class="tag">${tab}</span>`).join('')}
                        </div>
                    </div>
                    <div class="meta-section">
                        <h5>适用文本框:</h5>
                        <div class="tag-list">
                            ${(Array.isArray(preset.textboxes) ? preset.textboxes : []).map(textBox => `<span class="textbox-tag">${textBox}</span>`).join('')}
                        </div>
                    </div>
                </div>
                <div class="preset-text-preview">
                    <h5>预设文本:</h5>
                    <pre>${preset.text}</pre>
                </div>
            </div>
        `;
    }

    showAddPresetModal() {
        this.currentPreset = null;
        document.getElementById('modal-title').textContent = '添加预设';
        document.getElementById('preset-name').value = '';
        document.getElementById('preset-description').value = '';
        document.getElementById('preset-text').value = '';
        
        // Clear checkboxes
        document.querySelectorAll('#preset-modal input[type="checkbox"]').forEach(cb => cb.checked = false);
        
        document.getElementById('preset-modal').style.display = 'block';
        
        // Update textbox checkboxes after modal is visible
        setTimeout(() => {
            this.updateTextboxCheckboxes();
        }, 50);
    }

    showEditPresetModal() {
        if (!this.currentPreset) return;

        document.getElementById('modal-title').textContent = '编辑预设';
        document.getElementById('preset-name').value = this.currentPreset.name;
        document.getElementById('preset-description').value = this.currentPreset.description;
        document.getElementById('preset-text').value = this.currentPreset.text;

        // Set tab checkboxes
        document.querySelectorAll('#preset-modal input[type="checkbox"][value]').forEach(cb => {
            if (['主对话', '待测试prompt配置', '并行测试'].includes(cb.value)) {
                cb.checked = this.currentPreset.tabs.includes(cb.value);
            }
        });

        this.updateTextboxCheckboxes();

        // Set textbox checkboxes
        setTimeout(() => {
            document.querySelectorAll('#textbox-checkboxes input[type="checkbox"]').forEach(cb => {
                cb.checked = (Array.isArray(this.currentPreset.textboxes) ? this.currentPreset.textboxes : []).includes(cb.value);
            });
        }, 100);

        document.getElementById('preset-modal').style.display = 'block';
    }

    hideModal() {
        document.getElementById('preset-modal').style.display = 'none';
    }

    savePresetFromModal() {
        const name = document.getElementById('preset-name').value.trim();
        const description = document.getElementById('preset-description').value.trim();
        const text = document.getElementById('preset-text').value.trim();

        if (!name || !text) {
            alert('请填写预设名称和文本内容');
            return;
        }

        const tabs = Array.from(document.querySelectorAll('#preset-modal input[type="checkbox"][value]:checked'))
            .map(cb => cb.value)
            .filter(value => ['主对话', '待测试prompt配置', '并行测试'].includes(value));

        const textBoxes = Array.from(document.querySelectorAll('#textbox-checkboxes input[type="checkbox"]:checked'))
            .map(cb => cb.value);

        if (tabs.length === 0) {
            alert('请至少选择一个适用标签');
            return;
        }

        if (textBoxes.length === 0) {
            alert('请至少选择一个适用文本框');
            return;
        }

        const preset = {
            name,
            description,
            tabs,
            // save using normalized "textboxes" key
            textboxes: textBoxes,
            text
        };

        this.presetManager.addPreset(preset);
        this.renderPresets();
        this.hideModal();
    }

    deleteCurrentPreset() {
        if (!this.currentPreset) return;

        this.presetManager.deletePreset(this.currentPreset.name);
        this.renderPresets();
        
        // Clear details view
        document.getElementById('preset-details-content').innerHTML = `
            <div class="no-preset-selected">
                <p>选择一个预设以查看详情</p>
            </div>
        `;
        
        // Hide action buttons
        document.getElementById('edit-preset-btn').style.display = 'none';
        document.getElementById('delete-preset-btn').style.display = 'none';
        document.getElementById('apply-preset-btn').style.display = 'none';
        
        this.currentPreset = null;
    }

    applyCurrentPreset() {
        if (!this.currentPreset) return;

        // Find which tabs this preset can be applied to
        const applicableTabs = (Array.isArray(this.currentPreset.tabs) ? this.currentPreset.tabs : []).filter(tab => {
            return ['主对话', '待测试prompt配置', '并行测试'].includes(tab);
        });

        if (applicableTabs.length === 0) {
            alert('此预设没有适用的标签页');
            return;
        }

        // If multiple tabs, let user choose which tab to apply to
        let selectedTabName;
        if (applicableTabs.length > 1) {
            const choice = prompt(`选择要应用的标签页:\n${applicableTabs.map((tab, i) => `${i + 1}. ${tab}`).join('\n')}\n\n输入数字 (1-${applicableTabs.length}):`);
            const index = parseInt(choice) - 1;
            
            if (isNaN(index) || index < 0 || index >= applicableTabs.length) {
                alert('无效选择');
                return;
            }

            selectedTabName = applicableTabs[index];
        } else {
            // Only one tab, use it directly
            selectedTabName = applicableTabs[0];
        }

        // Find applicable textboxes for selected tab
        const applicableTextBoxes = (Array.isArray(this.currentPreset.textboxes) ? this.currentPreset.textboxes : []).filter(textBox => {
            return this.presetManager.getAvailableTextBoxes(selectedTabName).includes(textBox);
        });

        if (applicableTextBoxes.length === 0) {
            alert('此预设没有适用于所选标签页的文本框');
            return;
        }

        // If multiple textboxes, let user choose
        let selectedTextBoxName;
        if (applicableTextBoxes.length > 1) {
            const choice = prompt(`选择要应用的文本框:\n${applicableTextBoxes.map((tb, i) => `${i + 1}. ${tb}`).join('\n')}\n\n输入数字 (1-${applicableTextBoxes.length}):`);
            const index = parseInt(choice) - 1;
            
            if (isNaN(index) || index < 0 || index >= applicableTextBoxes.length) {
                alert('无效选择');
                return;
            }

            selectedTextBoxName = applicableTextBoxes[index];
        } else {
            // Only one textbox, use it directly
            selectedTextBoxName = applicableTextBoxes[0];
        }

        // Switch to the target tab and apply the preset
        this.switchToTabAndApply(selectedTabName, selectedTextBoxName);
    }

    switchToTabAndApply(tabName, textBoxName) {
        // Map tab names to tab IDs
        const tabIdMap = {
            '主对话': 'chat-tab',
            '待测试prompt配置': 'scenario-tab',
            '并行测试': 'parallel-tab'
        };

        const targetTabId = tabIdMap[tabName];
        if (!targetTabId) {
            alert('无效的标签页');
            return;
        }

        // Switch to the target tab: ensure both indicator and displayed content change
        const targetTabLink = document.querySelector(`.tab-link[data-tab="${targetTabId}"]`);
        const targetTabContent = document.getElementById(targetTabId);

        if (targetTabLink && targetTabContent) {
            // Hide all tab contents and deactivate all links
            document.querySelectorAll('.tab-content').forEach(content => {
                content.classList.remove('active');
                // If UI uses display toggling, ensure visibility switch as well
                content.style.display = 'none';
            });
            document.querySelectorAll('.tab-link').forEach(tab => tab.classList.remove('active'));

            // Activate selected
            targetTabLink.classList.add('active');
            targetTabContent.classList.add('active');
            // Ensure it is visible
            targetTabContent.style.display = 'flex';

            // Apply the preset after switching
            setTimeout(() => {
                this.applyToTextBox(tabName, textBoxName);
            }, 50);
        } else {
            alert('找不到目标标签页');
        }
    }

    applyToTextBox(tabName, textBoxName) {
        const element = this.presetManager.getTextBoxElement(tabName, textBoxName);
        if (!element) {
            alert(`找不到文本框 "${textBoxName}"`);
            return;
        }

        if (!this.currentPreset) {
            console.warn('[PresetUIManager] applyToTextBox called without currentPreset', { tabName, textBoxName, element });
            return;
        }

        const presetName = this.currentPreset.name;
        console.debug(`[PresetUIManager] Applying preset "${presetName}" to ${tabName}/${textBoxName}`, element);

        try {
            const applied = this.presetManager.applyPresetToTextbox(presetName, element);
            if (applied) {
                console.info(`[PresetUIManager] Preset "${presetName}" applied via PresetManager`, { tabName, textBoxName });
                return;
            }

            // Fallback: legacy behavior if manager couldn't apply
            console.warn('[PresetUIManager] PresetManager.applyPresetToTextbox returned false; falling back to legacy assignment', { presetName, tabName, textBoxName });
            if ('value' in element) {
                element.value = this.currentPreset.text;
                if (typeof element.onchange === 'function') {
                    element.onchange();
                }
                element.dispatchEvent(new Event('input', { bubbles: true }));
            } else if (element.isContentEditable) {
                element.innerText = this.currentPreset.text;
                element.dispatchEvent(new Event('input', { bubbles: true }));
            } else if ('textContent' in element) {
                element.textContent = this.currentPreset.text;
            } else if ('innerText' in element) {
                element.innerText = this.currentPreset.text;
            } else {
                alert(`无法将预设应用到文本框 "${textBoxName}" (不支持的元素类型)`);
            }
        } catch (err) {
            console.error('[PresetUIManager] Error applying preset via PresetManager', err);
            alert(`将预设应用到 "${textBoxName}" 时出错: ${err && err.message ? err.message : err}`);
        }
    }

    exportPresets() {
        const data = this.presetManager.exportPresets();
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `presets_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
        // No success popup
    }

    triggerImport() {
        document.getElementById('import-file-input').click();
    }
    
    handleImportFile(event) {
        const file = event.target.files[0];
        if (!file) return;
    
        const reader = new FileReader();
        reader.onload = (e) => {
            const success = this.presetManager.importPresets(e.target.result);
            if (success) {
                this.updateFilterOptions();
                this.renderPresets();
                // No success popup
            } else {
                alert('预设导入失败，请检查文件格式');
            }
        };
        reader.readAsText(file);
        
        // Reset file input
        event.target.value = '';
    }

    /**
     * Parse URL search parameters and apply presets specified by `preset` parameter.
     * Usage:
     *   ?preset=Preset%20Name
     *   ?preset=Name1,Name2
     *
     * Preset names are URL-decoded and matched by exact name against loaded presets.
     */
    async parseAndApplyPresetsFromUrl() {
        try {
            const params = new URLSearchParams(window.location.search);
            const presetParam = params.get('preset');
            if (!presetParam) return;

            // Support comma-separated list of preset names
            const names = presetParam.split(',').map(s => decodeURIComponent(s.trim())).filter(Boolean);
            if (names.length === 0) return;

            // Ensure the manager is ready
            if (this.ready) {
                await this.ready;
            }

            await this.applyPresetsByNames(names);
        } catch (err) {
            console.error('[PresetUIManager] Failed to parse/apply presets from URL:', err);
        }
    }

    /**
     * Apply presets by their names. For each preset, try all declared tabs and textboxes
     * and apply the preset text to the first matching element. The UI will switch to
     * the tab when applying so users can see the result.
     */
    async applyPresetsByNames(names = []) {
        if (!Array.isArray(names) || names.length === 0) return;

        for (const name of names) {
            const preset = this.presetManager.getPresetByName(name);
            if (!preset) {
                console.warn(`[PresetUIManager] Preset not found: ${name}`);
                continue;
            }

            const tabs = Array.isArray(preset.tabs) ? preset.tabs : [];
            const textboxes = Array.isArray(preset.textboxes) ? preset.textboxes : [];

            // Try each tab/textbox pair until one succeeds for visibility; still attempt all to set multiple fields
            for (const tab of tabs) {
                for (const textbox of textboxes) {
                    // Temporarily set currentPreset so existing apply helpers work
                    this.currentPreset = preset;
                    // switchToTabAndApply will switch UI tab and call applyToTextBox which reads this.currentPreset
                    try {
                        this.switchToTabAndApply(tab, textbox);
                    } catch (err) {
                        console.warn(`[PresetUIManager] Failed to switch/apply preset "${name}" to ${tab} / ${textbox}:`, err);
                    }
                    // Wait briefly to give DOM/visibility changes time to take effect before next application
                    await new Promise(r => setTimeout(r, 80));
                }
            }
        }

        // Update UI lists / selection state
        this.updateFilterOptions();
        this.renderPresets();
    }
}