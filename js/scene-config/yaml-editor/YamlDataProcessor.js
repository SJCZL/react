/**
 * Processes YAML data for prompt generation
 * Handles flattening nested structures and extracting relevant information
 */
export class YamlDataProcessor {
    constructor() {
        this.templateCache = new Map();
        this.customProcessors = new Map();
    }

    /**
     * Process YAML data for prompt generation
     * @param {Object} yamlData - The YAML data object
     * @param {Object} options - Processing options
     * @returns {Object} - Processed data suitable for prompt generation
     */
    processYamlData(yamlData, options = {}) {
        const {
            flatten = true,
            includePaths = true,
            maxDepth = 10,
            customProcessors = null
        } = options;

        console.log('[YamlDataProcessor] Processing YAML data:', yamlData);
        
        if (!yamlData || typeof yamlData !== 'object') {
            console.warn('[YamlDataProcessor] Invalid YAML data provided');
            return {};
        }

        // Apply custom processors if provided
        let processedData = yamlData;
        if (customProcessors) {
            processedData = this.applyCustomProcessors(yamlData, customProcessors);
        }

        // Flatten the data if requested
        if (flatten) {
            const flattened = this.flattenObject(processedData, '', includePaths, maxDepth);
            console.log('[YamlDataProcessor] Flattened data:', flattened);
            return flattened;
        }

        return processedData;
    }

    /**
     * Flatten a nested object into key-value pairs
     * @param {Object} obj - Object to flatten
     * @param {string} prefix - Prefix for nested keys
     * @param {boolean} includePaths - Whether to include full paths in keys
     * @param {number} maxDepth - Maximum depth to flatten
     * @returns {Object} - Flattened object
     */
    flattenObject(obj, prefix = '', includePaths = true, maxDepth = 10) {
        const flattened = {};
        
        if (maxDepth <= 0) {
            return flattened;
        }

        for (const [key, value] of Object.entries(obj)) {
            const fullKey = includePaths ? (prefix ? `${prefix}.${key}` : key) : key;
            
            if (value === null || value === undefined) {
                flattened[fullKey] = '';
            } else if (typeof value === 'object' && !Array.isArray(value)) {
                // Include the object path itself as a field with a formatted representation
                flattened[fullKey] = this.formatObject(value);
                // Recursively flatten nested objects
                Object.assign(flattened, this.flattenObject(value, fullKey, includePaths, maxDepth - 1));
            } else if (Array.isArray(value)) {
                // Handle arrays
                if (value.length === 0) {
                    flattened[fullKey] = '';
                } else {
                    // Create entries for each array item with index
                    value.forEach((item, index) => {
                        const indexedKey = `${fullKey}[${index}]`;
                        
                        if (item === null || item === undefined) {
                            flattened[indexedKey] = '';
                        } else if (typeof item === 'object' && !Array.isArray(item)) {
                            // Recursively flatten nested objects in array
                            Object.assign(flattened, this.flattenObject(item, indexedKey, includePaths, maxDepth - 1));
                        } else if (Array.isArray(item)) {
                            // Nested array - create a string representation
                            flattened[indexedKey] = JSON.stringify(item);
                        } else {
                            // Primitive value in array
                            flattened[indexedKey] = String(item);
                        }
                        
                    });
                    
                    // Also create an entry for the array as a whole
                    if (typeof value[0] === 'object' && value[0] !== null) {
                        // Array of objects - format each object
                        const formattedItems = value.map(item => {
                            if (typeof item === 'object' && item !== null) {
                                return this.formatObject(item, 0, 10);
                            }
                            return String(item);
                        }).join(', ');
                        flattened[fullKey] = formattedItems;
                    } else {
                        // Array of primitives
                        flattened[fullKey] = value.join(', ');
                    }
                }
            } else {
                // Primitive value
                flattened[fullKey] = String(value);
            }
        }

        return flattened;
    }

    /**
     * Format an object into a readable string
     * @param {Object} obj - Object to format
     * @param {number} depth - Current recursion depth
     * @param {number} maxDepth - Maximum recursion depth
     * @returns {string} - Formatted string representation
     */
    formatObject(obj, depth = 0, maxDepth = 10) {
        if (!obj || typeof obj !== 'object') {
            return '';
        }

        if (depth >= maxDepth) {
            return '[Object with ' + Object.keys(obj).length + ' properties]';
        }

        // Format the object as key-value pairs
        const entries = Object.entries(obj)
            .map(([key, value]) => {
                if (value === null || value === undefined) {
                    return `${key}: `;
                } else if (typeof value === 'object' && !Array.isArray(value)) {
                    return `${key}: ${this.formatObject(value, depth + 1, maxDepth)}`;
                } else if (Array.isArray(value)) {
                    if (value.length === 0) {
                        return `${key}: []`;
                    } else if (typeof value[0] === 'object' && value[0] !== null) {
                        // Array of objects - format each object
                        const formattedItems = value.map(item => {
                            if (typeof item === 'object' && item !== null) {
                                return this.formatObject(item, depth + 1, maxDepth);
                            }
                            return String(item);
                        }).join(', ');
                        return `${key}: ${formattedItems}`;
                    } else {
                        // Array of primitives
                        return `${key}: ${value.join(', ')}`;
                    }
                } else {
                    return `${key}: ${value}`;
                }
            })
            .join(', ');

        return entries;
    }

