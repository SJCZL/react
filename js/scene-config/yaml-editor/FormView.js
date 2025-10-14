/**
 * Structured form view for YAML data with atomic textareas
 */
export class FormView {
    /**
     * Constructor
     * @param {string} containerId - ID of the container element
     * @param {YamlDataManager} dataManager - YamlDataManager instance
     */
    constructor(containerId, dataManager) {
        this.container = document.getElementById(containerId);
        this.dataManager = dataManager;
        this.isUpdating = false;
        this.isButtonOperation = false; // Flag to track button operations
        this.fieldElements = new Map(); // Map of field paths to their elements
        
        if (!this.container) {
            throw new Error(`Container element with ID '${containerId}' not found`);
        }
        
        if (!this.dataManager) {
            throw new Error('YamlDataManager instance is required');
        }
        
        this.init();
    }

    /**
     * Initialize the view
     */
    init() {
        this.createForm();
        this.setupEventListeners();
        this.dataManager.addObserver(this.handleDataChange.bind(this));
    }

    /**
     * Create the form UI
     */
    createForm() {
        // Create header
        const header = document.createElement('div');
        header.className = 'form-view-header';
        header.textContent = '配置窗口';
        
        // Create form container
        this.formContainer = document.createElement('div');
        this.formContainer.className = 'form-view-container';
        
        // Create rows container for the new flat structure
        this.rowsContainer = document.createElement('div');
        this.rowsContainer.className = 'form-rows-container';
        this.formContainer.appendChild(this.rowsContainer);
        
        // Append elements to container
        this.container.appendChild(header);
        this.container.appendChild(this.formContainer);
    }

    /**
     * Set up event listeners
     */
    setupEventListeners() {
        // Event delegation for dynamic form elements
        this.formContainer.addEventListener('input', (e) => {
            if (e.target.classList.contains('form-field-input')) {
                this.handleFieldInput(e.target);
            }
        });
        
        this.formContainer.addEventListener('click', (e) => {
            console.log('[FormView] Click event detected');
            console.log('[FormView] Event target:', e.target);
            console.log('[FormView] Event target tagName:', e.target.tagName);
            console.log('[FormView] Event target className:', e.target.className);
            console.log('[FormView] Event target textContent:', e.target.textContent);
            console.log('[FormView] Event target parentElement:', e.target.parentElement);
            
            // Check if the clicked element is a toggle slider
            if (e.target.classList.contains('toggle-slider')) {
                console.log('[FormView] Toggle slider clicked');
                // Find the associated checkbox input
                const checkbox = e.target.previousElementSibling;
                if (checkbox && checkbox.type === 'checkbox') {
                    console.log('[FormView] Toggling checkbox');
                    checkbox.checked = !checkbox.checked;
                    // Trigger the input event to update the data
                    checkbox.dispatchEvent(new Event('input', { bubbles: true }));
                }
                return;
            }
            
            // Check if the clicked element or its parent has the button class
            let target = e.target;
            
            // If the click is on the × text inside the button, get the parent button
            if (target.textContent === '×' && target.parentElement && target.parentElement.classList.contains('remove-array-item-btn')) {
                console.log('[FormView] Click detected on × text, using parent button');
                target = target.parentElement;
            }
            
            console.log('[FormView] Final target for processing:', target);
            console.log('[FormView] Final target className:', target.className);
            
            if (target.classList.contains('add-array-item-btn')) {
                console.log('[FormView] Handling add-array-item-btn click');
                this.handleAddArrayItem(target);
            } else if (target.classList.contains('remove-array-item-btn')) {
                // Check if this is actually an object property remove button
                if (target.dataset.key !== undefined) {
                    console.log('[FormView] Detected object property remove button by data-key');
                    this.handleRemoveObjectProperty(target);
                } else if (target.dataset.index !== undefined) {
                    console.log('[FormView] Detected array item remove button by data-index');
                    this.handleRemoveArrayItem(target);
                } else {
                    console.log('[FormView] Remove button has neither data-key nor data-index');
                }
            } else if (target.classList.contains('add-object-property-btn')) {
                console.log('[FormView] Handling add-object-property-btn click');
                this.handleAddObjectProperty(target);
            } else if (target.classList.contains('remove-object-property-btn')) {
                console.log('[FormView] Handling remove-object-property-btn click');
                this.handleRemoveObjectProperty(target);
            } else if (target.classList.contains('form-row-key')) {
                console.log('[FormView] Handling field label click');
                this.handleFieldLabelClick(target);
            } else {
                console.log('[FormView] No button class detected on target');
            }
        });
    }

