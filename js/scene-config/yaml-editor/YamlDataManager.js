import { load, dump } from '../../../js/utils/js-yaml.mjs';

/**
 * Manages YAML data parsing, validation, and state synchronization
 */
export class YamlDataManager {
    constructor() {
        this.data = {};
        this.yamlText = '';
        this.isValid = false;
        this.error = null;
        this.observers = [];
        this.debounceTimer = null;
        this.debounceDelay = 0; // ms - changed to 0 for immediate updates
        this.updateSource = null; // Track which view initiated the update
    }

    /**
     * Initialize with default YAML data
     * @param {string} initialYaml - Initial YAML text
     */
    initialize(initialYaml = '') {
        this.setYamlText(initialYaml);
    }

    /**
     * Set YAML text and parse it
     * @param {string} yamlText - YAML text to parse
     * @param {boolean} immediate - Whether to parse immediately or debounce
     */
    setYamlText(yamlText, immediate = false) {
        this.yamlText = yamlText;
        
        if (immediate) {
            this._parseYaml();
        } else {
            this._debounceParse();
        }
    }

    /**
     * Set data object and generate YAML text
     * @param {Object} data - Data object to convert to YAML
     * @param {boolean} immediate - Whether to update immediately or debounce
     */
    setData(data, immediate = false) {
        this.data = data;
        
        if (immediate) {
            this._generateYaml();
        } else {
            this._debounceGenerate();
        }
    }

    /**
     * Get current data object
     * @returns {Object} Current data
     */
    getData() {
        return this.data;
    }

    /**
     * Get current YAML text
     * @returns {string} Current YAML text
     */
    getYamlText() {
        return this.yamlText;
    }

    /**
     * Check if current YAML is valid
     * @returns {boolean} Whether YAML is valid
     */
    isValidYaml() {
        return this.isValid;
    }

    /**
     * Get current error message
     * @returns {string|null} Error message or null if no error
     */
    getError() {
        return this.error;
    }

    /**
     * Add observer to be notified of changes
     * @param {Function} observer - Observer function
     */
    addObserver(observer) {
        if (typeof observer === 'function' && !this.observers.includes(observer)) {
            this.observers.push(observer);
        }
    }

    /**
     * Remove observer
     * @param {Function} observer - Observer function to remove
     */
    removeObserver(observer) {
        const index = this.observers.indexOf(observer);
        if (index !== -1) {
            this.observers.splice(index, 1);
        }
    }

    /**
     * Notify all observers of changes
     * @private
     */
    _notifyObservers() {
        console.log('[YamlDataManager] _notifyObservers called with source:', this.updateSource);
        console.log('[YamlDataManager] Notifying', this.observers.length, 'observers');
        
        this.observers.forEach((observer, index) => {
            try {
                console.log(`[YamlDataManager] Notifying observer ${index}`);
                observer({
                    data: this.data,
                    yamlText: this.yamlText,
                    isValid: this.isValid,
                    error: this.error,
                    source: this.updateSource
                });
            } catch (e) {
                console.error('Error in YAML data observer:', e);
            }
        });
        
        // Reset the source after notifying
        console.log('[YamlDataManager] Resetting source from', this.updateSource, 'to null');
        this.updateSource = null;
    }

    /**
     * Parse YAML text with error handling
     * @private
     */
    _parseYaml() {
        console.log('[YamlDataManager] _parseYaml called with source:', this.updateSource);
        console.log('[YamlDataManager] YAML text length:', this.yamlText.length);
        
        // Store the previous valid data in case parsing fails
        const previousData = this.isValid ? {...this.data} : {};
        const previousIsValid = this.isValid;
        
        try {
            if (!this.yamlText.trim()) {
                console.log('[YamlDataManager] Empty YAML, setting empty data');
                this.data = {};
                this.isValid = true;
                this.error = null;
            } else {
                console.log('[YamlDataManager] Parsing YAML...');
                this.data = load(this.yamlText);
                this.isValid = true;
                this.error = null;
                console.log('[YamlDataManager] YAML parsed successfully');
            }
        } catch (e) {
            console.error('YAML parsing error:', e);
            
            // If YAML is invalid, keep the previous valid data
            if (!previousIsValid) {
                // If there was no previous valid data, set to empty object
                this.data = {};
            } else {
                // Restore the previous valid data
                this.data = previousData;
            }
            
            this.isValid = false;
            this.error = e.message;
            
            console.log('[YamlDataManager] YAML is invalid, preserving previous valid data');
        }
        
        this._notifyObservers();
    }

