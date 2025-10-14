import { YamlDataManager } from './YamlDataManager.js';
import { YamlEditorView } from './YamlEditorView.js';
import { FormView } from './FormView.js';

/**
 * Manages the YAML editor interface with side-by-side views
 */
export class YamlEditorManager {
    /**
     * Constructor
     * @param {Object} options - Configuration options
     */
    constructor(options = {}) {
        this.editorContainerId = options.editorContainerId || 'yaml-editor-container';
        this.initialYaml = options.initialYaml || '';
        this.onDataChange = options.onDataChange || null;
        
        this.dataManager = null;
        this.editorView = null;
        this.formView = null;
        this.isActive = false;
        
        this.init();
    }

    /**
     * Initialize the YAML editor manager
     */
    init() {
        this.createDataManager();
        this.createViews();
        this.setupEventListeners();
    }

    /**
     * Create the data manager
     */
    createDataManager() {
        this.dataManager = new YamlDataManager();
        this.dataManager.initialize(this.initialYaml);
        
        // Set up observer for data changes
        this.dataManager.addObserver((data) => {
            if (this.onDataChange && typeof this.onDataChange === 'function') {
                this.onDataChange(data);
            }
        });
    }

    /**
     * Create the editor and form views
     */
    createViews() {
        const container = document.getElementById(this.editorContainerId);
        if (!container) {
            throw new Error(`Editor container with ID '${this.editorContainerId}' not found`);
        }
        
        // Create side-by-side layout
        container.innerHTML = '';
        container.className = 'yaml-editor-container';
        
        // Create editor view container
        const editorViewContainer = document.createElement('div');
        editorViewContainer.className = 'yaml-editor-view-container';
        editorViewContainer.id = 'yaml-editor-view';
        
        // Create form view container
        const formViewContainer = document.createElement('div');
        formViewContainer.className = 'yaml-form-view-container';
        formViewContainer.id = 'yaml-form-view';
        
        // Add containers to main container
        container.appendChild(editorViewContainer);
        container.appendChild(formViewContainer);
        
        // Create views
        this.editorView = new YamlEditorView('yaml-editor-view', this.dataManager);
        this.formView = new FormView('yaml-form-view', this.dataManager);
    }

    /**
     * Set up event listeners
     */
    setupEventListeners() {
        // Additional event listeners can be added here if needed
    }

    /**
     * Activate the YAML editor
     */
    activate() {
        this.isActive = true;
        const container = document.getElementById(this.editorContainerId);
        if (container) {
            container.style.display = 'flex';
        }
    }

    /**
     * Deactivate the YAML editor
     */
    deactivate() {
        this.isActive = false;
        const container = document.getElementById(this.editorContainerId);
        if (container) {
            container.style.display = 'none';
        }
    }

    /**
     * Get the current YAML data
     * @returns {Object} Current YAML data
     */
    getData() {
        return this.dataManager ? this.dataManager.getData() : {};
    }

    /**
     * Get the current YAML text
     * @returns {string} Current YAML text
     */
    getYamlText() {
        return this.dataManager ? this.dataManager.getYamlText() : '';
    }

    /**
     * Set the YAML data
     * @param {Object} data - Data to set
     */
    setData(data) {
        if (this.dataManager) {
            this.dataManager.setData(data, true);
        }
    }

    /**
     * Set the YAML text
     * @param {string} yamlText - YAML text to set
     */
    setYamlText(yamlText) {
        if (this.dataManager) {
            this.dataManager.setYamlText(yamlText, true);
        }
    }

    /**
     * Check if the current YAML is valid
     * @returns {boolean} Whether YAML is valid
     */
    isValidYaml() {
        return this.dataManager ? this.dataManager.isValidYaml() : false;
    }

    /**
     * Get the current error message
     * @returns {string|null} Error message or null if no error
     */
    getError() {
        return this.dataManager ? this.dataManager.getError() : null;
    }

    /**
     * Focus the editor view
     */
    focusEditor() {
        if (this.editorView) {
            this.editorView.focus();
        }
    }

    /**
     * Clean up resources
     */
    destroy() {
        if (this.dataManager) {
            this.dataManager.destroy();
            this.dataManager = null;
        }
        
        if (this.editorView) {
            this.editorView.destroy();
            this.editorView = null;
        }
        
        if (this.formView) {
            this.formView.destroy();
            this.formView = null;
        }
        
        this.isActive = false;
    }
}