    /**
     * Handle field input changes
     * @param {HTMLElement} inputElement - The input element that changed
     */
    handleFieldInput(inputElement) {
        console.log('[FormView] handleFieldInput called, isUpdating:', this.isUpdating);
        console.log('[FormView] Input element:', inputElement);
        console.log('[FormView] Input element dataset:', inputElement.dataset);
        
        if (this.isUpdating) return;
        
        const path = inputElement.dataset.path;
        const value = this.parseInputValue(inputElement);
        
        console.log('[FormView] Updating path:', path, 'with value:', value, 'source: form');
        if (path) {
            // Update the data with source tracking
            this.dataManager.updateDataPath(path, value, true, 'form'); // Immediate update with source
        }
    }

    /**
     * Parse input value based on its type
     * @param {HTMLElement} inputElement - The input element
     * @returns {*} Parsed value
     */
    parseInputValue(inputElement) {
        const type = inputElement.dataset.type;
        const value = inputElement.value;
        
        switch (type) {
            case 'number':
                return parseFloat(value) || 0;
            case 'boolean':
                return inputElement.checked;
            case 'null':
                return value.trim().toLowerCase() === 'null' ? null : value;
            default:
                return value;
        }
    }

    /**
     * Handle adding an array item
     * @param {HTMLElement} button - The add button
     */
    handleAddArrayItem(button) {
        console.log('[FormView] handleAddArrayItem called');
        console.log('[FormView] Button element:', button);
        console.log('[FormView] Button dataset:', button.dataset);
        
        const path = button.dataset.path;
        console.log('[FormView] Path:', path);
        console.log('[FormView] Is path valid:', !!path);
        
        if (path) {
            console.log('[FormView] Calling dataManager.addArrayItem');
            // Set flag to indicate this is a button operation
            this.isButtonOperation = true;
            this.dataManager.addArrayItem(path, '', true, 'form');
        } else {
            console.log('[FormView] Cannot add array item - invalid path');
        }
    }

    /**
     * Handle removing an array item
     * @param {HTMLElement} button - The remove button
     */
    handleRemoveArrayItem(button) {
        console.log('[FormView] handleRemoveArrayItem called');
        console.log('[FormView] Button element:', button);
        console.log('[FormView] Button dataset:', button.dataset);
        
        const path = button.dataset.path;
        const index = parseInt(button.dataset.index, 10);
        
        console.log('[FormView] Path:', path);
        console.log('[FormView] Index:', index);
        console.log('[FormView] Is path valid:', !!path);
        console.log('[FormView] Is index valid:', !isNaN(index));
        
        if (path && !isNaN(index)) {
            console.log('[FormView] Calling dataManager.removeArrayItem');
            // Set flag to indicate this is a button operation
            this.isButtonOperation = true;
            this.dataManager.removeArrayItem(path, index, true, 'form');
        } else {
            console.log('[FormView] Cannot remove array item - invalid path or index');
        }
    }

