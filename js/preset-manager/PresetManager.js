/**
 * PresetManager - Manages the preset library for text templates
 */
export class PresetManager {
    constructor() {
        this.presets = [];
        this.filteredPresets = [];
        this.currentFilter = {
            tab: '',
            textbox: '',
            search: ''
        };
        this.textBoxMappings = {
            '主对话': {
                '系统提示词泡泡': 'system-prompt-message-inner',
                '初始响应': 'initial-response',
                '响应提示': 'response-prompt'
            },
            '待测试prompt配置': {
                '场景结构编辑': 'yaml-editor-textarea',
                '模板内容': 'template-input',
                'LLM上下文': 'llm-context',
                '生成指令': 'llm-instruction'
            },
            '并行测试': {
                '初始消息': 'pt-initial-message',
                '自动回复提示': 'pt-auto-response'
            }
        };
        this.init();
    }

    // Normalize preset object to expected schema
    normalizePreset(p) {
        const tabs = Array.isArray(p.tabs) ? p.tabs : [];
        // Support both "textboxes" and "textBoxes"
        const textboxesRaw = Array.isArray(p.textboxes) ? p.textboxes
            : (Array.isArray(p.textBoxes) ? p.textBoxes : []);
        return {
            name: p.name || '',
            description: p.description || '',
            tabs,
            textboxes: textboxesRaw,
            text: p.text || ''
        };
    }

    async init() {
        await this.loadDefaultPresets();
    }

    async loadDefaultPresets() {
        try {
            const response = await fetch('js/preset-manager/presets/default.json');
            const data = await response.json();
            const rawPresets = data.presets || [];
            this.presets = rawPresets.map(p => this.normalizePreset(p));
            this.applyFilters();
        } catch (error) {
            console.error('Failed to load default presets:', error);
            this.presets = [];
        }
    }

    applyFilters() {
        this.filteredPresets = this.presets.filter(preset => {
            const tabs = Array.isArray(preset.tabs) ? preset.tabs : [];
            const textboxes = Array.isArray(preset.textboxes) ? preset.textboxes : [];

            // Tab filter
            if (this.currentFilter.tab && !tabs.includes(this.currentFilter.tab)) {
                return false;
            }

            // Textbox filter
            if (this.currentFilter.textbox && !textboxes.includes(this.currentFilter.textbox)) {
                return false;
            }

            // Search filter
            if (this.currentFilter.search) {
                const searchTerm = this.currentFilter.search.toLowerCase();
                const searchableText = [
                    preset.name || '',
                    preset.description || '',
                    preset.text || '',
                    ...tabs,
                    ...textboxes
                ].join(' ').toLowerCase();
                
                if (!searchableText.includes(searchTerm)) {
                    return false;
                }
            }

            return true;
        });
    }

    setFilter(filterType, value) {
        this.currentFilter[filterType] = value;
        this.applyFilters();
    }

    getPresetByName(name) {
        return this.presets.find(preset => preset.name === name);
    }

    getAllPresets() {
        return this.presets;
    }

    getFilteredPresets() {
        return this.filteredPresets;
    }

    getAvailableTabs() {
        const tabs = new Set();
        this.presets.forEach(preset => {
            (Array.isArray(preset.tabs) ? preset.tabs : []).forEach(tab => tabs.add(tab));
        });
        return Array.from(tabs);
    }

    getAvailableTextBoxes(tab) {
        const textBoxes = new Set();
        this.presets.forEach(preset => {
            const tabs = Array.isArray(preset.tabs) ? preset.tabs : [];
            const boxes = Array.isArray(preset.textboxes) ? preset.textboxes : [];
            if (!tab || tabs.includes(tab)) {
                boxes.forEach(textBox => textBoxes.add(textBox));
            }
        });
        return Array.from(textBoxes);
    }

    addPreset(preset) {
        const normalized = this.normalizePreset(preset);
        // Check if preset with same name already exists
        const existingIndex = this.presets.findIndex(p => p.name === normalized.name);
        if (existingIndex !== -1) {
            this.presets[existingIndex] = normalized;
        } else {
            this.presets.push(normalized);
        }
        this.applyFilters();
    }

    deletePreset(name) {
        this.presets = this.presets.filter(preset => preset.name !== name);
        this.applyFilters();
    }

