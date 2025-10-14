import { PromptGenerator } from './PromptGenerator.js';
import { YamlDataProcessor } from './yaml-editor/YamlDataProcessor.js';

/**
 * Template substitution prompt generator
 * Replaces placeholders like {{field_name}} in a template with actual field values
 */
export class TemplateSubstitutionGenerator extends PromptGenerator {
    constructor(template = '') {
        super();
        this.template = template;
        this.errors = [];
        this.dataProcessor = new YamlDataProcessor();
        this.processingOptions = {
            flatten: true,
            includePaths: true,
            maxDepth: 10
        };
    }

    /**
     * Set the template for substitution
     * @param {string} template - Template with placeholders
     */
    setTemplate(template) {
        this.template = template;
    }

    /**
     * Generate a system prompt by replacing placeholders in the template
     * @param {Object} yamlData - YAML data object
     * @returns {Promise<string>} - Generated system prompt
     */
    async generate(yamlData) {
        if (!this.validate(yamlData)) {
            throw new Error('Validation failed: ' + this.errors.join(', '));
        }

        // Process YAML data for template substitution
        const processedData = this.dataProcessor.processYamlData(yamlData, this.processingOptions);
        
        let result = this.template;
        
        // Replace all placeholders with actual field values
        // Handle both regular fields and array items
        for (const [fieldName, fieldValue] of Object.entries(processedData)) {
            const placeholder = `{{${fieldName}}}`;
            // Escape special regex characters in the placeholder
            const escapedPlaceholder = placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(escapedPlaceholder, 'g');
            result = result.replace(regex, fieldValue);
        }

        return result;
    }

    /**
     * Validate the template and YAML data
     * @param {Object} yamlData - YAML data object
     * @returns {boolean} - True if valid, false otherwise
     */
    validate(yamlData) {
        this.errors = [];

        if (!this.template || this.template.trim() === '') {
            this.errors.push('Template cannot be empty');
            return false;
        }

        // Process YAML data to get flattened structure
        const processedData = this.dataProcessor.processYamlData(yamlData, this.processingOptions);
        
        // Debug: Log the processed data
        console.log('[TemplateSubstitutionGenerator] Processed data keys:', Object.keys(processedData));

        // Check for placeholders that don't have corresponding fields in the processed data
        const placeholderRegex = /{{([^}]+)}}/g;
        const placeholders = [];
        let match;
        
        while ((match = placeholderRegex.exec(this.template)) !== null) {
            placeholders.push(match[1]);
        }
        
        // Debug: Log the placeholders
        console.log('[TemplateSubstitutionGenerator] Found placeholders:', placeholders);

        // Check for missing fields
        const missingFields = placeholders.filter(field => {
            // Check if the field exists in the processed data
            const exists = processedData.hasOwnProperty(field);
            console.log(`[TemplateSubstitutionGenerator] Checking field "${field}": ${exists ? 'exists' : 'missing'}`);
            
            // If the field doesn't exist directly, check if it's a parent path of any existing field
            if (!exists) {
                const isParentPath = Object.keys(processedData).some(key => key.startsWith(field + '.'));
                console.log(`[TemplateSubstitutionGenerator] Field "${field}" is parent path: ${isParentPath}`);
                return !isParentPath;
            }
            
            return !exists;
        });
        
        if (missingFields.length > 0) {
            this.errors.push(`Missing fields for placeholders: ${missingFields.join(', ')}`);
        }

        return this.errors.length === 0;
    }

    /**
     * Get any error messages from validation
     * @returns {string[]} - Array of error messages
     */
    getErrors() {
        return this.errors;
    }

    /**
     * Get all placeholders used in the template
     * @returns {string[]} - Array of placeholder names
     */
    getPlaceholders() {
        const placeholderRegex = /{{([^}]+)}}/g;
        const placeholders = [];
        let match;
        
        while ((match = placeholderRegex.exec(this.template)) !== null) {
            placeholders.push(match[1]);
        }

        return [...new Set(placeholders)]; // Remove duplicates
    }
}