    /**
     * Handle adding an object property
     * @param {HTMLElement} button - The add button
     */
    handleAddObjectProperty(button) {
        console.log('[FormView] handleAddObjectProperty called');
        console.log('[FormView] Button element:', button);
        console.log('[FormView] Button dataset:', button.dataset);
        
        let path = button.dataset.path;
        console.log('[FormView] Original path:', path);
        
        // If the path is an array item (e.g., '浏览记录[1]'), we need to use the parent array path
        // to ensure the property is added to all items in the array
        if (path && path.includes('[') && path.includes(']')) {
            console.log('[FormView] Detected array item path, extracting parent array path');
            path = path.substring(0, path.lastIndexOf('['));
            console.log('[FormView] Modified path to parent array:', path);
        }
        
        console.log('[FormView] Final path:', path);
        console.log('[FormView] Is path valid:', !!path);
        
        if (path) {
            console.log('[FormView] Prompting for property name');
            // For simplicity, add a string property with empty value
            const key = prompt('Enter property name:');
            console.log('[FormView] Property name entered:', key);
            
            if (key) {
                console.log('[FormView] Calling dataManager.addObjectProperty with path:', path, 'key:', key);
                // Set flag to indicate this is a button operation
                this.isButtonOperation = true;
                this.dataManager.addObjectProperty(path, key, '', true, 'form');
            } else {
                console.log('[FormView] No property name entered, cancelling');
            }
        } else {
            console.log('[FormView] Cannot add object property - invalid path');
        }
    }

    /**
     * Handle removing an object property
     * @param {HTMLElement} button - The remove button
     */
    handleRemoveObjectProperty(button) {
        console.log('[FormView] handleRemoveObjectProperty called');
        console.log('[FormView] Button element:', button);
        console.log('[FormView] Button dataset:', button.dataset);
        
        let path = button.dataset.path;
        const key = button.dataset.key;
        
        console.log('[FormView] Original path:', path);
        console.log('[FormView] Key:', key);
        
        // If the path is an array item (e.g., '浏览记录[1]'), we need to use the parent array path
        // to ensure the property is removed from all items in the array
        if (path && path.includes('[') && path.includes(']')) {
            console.log('[FormView] Detected array item path, extracting parent array path');
            path = path.substring(0, path.lastIndexOf('['));
            console.log('[FormView] Modified path to parent array:', path);
        }
        
        console.log('[FormView] Final path:', path);
        console.log('[FormView] Is path valid:', !!path);
        console.log('[FormView] Is key valid:', !!key);
        
        if (path && key) {
            console.log('[FormView] Calling dataManager.removeObjectProperty with path:', path, 'key:', key);
            // Set flag to indicate this is a button operation
            this.isButtonOperation = true;
            this.dataManager.removeObjectProperty(path, key, true, 'form');
        } else {
            console.log('[FormView] Cannot remove object property - invalid path or key');
        }
    }

    /**
     * Handle field label click to copy the template placeholder
     * @param {HTMLElement} labelElement - The clicked label element
     */
    handleFieldLabelClick(labelElement) {
        console.log('[FormView] handleFieldLabelClick called');
        const path = labelElement.dataset.path;
        if (path) {
            // Use the path as-is without adding any prefix
            const templatePlaceholder = `{{${path}}}`;
            console.log('[FormView] Copying template placeholder:', templatePlaceholder);
            
            // Copy to clipboard
            navigator.clipboard.writeText(templatePlaceholder).then(() => {
                console.log('[FormView] Template placeholder copied to clipboard');
                // Show visual feedback
                const originalText = labelElement.textContent;
                labelElement.textContent = '✓ 已复制';
                setTimeout(() => {
                    labelElement.textContent = originalText;
                }, 1000);
            }).catch(err => {
                console.error('[FormView] Failed to copy template placeholder:', err);
            });
        }
    }

    /**
     * Handle data changes from the data manager
     * @param {Object} data - Change data
     */
    handleDataChange(data) {
        console.log('[FormView] handleDataChange called, isUpdating:', this.isUpdating, 'source:', data.source);
        if (this.isUpdating) return;
        
        // Don't update if this view was the source of the change and it's a text input
        // But always update for button clicks (add/remove operations)
        if (data.source === 'form' && !this.isButtonOperation) {
            console.log('[FormView] Skipping update because source is "form" and not a button operation');
            return;
        }
        
        console.log('[FormView] Processing update from source:', data.source);
        this.isUpdating = true;
        
        try {
            this.updateForm(data.data);
        } finally {
            this.isUpdating = false;
            // Reset the button operation flag
            this.isButtonOperation = false;
        }
    }