    /**
     * Generate YAML text from data object
     * @private
     */
    _generateYaml() {
        console.log('[YamlDataManager] _generateYaml called with source:', this.updateSource);
        
        // Save the current source before generating YAML
        const currentSource = this.updateSource;
        
        try {
            console.log('[YamlDataManager] Generating YAML from data...');
            this.yamlText = dump(this.data, {
                indent: 2,
                lineWidth: -1, // Don't wrap lines
                noRefs: true // Don't use references
            });
            this.isValid = true;
            this.error = null;
            console.log('[YamlDataManager] YAML generated successfully, length:', this.yamlText.length);
        } catch (e) {
            this.isValid = false;
            this.error = e.message;
            console.error('YAML generation error:', e);
        }
        
        // Restore the source before notifying observers
        this.updateSource = currentSource;
        this._notifyObservers();
    }

    /**
     * Debounce YAML parsing to avoid excessive parsing during rapid input
     * @private
     */
    _debounceParse() {
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }
        
        this.debounceTimer = setTimeout(() => {
            this._parseYaml();
            this.debounceTimer = null;
        }, this.debounceDelay);
    }

    /**
     * Debounce YAML generation to avoid excessive updates
     * @private
     */
    _debounceGenerate() {
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }
        
        this.debounceTimer = setTimeout(() => {
            this._generateYaml();
            this.debounceTimer = null;
        }, this.debounceDelay);
    }

    /**
     * Update a specific path in the data object
     * @param {string} path - Dot notation path to update (e.g., 'customer.name' or 'items[0]')
     * @param {*} value - New value
     * @param {boolean} immediate - Whether to update immediately or debounce
     * @param {string} source - Source of the update ('form' or 'yaml')
     */
    updateDataPath(path, value, immediate = false, source = null) {
        console.log('[YamlDataManager] updateDataPath called with path:', path, 'value:', value, 'source:', source);
        
        // Use a recursive approach to handle arbitrary nesting
        this._updatePathRecursive(this.data, path, value, immediate, source);
    }

    /**
     * Recursively update a path in the data object
     * @private
     * @param {Object} currentObj - Current object to update
     * @param {string} remainingPath - Remaining path to process
     * @param {*} value - Value to set
     * @param {boolean} immediate - Whether to update immediately
     * @param {string} source - Source of the update
     */
    _updatePathRecursive(currentObj, remainingPath, value, immediate, source) {
        console.log('[YamlDataManager] _updatePathRecursive called with remainingPath:', remainingPath);
        
        // Check if this path segment contains array notation
        const arrayMatch = remainingPath.match(/^(.*?)\[(\d+)\](.*)$/);
        if (arrayMatch) {
            const [, pathBeforeArray, arrayIndex, pathAfterArray] = arrayMatch;
            const index = parseInt(arrayIndex, 10);
            
            console.log('[YamlDataManager] Array detected - pathBefore:', pathBeforeArray, 'index:', index, 'pathAfter:', pathAfterArray);
            
            // Navigate to or create the array
            if (pathBeforeArray) {
                // Navigate to the array
                const pathParts = pathBeforeArray.split('.');
                let target = currentObj;
                
                for (const part of pathParts) {
                    if (!(part in target) || typeof target[part] !== 'object') {
                        target[part] = {};
                    }
                    target = target[part];
                }
                
                // Ensure target is an array
                if (!Array.isArray(target)) {
                    console.log('[YamlDataManager] Converting to array at path:', pathBeforeArray);
                    const newArray = [];
                    
                    // Preserve existing properties if it was an object
                    if (typeof target === 'object' && target !== null) {
                        const maxIndex = Math.max(...Object.keys(target)
                            .filter(key => /^\d+$/.test(key))
                            .map(key => parseInt(key, 10)), -1);
                        
                        for (let i = 0; i <= maxIndex; i++) {
                            if (i in target) {
                                newArray[i] = target[i];
                            }
                        }
                    }
                    
                    // Replace with array
                    const parentPath = pathParts.slice(0, -1).join('.');
                    const lastPart = pathParts[pathParts.length - 1];
                    
                    if (parentPath) {
                        let parent = currentObj;
                        for (const part of parentPath.split('.')) {
                            parent = parent[part];
                        }
                        parent[lastPart] = newArray;
                        target = newArray;
                    } else {
                        currentObj[lastPart] = newArray;
                        target = newArray;
                    }
                }
                
                // Ensure array is large enough
                if (index >= target.length) {
                    for (let i = target.length; i <= index; i++) {
                        target[i] = {};
                    }
                }
                
                // Recursively process the remaining path
                if (pathAfterArray) {
                    // Remove leading dot if present
                    const remaining = pathAfterArray.startsWith('.') ? pathAfterArray.substring(1) : pathAfterArray;
                    if (remaining) {
                        this._updatePathRecursive(target[index], remaining, value, immediate, source);
                        return;
                    }
                } else {
                    // This is a direct array element assignment
                    target[index] = value;
                }
            } else {
                // Array is at root level
                if (!Array.isArray(currentObj)) {
                    const newArray = [];
                    Object.assign(newArray, currentObj);
                    Object.keys(currentObj).forEach(key => delete currentObj[key]);
                    Object.assign(currentObj, newArray);
                }
                
                if (index >= currentObj.length) {
                    for (let i = currentObj.length; i <= index; i++) {
                        currentObj[i] = {};
                    }
                }
                
                if (pathAfterArray) {
                    const remaining = pathAfterArray.startsWith('.') ? pathAfterArray.substring(1) : pathAfterArray;
                    if (remaining) {
                        this._updatePathRecursive(currentObj[index], remaining, value, immediate, source);
                        return;
                    }
                } else {
                    currentObj[index] = value;
                }
            }
        } else {
            // No array notation, handle as regular dot notation path
            const pathParts = remainingPath.split('.');
            let target = currentObj;
            
            // Navigate to parent of target
            for (let i = 0; i < pathParts.length - 1; i++) {
                const part = pathParts[i];
                if (!(part in target) || typeof target[part] !== 'object') {
                    target[part] = {};
                }
                target = target[part];
            }
            
            // Set the value
            const lastPart = pathParts[pathParts.length - 1];
            target[lastPart] = value;
        }
        
        // Set the source before generating YAML
        this.updateSource = source;
        
        // Generate new YAML
        if (immediate) {
            this._generateYaml();
        } else {
            this._debounceGenerate();
        }
    }

    /**
     * Update an array element at a specific path (legacy method for simple array paths)
     * @private
     * @param {string} path - Path with array notation (e.g., 'items[0]')
     * @param {*} value - New value
     * @param {boolean} immediate - Whether to update immediately or debounce
     * @param {string} source - Source of the update ('form' or 'yaml')
     */
    _updateArrayPath(path, value, immediate = false, source = null) {
        // This method is now deprecated since _updatePathRecursive handles all cases
        // For backwards compatibility, delegate to the new method
        this._updatePathRecursive(this.data, path, value, immediate, source);
    }

    /**
     * Add a new item to an array at a specific path
     * @param {string} path - Dot notation path to the array
     * @param {*} item - Item to add
     * @param {boolean} immediate - Whether to update immediately or debounce
     * @param {string} source - Source of the update ('form' or 'yaml')
     */
    addArrayItem(path, item, immediate = false, source = null) {
        console.log('[YamlDataManager] addArrayItem called with path:', path, 'item:', item, 'source:', source);
        
        const pathParts = path.split('.');
        let current = this.data;
        
        // Navigate to the target
        for (const part of pathParts) {
            if (!(part in current) || typeof current[part] !== 'object') {
                current[part] = {};
            }
            current = current[part];
        }
        
        // Ensure it's an array
        if (!Array.isArray(current)) {
            console.log('[YamlDataManager] Converting to array at path:', path);
            current = [];
            const parentPath = pathParts.slice(0, -1).join('.');
            const lastPart = pathParts[pathParts.length - 1];
            this.updateDataPath(parentPath, current, true, source);
        }
        
        // If the array has existing items, use the first item as a template for structure
        let newItem = item;
        if (current.length > 0 && typeof current[0] === 'object' && current[0] !== null && !Array.isArray(current[0])) {
            console.log('[YamlDataManager] Using first item as template for new array item');
            // Create a new item with the same structure as the first item
            newItem = {};
            for (const key in current[0]) {
                if (current[0].hasOwnProperty(key)) {
                    // Copy the structure but use empty values
                    if (typeof current[0][key] === 'boolean') {
                        newItem[key] = false;
                    } else if (typeof current[0][key] === 'number') {
                        newItem[key] = 0;
                    } else {
                        newItem[key] = '';
                    }
                }
            }
            console.log('[YamlDataManager] Created new item with structure:', newItem);
        }
        
        // Add the item
        current.push(newItem);
        console.log('[YamlDataManager] Added new item to array, new length:', current.length);
        
        // Set the source before generating YAML
        this.updateSource = source;
        
        // Generate new YAML
        if (immediate) {
            this._generateYaml();
        } else {
            this._debounceGenerate();
        }
    }

    /**
     * Remove an item from an array at a specific path
     * @param {string} path - Dot notation path to the array
     * @param {number} index - Index of item to remove
     * @param {boolean} immediate - Whether to update immediately or debounce
     * @param {string} source - Source of the update ('form' or 'yaml')
     */
    removeArrayItem(path, index, immediate = false, source = null) {
        const pathParts = path.split('.');
        let current = this.data;
        
        // Navigate to the target
        for (const part of pathParts) {
            if (!(part in current) || typeof current[part] !== 'object') {
                return; // Path doesn't exist
            }
            current = current[part];
        }
        
        // Ensure it's an array and index is valid
        if (Array.isArray(current) && index >= 0 && index < current.length) {
            current.splice(index, 1);
            
            // Set the source before generating YAML
            this.updateSource = source;
            
            // Generate new YAML
            if (immediate) {
                this._generateYaml();
            } else {
                this._debounceGenerate();
            }
        }
    }

    /**
     * Add a new property to an object at a specific path
     * @param {string} path - Dot notation path to the object
     * @param {string} key - Key of the new property
     * @param {*} value - Value of the new property
     * @param {boolean} immediate - Whether to update immediately or debounce
     * @param {string} source - Source of the update ('form' or 'yaml')
     */
    addObjectProperty(path, key, value, immediate = false, source = null) {
        console.log('[YamlDataManager] addObjectProperty called with path:', path, 'key:', key, 'value:', value, 'source:', source);
        
        const pathParts = path.split('.');
        let current = this.data;
        
        // Navigate to the target
        for (const part of pathParts) {
            if (!(part in current) || typeof current[part] !== 'object') {
                current[part] = {};
            }
            current = current[part];
        }
        
        // Check if this is an array of objects
        if (Array.isArray(current)) {
            console.log('[YamlDataManager] Adding property to all objects in array');
            // Add the property to all objects in the array
            for (const item of current) {
                if (typeof item === 'object' && item !== null && !Array.isArray(item)) {
                    item[key] = value;
                }
            }
        } else {
            // Ensure it's an object
            if (typeof current !== 'object' || current === null || Array.isArray(current)) {
                current = {};
                const parentPath = pathParts.slice(0, -1).join('.');
                const lastPart = pathParts[pathParts.length - 1];
                this.updateDataPath(parentPath, current, true, source);
            }
            
            // Add the property
            current[key] = value;
        }
        
        // Set the source before generating YAML
        this.updateSource = source;
        
        // Generate new YAML
        if (immediate) {
            this._generateYaml();
        } else {
            this._debounceGenerate();
        }
    }

    /**
     * Remove a property from an object at a specific path
     * @param {string} path - Dot notation path to the object
     * @param {string} key - Key of the property to remove
     * @param {boolean} immediate - Whether to update immediately or debounce
     * @param {string} source - Source of the update ('form' or 'yaml')
     */
    removeObjectProperty(path, key, immediate = false, source = null) {
        console.log('[YamlDataManager] removeObjectProperty called with path:', path, 'key:', key, 'source:', source);
        
        const pathParts = path.split('.');
        let current = this.data;
        
        // Navigate to the target
        for (const part of pathParts) {
            if (!(part in current) || typeof current[part] !== 'object') {
                return; // Path doesn't exist
            }
            current = current[part];
        }
        
        // Check if this is an array of objects
        if (Array.isArray(current)) {
            console.log('[YamlDataManager] Removing property from all objects in array');
            // Remove the property from all objects in the array
            let propertyRemoved = false;
            for (const item of current) {
                if (typeof item === 'object' && item !== null && !Array.isArray(item) && key in item) {
                    delete item[key];
                    propertyRemoved = true;
                }
            }
            
            // If at least one property was removed, update the YAML
            if (propertyRemoved) {
                // Set the source before generating YAML
                this.updateSource = source;
                
                // Generate new YAML
                if (immediate) {
                    this._generateYaml();
                } else {
                    this._debounceGenerate();
                }
            }
        } else {
            // Ensure it's an object and remove the property
            if (typeof current === 'object' && current !== null && !Array.isArray(current) && key in current) {
                delete current[key];
                
                // Set the source before generating YAML
                this.updateSource = source;
                
                // Generate new YAML
                if (immediate) {
                    this._generateYaml();
                } else {
                    this._debounceGenerate();
                }
            }
        }
    }

    /**
     * Clean up resources
     */
    destroy() {
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
            this.debounceTimer = null;
        }
        this.observers = [];
    }
}