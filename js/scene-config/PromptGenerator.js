/**
 * Abstract base class for prompt generators
 */
export class PromptGenerator {
    /**
     * Generate a system prompt based on the provided YAML data
     * @param {Object} yamlData - YAML data object
     * @returns {Promise<string>} - Generated system prompt
     */
    async generate(yamlData) {
        throw new Error('generate method must be implemented by subclass');
    }

    /**
     * Validate the YAML data for this generator
     * @param {Object} yamlData - YAML data object
     * @returns {boolean} - True if valid, false otherwise
     */
    validate(yamlData) {
        return true; // Default implementation accepts all data
    }

    /**
     * Get any error messages from validation
     * @returns {string[]} - Array of error messages
     */
    getErrors() {
        return [];
    }
}