    /**
     * Render the form based on data (initial render)
     * @param {Object} data - Data to render
     */
    renderForm(data) {
        // Clear existing form
        this.rowsContainer.innerHTML = '';
        this.fieldElements.clear();
        
        if (!data || typeof data !== 'object') {
            this.rowsContainer.innerHTML = '<div class="form-empty">No data to display</div>';
            return;
        }
        
        // Render the data as a flat list of rows
        this.renderDataAsRows(data, '', this.rowsContainer, 0);
    }
    
    /**
     * Update the form based on data (incremental update)
     * @param {Object} data - Data to update
     */
    updateForm(data) {
        console.log('[FormView] updateForm called');
        if (!data || typeof data !== 'object') {
            console.log('[FormView] Data is invalid, doing full render');
            this.renderForm(data);
            return;
        }
        
        // Check if we need to do a full re-render
        if (this.fieldElements.size === 0) {
            console.log('[FormView] No field elements, doing full render');
            this.renderForm(data);
            return;
        }
        
        // Check if the structure has changed by comparing paths
        const currentPaths = this.getCurrentPaths();
        const newPaths = this.extractPaths(data);
        
        console.log('[FormView] Current paths:', currentPaths);
        console.log('[FormView] New paths:', newPaths);
        
        // If paths have changed, do a full re-render
        if (!this.arraysEqual(currentPaths, newPaths)) {
            console.log('[FormView] Paths changed, doing full render');
            this.renderForm(data);
            return;
        }
        
        console.log('[FormView] Paths unchanged, doing incremental update');
        // Update existing fields instead of rebuilding the entire form
        this.updateFields(data);
    }
    
    /**
     * Get all current field paths
     * @returns {Array} Array of field paths
     */
    getCurrentPaths() {
        return Array.from(this.fieldElements.keys()).sort();
    }
    
    /**
     * Extract all paths from data object
     * @param {Object} data - Data object
     * @returns {Array} Array of field paths
     */
    extractPaths(data, prefix = '') {
        const paths = [];
        
        for (const [key, value] of Object.entries(data)) {
            const path = prefix ? `${prefix}.${key}` : key;
            
            if (value === null) {
                paths.push(path);
            } else if (typeof value === 'object' && !Array.isArray(value)) {
                paths.push(path);
                paths.push(...this.extractPaths(value, path));
            } else if (Array.isArray(value)) {
                paths.push(path);
                value.forEach((item, index) => {
                    const itemPath = `${path}[${index}]`;
                    if (item === null) {
                        paths.push(itemPath);
                    } else if (typeof item === 'object' && !Array.isArray(item)) {
                        paths.push(itemPath);
                        paths.push(...this.extractPaths(item, itemPath));
                    } else {
                        paths.push(itemPath);
                    }
                });
            } else {
                paths.push(path);
            }
        }
        
        return paths.sort();
    }
    
    /**
     * Check if two arrays are equal
     * @param {Array} arr1 - First array
     * @param {Array} arr2 - Second array
     * @returns {boolean} Whether arrays are equal
     */
    arraysEqual(arr1, arr2) {
        if (arr1.length !== arr2.length) return false;
        
        for (let i = 0; i < arr1.length; i++) {
            if (arr1[i] !== arr2[i]) return false;
        }
        
        return true;
    }
    