    /**
     * Format an array of objects into a readable string
     * @param {Array} arr - Array of objects
     * @returns {string} - Formatted string representation
     */
    formatArrayOfObjects(arr) {
        if (!arr || arr.length === 0) {
            return '';
        }

        // If all objects have the same structure, format as a table-like structure
        const keys = Object.keys(arr[0]);
        const allSameStructure = arr.every(obj => 
            Object.keys(obj).length === keys.length && 
            keys.every(key => key in obj)
        );

        if (allSameStructure) {
            return arr.map(obj => 
                keys.map(key => `${key}: ${obj[key] || ''}`).join('; ')
            ).join(' | ');
        }

        // Different structures - format each object individually
        return arr.map(obj => 
            Object.entries(obj)
                .map(([k, v]) => `${k}: ${v || ''}`)
                .join(', ')
        ).join('; ');
    }

    /**
     * Apply custom processors to the data
     * @param {Object} data - Data to process
     * @param {Object} processors - Custom processors
     * @returns {Object} - Processed data
     */
    applyCustomProcessors(data, processors) {
        let result = { ...data };
        
        for (const [path, processor] of Object.entries(processors)) {
            if (typeof processor === 'function') {
                const value = this.getNestedValue(data, path);
                const processedValue = processor(value);
                result = this.setNestedValue(result, path, processedValue);
            }
        }
        
        return result;
    }

    /**
     * Get a nested value from an object using dot notation
     * @param {Object} obj - Object to get value from
     * @param {string} path - Dot notation path
     * @returns {*} - The value at the path
     */
    getNestedValue(obj, path) {
        return path.split('.').reduce((current, key) => {
            return current && current[key] !== undefined ? current[key] : undefined;
        }, obj);
    }

    /**
     * Set a nested value in an object using dot notation
     * @param {Object} obj - Object to set value in
     * @param {string} path - Dot notation path
     * @param {*} value - Value to set
     * @returns {Object} - The modified object
     */
    setNestedValue(obj, path, value) {
        const result = { ...obj };
        const keys = path.split('.');
        let current = result;
        
        for (let i = 0; i < keys.length - 1; i++) {
            const key = keys[i];
            if (!(key in current) || typeof current[key] !== 'object') {
                current[key] = {};
            }
            current = current[key];
        }
        
        current[keys[keys.length - 1]] = value;
        return result;
    }

    /**
     * Register a custom processor for a specific data type
     * @param {string} dataType - Data type identifier
     * @param {Function} processor - Processing function
     */
    registerCustomProcessor(dataType, processor) {
        this.customProcessors.set(dataType, processor);
    }

    /**
     * Get a cached template or create and cache a new one
     * @param {string} templateId - Template identifier
     * @param {Function} templateFn - Function to create the template
     * @returns {*} - The cached or newly created template
     */
    getOrCreateTemplate(templateId, templateFn) {
        if (!this.templateCache.has(templateId)) {
            this.templateCache.set(templateId, templateFn());
        }
        return this.templateCache.get(templateId);
    }

    /**
     * Clear the template cache
     */
    clearCache() {
        this.templateCache.clear();
    }

    /**
     * Extract specific fields from YAML data based on a template
     * @param {Object} yamlData - The YAML data
     * @param {Object} template - Template defining which fields to extract
     * @returns {Object} - Extracted fields
     */
    extractFieldsByTemplate(yamlData, template) {
        const result = {};
        
        for (const [outputKey, inputPath] of Object.entries(template)) {
            const value = this.getNestedValue(yamlData, inputPath);
            if (value !== undefined) {
                result[outputKey] = value;
            }
        }
        
        return result;
    }

    /**
     * Create a human-readable summary of the YAML data
     * @param {Object} yamlData - The YAML data
     * @returns {string} - Human-readable summary
     */
    createSummary(yamlData) {
        const flattened = this.flattenObject(yamlData);
        const summary = Object.entries(flattened)
            .map(([key, value]) => `${key}: ${value}`)
            .join('\n');
        
        return summary;
    }
}