    exportPresets() {
        return JSON.stringify({
            presets: this.presets,
            exportDate: new Date().toISOString(),
            version: '1.0'
        }, null, 2);
    }

    importPresets(jsonString) {
        try {
            const data = JSON.parse(jsonString);
            if (data.presets && Array.isArray(data.presets)) {
                this.presets = data.presets.map(p => this.normalizePreset(p));
                this.applyFilters();
                return true;
            }
            return false;
        } catch (error) {
            console.error('Failed to import presets:', error);
            return false;
        }
    }

    applyPresetToTextbox(presetName, textboxElement) {
        console.log(`[PresetManager] applyPresetToTextbox called: presetName=${presetName}`, textboxElement);
        const preset = this.getPresetByName(presetName);
        if (!preset || !textboxElement) {
            console.warn('[PresetManager] applyPresetToTextbox - missing preset or element', { preset, textboxElement });
            return false;
        }
    
        const text = preset.text || '';
        const tag = (textboxElement.tagName || '').toLowerCase();
    
        // If it's a form control with a value property (input/textarea/select)
        if (tag === 'input' || tag === 'textarea' || 'value' in textboxElement) {
            try {
                console.debug(`[PresetManager] Setting .value on <${tag || 'unknown'}> element`);
                textboxElement.value = text;
                // Dispatch input/change events so other listeners react
                textboxElement.dispatchEvent(new Event('input', { bubbles: true }));
                textboxElement.dispatchEvent(new Event('change', { bubbles: true }));
                console.info('[PresetManager] Applied preset to value and dispatched input/change events', { presetName, element: textboxElement });
            } catch (e) {
                console.error('[PresetManager] Failed to set .value on element', textboxElement, e);
                return false;
            }
            return true;
        }
    
        // Contenteditable elements
        if (textboxElement.isContentEditable) {
            console.debug('[PresetManager] Setting innerText on contentEditable element');
            textboxElement.innerText = text;
            textboxElement.dispatchEvent(new Event('input', { bubbles: true }));
            console.info('[PresetManager] Applied preset to contentEditable element', { presetName, element: textboxElement });
            return true;
        }
    
        // Generic elements: set textContent (fall back to innerText)
        if ('textContent' in textboxElement) {
            console.debug('[PresetManager] Setting textContent on element', textboxElement);
            textboxElement.textContent = text;
            console.info('[PresetManager] Applied preset to textContent', { presetName, element: textboxElement });
            return true;
        }
        if ('innerText' in textboxElement) {
            console.debug('[PresetManager] Setting innerText on element', textboxElement);
            textboxElement.innerText = text;
            console.info('[PresetManager] Applied preset to innerText', { presetName, element: textboxElement });
            return true;
        }
    
        console.warn('[PresetManager] Could not apply preset to element (no suitable property found)', textboxElement);
        return false;
    }

    getTextBoxElement(tabName, textboxName) {
        console.log(`[PresetManager] Looking for element: tab=${tabName}, textbox=${textboxName}`);
        
        const mapping = this.textBoxMappings[tabName]?.[textboxName];
        if (!mapping) {
            console.log(`[PresetManager] No mapping found for ${tabName}.${textboxName}`);
            console.log(`[PresetManager] Available mappings:`, this.textBoxMappings);
            return null;
        }

        console.log(`[PresetManager] Mapping found: ${mapping}`);

        // Try to find the element by ID
        let element = document.getElementById(mapping);
        if (element) {
            console.log(`[PresetManager] Found element by ID:`, element);
            return element;
        }

        // If not found by ID, try other common selectors
        const selectors = [
            `#${mapping}`,
            `[name="${mapping}"]`,
            `[data-field="${mapping}"]`,
            `[class="${mapping}"]`
        ];

        for (const selector of selectors) {
            element = document.querySelector(selector);
            if (element) {
                console.log(`[PresetManager] Found element by selector "${selector}":`, element);
                return element;
            }
        }

        console.log(`[PresetManager] Element not found with mapping: ${mapping}`);
        console.log(`[PresetManager] Available elements in document:`,
            Array.from(document.querySelectorAll('textarea, input')).map(el => el.id || el.name || 'unnamed'));
        
        return null;
    }
}