    /**
     * Update existing fields with new data
     * @param {Object} data - Data to update
     */
    updateFields(data) {
        console.log('[FormView] updateFields called');
        
        // Store the currently focused element
        const activeElement = document.activeElement;
        const activePath = activeElement && activeElement.dataset.path;
        let activeValue = null;
        let activeSelectionStart = null;
        let activeSelectionEnd = null;
        
        console.log('[FormView] Active element:', activeElement, 'active path:', activePath);
        
        // If there's an active element, save its state
        if (activeElement && activePath) {
            activeValue = activeElement.value;
            if (activeElement.tagName === 'TEXTAREA' || activeElement.tagName === 'INPUT') {
                activeSelectionStart = activeElement.selectionStart;
                activeSelectionEnd = activeElement.selectionEnd;
            }
            console.log('[FormView] Saved active element state:', { activeValue, activeSelectionStart, activeSelectionEnd });
        }
        
        // Update each field that exists in our fieldElements map
        for (const [path, element] of this.fieldElements) {
            const value = this.getNestedValue(data, path);
            
            console.log(`[FormView] Checking field ${path}, current value:`, element.value, 'new value:', value);
            console.log(`[FormView] Element type:`, element.type, 'dataset type:', element.dataset.type);
            
            if (value !== undefined) {
                // Don't update the currently active element - it's already up to date
                if (path === activePath) {
                    console.log(`[FormView] Skipping active field ${path}`);
                    continue;
                }
                
                // Check if the value has actually changed
                let currentValue;
                if (element.type === 'checkbox') {
                    currentValue = element.checked;
                } else {
                    currentValue = element.value;
                }
                
                // Convert values to the same type for comparison
                const elementType = element.dataset.type;
                let normalizedCurrentValue = currentValue;
                let normalizedNewValue = value;
                
                console.log(`[FormView] Before normalization - current:`, normalizedCurrentValue, 'new:', normalizedNewValue);
                
                if (elementType === 'number') {
                    normalizedCurrentValue = parseFloat(currentValue) || 0;
                    normalizedNewValue = parseFloat(value) || 0;
                } else if (elementType === 'boolean') {
                    normalizedCurrentValue = currentValue === true || currentValue === 'true';
                    normalizedNewValue = value === true || value === 'true';
                } else if (elementType === 'null') {
                    normalizedCurrentValue = currentValue.trim().toLowerCase() === 'null' ? null : currentValue;
                    normalizedNewValue = value;
                } else {
                    // For string fields, convert both to strings for comparison
                    normalizedCurrentValue = String(currentValue);
                    normalizedNewValue = String(value);
                }
                
                console.log(`[FormView] After normalization - current:`, normalizedCurrentValue, 'new:', normalizedNewValue);
                console.log(`[FormView] Values are different:`, normalizedCurrentValue !== normalizedNewValue);
                
                // Only update if the values are different
                if (normalizedCurrentValue !== normalizedNewValue) {
                    // Update the element's value without rebuilding
                    if (element.type === 'checkbox') {
                        element.checked = value;
                        console.log(`[FormView] Updated checkbox ${path} to`, value);
                    } else {
                        // Check if the field type has changed
                        const newType = this.getValueType(value);
                        const currentType = element.dataset.type;
                        
                        console.log(`[FormView] Field ${path} type change:`, currentType, '->', newType);
                        
                        if (newType !== currentType) {
                            console.log(`[FormView] Field ${path} type changed, recreating element`);
                            // Type changed, need to recreate the element
                            const parent = element.parentNode;
                            // For boolean fields, we need to replace the entire wrapper
                            if (newType === 'boolean' || currentType === 'boolean') {
                                const grandParent = parent.parentNode;
                                const newElement = this.createFieldElement(path, value);
                                grandParent.replaceChild(newElement, parent);
                                // Update the fieldElements map with the new checkbox input
                                if (newType === 'boolean') {
                                    this.fieldElements.set(path, newElement.querySelector('input[type="checkbox"]'));
                                }
                            } else {
                                const newElement = this.createFieldElement(path, value);
                                parent.replaceChild(newElement, element);
                            }
                        } else if (!element.disabled) { // Don't update disabled elements (like null fields)
                            console.log(`[FormView] About to update field ${path} from`, element.value, 'to', value);
                            element.value = value;
                            console.log(`[FormView] Updated field ${path} to`, value);
                            console.log(`[FormView] Field ${path} value after update:`, element.value);
                        } else {
                            console.log(`[FormView] Field ${path} is disabled, skipping update`);
                        }
                    }
                } else {
                    console.log(`[FormView] Field ${path} unchanged, skipping update`);
                }
            }
        }
        
        // Restore focus and selection to the active element
        if (activeElement && activePath) {
            setTimeout(() => {
                if (activeElement && activeElement.parentNode) {
                    activeElement.focus();
                    
                    // Restore cursor position for textareas and inputs
                    if (activeSelectionStart !== null && activeSelectionEnd !== null) {
                        try {
                            activeElement.setSelectionRange(activeSelectionStart, activeSelectionEnd);
                        } catch (e) {
                            // Ignore errors when restoring selection
                        }
                    }
                }
            }, 0);
        }
    }
    
