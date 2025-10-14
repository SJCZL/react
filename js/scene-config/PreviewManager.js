/**
 * Manages the preview area and copy/apply functionality
 */
export class PreviewManager {
    constructor(previewTextareaId, copyButtonId, applyButtonId) {
        this.previewTextarea = document.getElementById(previewTextareaId);
        this.copyButton = document.getElementById(copyButtonId);
        this.applyButton = document.getElementById(applyButtonId);
        this.onApplyCallback = null;
        
        this.init();
    }

    /**
     * Initialize the preview manager
     */
    init() {
        if (!this.previewTextarea || !this.copyButton || !this.applyButton) {
            console.error('Preview elements not found');
            return;
        }

        // Add event listeners
        this.copyButton.addEventListener('click', () => this.copyToClipboard());
        this.applyButton.addEventListener('click', () => this.applyToChat());
    }

    /**
     * Set the callback for when the apply button is clicked
     * @param {Function} callback - Callback function
     */
    setOnApplyCallback(callback) {
        this.onApplyCallback = callback;
    }

    /**
     * Update the preview text
     * @param {string} text - Text to display in the preview
     */
    updatePreview(text) {
        if (!this.previewTextarea) {
            return;
        }

        this.previewTextarea.value = text || '';
    }

    /**
     * Copy the preview text to clipboard
     */
    async copyToClipboard() {
        if (!this.previewTextarea) {
            return;
        }

        try {
            await navigator.clipboard.writeText(this.previewTextarea.value);
            this.showCopySuccess();
        } catch (err) {
            console.error('Failed to copy text: ', err);
            this.showCopyError();
        }
    }

    /**
     * Apply the preview text to the main chat
     */
    applyToChat() {
        if (!this.previewTextarea || !this.onApplyCallback) {
            return;
        }

        const text = this.previewTextarea.value;
        if (text && text.trim() !== '') {
            this.onApplyCallback(text);
        }
    }

    /**
     * Show a success message when copying to clipboard
     */
    showCopySuccess() {
        const originalText = this.copyButton.textContent;
        this.copyButton.textContent = '已复制!';
        this.copyButton.style.background = '#3e3e3eff';
        this.copyButton.style.color = 'white';
        
        setTimeout(() => {
            this.copyButton.textContent = originalText;
            this.copyButton.style.background = '';
            this.copyButton.style.color = '';
        }, 2000);
    }

    /**
     * Show an error message when copying to clipboard fails
     */
    showCopyError() {
        const originalText = this.copyButton.textContent;
        this.copyButton.textContent = '复制失败';
        this.copyButton.style.background = '#f44336';
        this.copyButton.style.color = 'white';
        
        setTimeout(() => {
            this.copyButton.textContent = originalText;
            this.copyButton.style.background = '';
            this.copyButton.style.color = '';
        }, 2000);
    }

    /**
     * Show a success message when applying to chat
     */
    showApplySuccess() {
        const originalText = this.applyButton.textContent;
        const originalColor = this.applyButton.style.color;
        this.applyButton.textContent = '已应用!';
        this.applyButton.style.background = '#3e3e3eff';
        this.applyButton.style.color = 'white';
        
        setTimeout(() => {
            this.applyButton.textContent = originalText;
            this.applyButton.style.background = '';
            this.applyButton.style.color = originalColor;
        }, 2000);
    }

    /**
     * Show an error message when applying to chat fails
     */
    showApplyError() {
        const originalText = this.applyButton.textContent;
        this.applyButton.textContent = '应用失败';
        this.applyButton.style.background = '#f44336';
        
        setTimeout(() => {
            this.applyButton.textContent = originalText;
            this.applyButton.style.background = '';
        }, 2000);
    }

    /**
     * Clear the preview text
     */
    clearPreview() {
        if (this.previewTextarea) {
            this.previewTextarea.value = '';
        }
    }

    /**
     * Get the current preview text
     * @returns {string} - Current preview text
     */
    getPreviewText() {
        return this.previewTextarea ? this.previewTextarea.value : '';
    }

    /**
     * Enable/disable the apply button
     * @param {boolean} enabled - Whether to enable the button
     */
    setApplyButtonEnabled(enabled) {
        if (this.applyButton) {
            this.applyButton.disabled = !enabled;
        }
    }

    /**
     * Enable/disable the copy button
     * @param {boolean} enabled - Whether to enable the button
     */
    setCopyButtonEnabled(enabled) {
        if (this.copyButton) {
            this.copyButton.disabled = !enabled;
        }
    }
}