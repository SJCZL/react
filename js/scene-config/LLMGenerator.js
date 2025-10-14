import { PromptGenerator } from './PromptGenerator.js';
import { ApiService } from '../api.js';
import { YamlDataProcessor } from './yaml-editor/YamlDataProcessor.js';

/**
 * LLM-based prompt generator
 * Uses an LLM to generate system prompts based on YAML data
 */
export class LLMGenerator extends PromptGenerator {
    constructor(apiKey, context = '', instruction = '') {
        super();
        this.apiService = new ApiService(apiKey);
        this.context = context;
        this.instruction = instruction;
        this.errors = [];
        this.dataProcessor = new YamlDataProcessor();
        this.processingOptions = {
            flatten: true,
            includePaths: true,
            maxDepth: 5
        };
        this.abortController = null;
        this.isGenerating = false;
    }

    /**
     * Set the context for the LLM
     * @param {string} context - Context information for the LLM
     */
    setContext(context) {
        this.context = context;
    }

    /**
     * Set the instruction for the LLM
     * @param {string} instruction - Instruction for the LLM
     */
    setInstruction(instruction) {
        this.instruction = instruction;
    }

    /**
     * Generate a system prompt using an LLM with streaming support
     * @param {Object} yamlData - YAML data object
     * @param {Function} onStream - Callback for streaming updates
     * @returns {Promise<string>} - Generated system prompt
     */
    async generate(yamlData, onStream = null) {
        if (!this.validate(yamlData)) {
            throw new Error('Validation failed: ' + this.errors.join(', '));
        }

        // Process YAML data for LLM consumption
        const processedData = this.dataProcessor.processYamlData(yamlData, this.processingOptions);
        
        // Format processed data as context for the LLM
        const fieldsText = this.formatFieldsForLLM(processedData);
        
        // Create the prompt for the LLM
        const systemPrompt = this.createLLMPrompt(fieldsText);
        
        // Create a simple conversation with just the system message
        const messages = [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: '请生成系统提示。' }
        ];

        try {
            // Create a new abort controller for this generation
            this.abortController = new AbortController();
            this.isGenerating = true;
            
            // Add logging for debugging
            console.log('[LLMGenerator] Starting generation with API key:',
                this.apiService.apiKey ? `Key exists (length: ${this.apiService.apiKey.length})` : 'NO API KEY');
            console.log('[LLMGenerator] Messages being sent:', messages);
            
            // Use the API service to generate the response
            const reader = await this.apiService.streamLLMResponse(
                messages,
                0.7,  // temperature
                0.9,  // top_p
                this.abortController.signal  // pass the abort signal
            );

            const decoder = new TextDecoder();
            let result = '';

            while (this.isGenerating) {
                const { value, done } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split('\n\n');

                for (const line of lines) {
                    if (line.startsWith('data:')) {
                        const dataStr = line.substring(5).trim();
                        if (dataStr === '[DONE]') {
                            this.isGenerating = false;
                            return result;
                        }
                        try {
                            const parsed = JSON.parse(dataStr);
                            const content = parsed.choices[0]?.delta?.content;
                            if (content) {
                                result += content;
                                // Call the streaming callback if provided
                                if (onStream) {
                                    onStream(result);
                                }
                            }
                        } catch (e) {
                            // Ignore parsing errors
                        }
                    }
                }
            }

            this.isGenerating = false;
            return result;
        } catch (error) {
            this.isGenerating = false;
            if (error.name === 'AbortError') {
                throw new Error('Generation was stopped');
            }
            throw new Error(`LLM generation failed: ${error.message}`);
        }
    }

    /**
     * Stop the current generation
     */
    stopGeneration() {
        if (this.isGenerating && this.abortController) {
            this.abortController.abort();
            this.isGenerating = false;
        }
    }

    /**
     * Check if currently generating
     * @returns {boolean} - True if generating
     */
    isCurrentlyGenerating() {
        return this.isGenerating;
    }

    /**
     * Format processed data for LLM consumption
     * @param {Object} processedData - Object containing field names and values
     * @returns {string} - Formatted fields text
     */
    formatFieldsForLLM(processedData) {
        let result = '';
        
        for (const [fieldName, fieldValue] of Object.entries(processedData)) {
            // Skip empty values
            if (fieldValue && fieldValue.toString().trim() !== '') {
                result += `${fieldName}: ${fieldValue}\n`;
            }
        }
        
        return result;
    }

    /**
     * Create the prompt for the LLM
     * @param {string} fieldsText - Formatted form fields
     * @returns {string} - Complete prompt for the LLM
     */
    createLLMPrompt(fieldsText) {
        let prompt = '';
        
        if (this.context) {
            prompt += `${this.context}\n\n`;
        }
        
        prompt += `字段信息：\n${fieldsText}\n\n`;
        
        if (this.instruction) {
            prompt += `${this.instruction}\n\n`;
        }
        
        prompt += '请基于以上信息生成一个清晰、具体的系统提示。确保生成的提示包含所有必要的信息，并且格式清晰。';
        
        return prompt;
    }

    /**
     * Validate the context and instruction
     * @param {Object} yamlData - YAML data object
     * @returns {boolean} - True if valid, false otherwise
     */
    validate(yamlData) {
        this.errors = [];

        if (!this.context || this.context.trim() === '') {
            this.errors.push('LLM context cannot be empty');
        }

        if (!this.instruction || this.instruction.trim() === '') {
            this.errors.push('LLM instruction cannot be empty');
        }

        // YAML data is optional for LLM-based generation.
        // Allow generation even when yamlData is empty — processedData will simply be empty.
        // This removes the mandatory requirement for YAML when using the "生成系统提示" button.
        // Keep the check commented out for future reference:
        // if (!yamlData || Object.keys(yamlData).length === 0) {
        //     this.errors.push('YAML data is required');
        // }

        return this.errors.length === 0;
    }

    /**
     * Get any error messages from validation
     * @returns {string[]} - Array of error messages
     */
    getErrors() {
        return this.errors;
    }
}