    /**
     * Get a nested value from an object using dot notation path
     * @param {Object} obj - The object to get value from
     * @param {string} path - Dot notation path (e.g., 'customer.name')
     * @returns {*} The value at the path
     */
    getNestedValue(obj, path) {
        if (!path) return obj;
        
        return this._getNestedValueRecursive(obj, path);
    }

    /**
     * Recursively get a nested value from an object using complex paths
     * @private
     * @param {Object} currentObj - Current object to search in
     * @param {string} remainingPath - Remaining path to process
     * @returns {*} The value at the path
     */
    _getNestedValueRecursive(currentObj, remainingPath) {
        // Check if this path segment contains array notation
        const arrayMatch = remainingPath.match(/^(.*?)\[(\d+)\](.*)$/);
        if (arrayMatch) {
            const [, pathBeforeArray, arrayIndex, pathAfterArray] = arrayMatch;
            const index = parseInt(arrayIndex, 10);
            
            // Navigate to the array
            let target = currentObj;
            if (pathBeforeArray) {
                const pathParts = pathBeforeArray.split('.');
                for (const part of pathParts) {
                    if (target && typeof target === 'object' && part in target) {
                        target = target[part];
                    } else {
                        return undefined;
                    }
                }
            }
            
            // Check if target is an array and index is valid
            if (!Array.isArray(target) || index < 0 || index >= target.length) {
                return undefined;
            }
            
            // Get the array element
            const arrayElement = target[index];
            
            // If there's more path to process, continue recursively
            if (pathAfterArray) {
                // Remove leading dot if present
                const remaining = pathAfterArray.startsWith('.') ? pathAfterArray.substring(1) : pathAfterArray;
                if (remaining) {
                    return this._getNestedValueRecursive(arrayElement, remaining);
                }
            }
            
            // Return the array element itself
            return arrayElement;
        } else {
            // No array notation, handle as regular dot notation path
            const pathParts = remainingPath.split('.');
            let target = currentObj;
            
            for (const part of pathParts) {
                if (target && typeof target === 'object' && part in target) {
                    target = target[part];
                } else {
                    return undefined;
                }
            }
            
            return target;
        }
    }

    /**
     * Render data as a flat list of rows
     * @param {Object} data - Data to render
     * @param {string} path - Current path
     * @param {HTMLElement} container - Container element
     * @param {number} level - Nesting level
     */
    renderDataAsRows(data, path, container, level) {
        // Check if container is valid
        if (!container) {
            console.error('Container is undefined in renderDataAsRows');
            return;
        }
        
        // Render each property as a row
        for (const [key, value] of Object.entries(data)) {
            const propertyPath = path ? `${path}.${key}` : key;
            
            // Create a row for this property
            const row = this.createRow(propertyPath, key, value, level);
            container.appendChild(row);
            
            // If the value is an object or array, render its children as rows
            if (value !== null && typeof value === 'object') {
                if (Array.isArray(value)) {
                    // Render array items as rows
                    value.forEach((item, index) => {
                        const itemPath = `${propertyPath}[${index}]`;
                        const itemRow = this.createRow(itemPath, `${index}:`, item, level + 1);
                        container.appendChild(itemRow);
                        
                        // If array item is an object, render its properties
                        if (item !== null && typeof item === 'object' && !Array.isArray(item)) {
                            this.renderDataAsRows(item, itemPath, container, level + 2);
                        }
                    });
                } else {
                    // Render object properties as rows
                    this.renderDataAsRows(value, propertyPath, container, level + 1);
                }
            }
        }
    }
    
