import { PromptGenerator } from './PromptGenerator.js';
import { YamlDataProcessor } from './yaml-editor/YamlDataProcessor.js';

/**
 * Direct output prompt generator
 * Returns a fixed string, but can optionally process YAML data for advanced templates
 */
export class DirectOutputGenerator extends PromptGenerator {
    constructor(output = '') {
        super();
        this.output = output;
        this.errors = [];
        this.dataProcessor = new YamlDataProcessor();
        this.processingOptions = {
            flatten: true,
            includePaths: true,
            maxDepth: 5
        };
    }

    /**
     * Set the direct output text
     * @param {string} output - Fixed output text
     */
    setOutput(output) {
        this.output = output;
    }

    /**
     * Generate a system prompt by returning the output text
     * @param {Object} yamlData - YAML data object
     * @returns {Promise<string>} - Generated system prompt
     */
    async generate(yamlData) {

        return this.output;
    }


    /**
     * Get any error messages from validation
     * @returns {string[]} - Array of error messages
     */
    getErrors() {
        return this.errors;
    }
}