    /**
     * Create a single row for a property
     * @param {string} path - Field path
     * @param {string} key - Field key
     * @param {*} value - Field value
     * @param {number} level - Nesting level
     * @returns {HTMLElement} The created row element
     */
    createRow(path, key, value, level) {
        const row = document.createElement('div');
        row.className = 'form-row';
        
        // Apply dynamic indentation based on nesting level
        const basePadding = 8; // Base padding in pixels
        const indentPerLevel = 16; // Additional indentation per level
        const totalPadding = basePadding + (level * indentPerLevel);
        row.style.paddingLeft = `${totalPadding}px`;
        
        // Check if this row has children (for visual indicators)
        const hasChildren = value !== null && typeof value === 'object' &&
                           (Object.keys(value).length > 0 || (Array.isArray(value) && value.length > 0));
        if (hasChildren) {
            row.classList.add('has-children');
        }
        
        // Create key label
        const keyLabel = document.createElement('div');
        keyLabel.className = 'form-row-key';
        keyLabel.textContent = key;
        keyLabel.dataset.path = path; // Store the path for copying
        keyLabel.title = `点击复制 {{${path}}}`; // Add tooltip
        row.appendChild(keyLabel);
        
        // Create value container
        const valueContainer = document.createElement('div');
        valueContainer.className = 'form-row-value';
        row.appendChild(valueContainer);
        
        // Render value based on its type
        try {
            if (value === null) {
                this.renderNull(path, null, valueContainer);
            } else if (typeof value === 'boolean') {
                this.renderBoolean(path, value, valueContainer);
            } else if (typeof value === 'number') {
                this.renderNumber(path, value, valueContainer);
            } else if (typeof value === 'string') {
                this.renderString(path, value, valueContainer);
            } else if (Array.isArray(value) || typeof value === 'object') {
                // For objects and arrays, add an "Add" button
                const addButton = document.createElement('button');
                if (Array.isArray(value)) {
                    addButton.className = 'add-array-item-btn';
                    addButton.textContent = '+';
                    addButton.title = 'Add item';
                } else {
                    addButton.className = 'add-object-property-btn';
                    addButton.textContent = '+';
                    addButton.title = 'Add property';
                }
                addButton.dataset.path = path;
                valueContainer.appendChild(addButton);
            }
        } catch (e) {
            console.error('Error rendering value:', e, 'path:', path, 'value:', value);
        }
        
        // Add remove button for properties (except at root level)
        if (level > 0) {
            console.log('[FormView] Creating remove button for path:', path, 'level:', level);
            
            const removeBtn = document.createElement('button');
            removeBtn.className = 'remove-array-item-btn'; // Using same class for consistency
            removeBtn.textContent = '×';
            removeBtn.title = 'Remove';
            
            console.log('[FormView] Remove button created:', removeBtn);
            console.log('[FormView] Remove button className:', removeBtn.className);
            
            // Set dataset for removal
            if (path.includes('[') && path.includes(']')) {
                // This is an array item
                const arrayPath = path.substring(0, path.lastIndexOf('['));
                const index = parseInt(path.substring(path.lastIndexOf('[') + 1, path.lastIndexOf(']')));
                removeBtn.dataset.path = arrayPath;
                removeBtn.dataset.index = index;
                console.log('[FormView] Array item - path:', arrayPath, 'index:', index);
            } else {
                // This is an object property
                const parentPath = path.substring(0, path.lastIndexOf('.'));
                const key = path.substring(path.lastIndexOf('.') + 1);
                removeBtn.dataset.path = parentPath;
                removeBtn.dataset.key = key;
                console.log('[FormView] Object property - path:', parentPath, 'key:', key);
            }
            
            console.log('[FormView] Remove button dataset:', removeBtn.dataset);
            row.appendChild(removeBtn);
            console.log('[FormView] Remove button added to row');
        } else {
            console.log('[FormView] Not creating remove button for root level (level 0)');
        }
        
        return row;
    }


    /**
     * Render a string value
     * @param {string} path - Field path
     * @param {string} value - String value
     * @param {HTMLElement} container - Container element
     */
    renderString(path, value, container) {
        if (!container) {
            console.error('Container is undefined in renderString');
            return;
        }
        
        const input = document.createElement('textarea');
        input.className = 'form-field-input';
        input.dataset.path = path;
        input.dataset.type = 'string';
        input.value = value;
        input.rows = 1;
        
        // Auto-adjust height on input
        const adjustHeight = () => {
            input.style.height = 'auto';
            input.style.height = Math.max(40, input.scrollHeight) + 'px';
        };
        
        input.addEventListener('input', adjustHeight);
        
        // Initial height adjustment
        adjustHeight();
        
        container.appendChild(input);
        this.fieldElements.set(path, input);
    }

    /**
     * Render a number value
     * @param {string} path - Field path
     * @param {number} value - Number value
     * @param {HTMLElement} container - Container element
     */
    renderNumber(path, value, container) {
        if (!container) {
            console.error('Container is undefined in renderNumber');
            return;
        }
        
        const input = document.createElement('input');
        input.className = 'form-field-input';
        input.type = 'number';
        input.dataset.path = path;
        input.dataset.type = 'number';
        input.value = value;
        container.appendChild(input);
        this.fieldElements.set(path, input);
    }

    /**
     * Render a boolean value
     * @param {string} path - Field path
     * @param {boolean} value - Boolean value
     * @param {HTMLElement} container - Container element
     */
    renderBoolean(path, value, container) {
        if (!container) {
            console.error('Container is undefined in renderBoolean');
            return;
        }
        
        // Create a wrapper div to ensure the checkbox and slider are adjacent siblings
        const toggleWrapper = document.createElement('div');
        toggleWrapper.className = 'boolean-toggle-wrapper';
        toggleWrapper.style.display = 'flex';
        toggleWrapper.style.alignItems = 'center';
        
        const input = document.createElement('input');
        input.className = 'form-field-input';
        input.type = 'checkbox';
        input.dataset.path = path;
        input.dataset.type = 'boolean';
        input.checked = value;
        toggleWrapper.appendChild(input);
        
        // Add the toggle slider element as an immediate sibling of the checkbox
        const slider = document.createElement('span');
        slider.className = 'toggle-slider';
        toggleWrapper.appendChild(slider);
        
        container.appendChild(toggleWrapper);
        
        this.fieldElements.set(path, input);
    }

    /**
     * Render a null value
     * @param {string} path - Field path
     * @param {null} value - Null value
     * @param {HTMLElement} container - Container element
     */
    renderNull(path, value, container) {
        if (!container) {
            console.error('Container is undefined in renderNull');
            return;
        }
        
        const input = document.createElement('input');
        input.className = 'form-field-input';
        input.dataset.path = path;
        input.dataset.type = 'null';
        input.value = 'null';
        input.disabled = true;
        container.appendChild(input);
        this.fieldElements.set(path, input);
    }

    /**
     * Get the type of a value for form field creation
     * @param {*} value - The value to check
     * @returns {string} The type of the value ('string', 'number', 'boolean', 'null')
     */
    getValueType(value) {
        if (value === null) {
            return 'null';
        } else if (typeof value === 'boolean') {
            return 'boolean';
        } else if (typeof value === 'number') {
            return 'number';
        } else {
            return 'string';
        }
    }
    
    /**
     * Create a field element based on value type
     * @param {string} path - Field path
     * @param {*} value - Field value
     * @returns {HTMLElement} The created field element
     */
    createFieldElement(path, value) {
        const type = this.getValueType(value);
        const container = document.createElement('div');
        
        switch (type) {
            case 'string':
                this.renderString(path, value, container);
                break;
            case 'number':
                this.renderNumber(path, value, container);
                break;
            case 'boolean':
                this.renderBoolean(path, value, container);
                break;
            case 'null':
                this.renderNull(path, value, container);
                break;
        }
        
        // For boolean fields, return the wrapper div instead of just the first child
        if (type === 'boolean') {
            return container.firstChild;
        }
        
        return container.firstChild;
    }

    /**
     * Clean up resources
     */
    destroy() {
        if (this.dataManager) {
            this.dataManager.removeObserver(this.handleDataChange);
        }
        this.fieldElements.clear();
    }
}