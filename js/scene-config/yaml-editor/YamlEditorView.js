/**
 * YAML text editor view with error highlighting and syntax highlighting overlay
 */
export class YamlEditorView {
    /**
     * Constructor
     * @param {string} containerId - ID of the container element
     * @param {YamlDataManager} dataManager - YamlDataManager instance
     */
    constructor(containerId, dataManager) {
        this.container = document.getElementById(containerId);
        this.dataManager = dataManager;
        this.textarea = null;
        this.highlightPre = null;
        this.isUpdating = false;
        this.lastCursorPosition = 0;
        this.lastSelectionStart = 0;
        this.lastSelectionEnd = 0;
        
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
        this.createEditor();
        this.setupEventListeners();
        this.dataManager.addObserver(this.handleDataChange.bind(this));
    }

    /**
     * Create the editor UI with a highlighted pre behind the textarea
     */
    createEditor() {
        // Create header
        const header = document.createElement('div');
        header.className = 'yaml-editor-header';
        header.textContent = '场景结构编辑';
        
        // Create wrapper for overlay
        const wrapper = document.createElement('div');
        wrapper.className = 'yaml-editor-overlay-wrapper';
        wrapper.style.position = 'relative';
        wrapper.style.flex = '1';
        wrapper.style.overflow = 'hidden';
        
        // Create highlight pre
        this.highlightPre = document.createElement('pre');
        this.highlightPre.className = 'yaml-highlight';
        this.highlightPre.setAttribute('aria-hidden', 'true');
        this.highlightPre.style.margin = '0';
        this.highlightPre.style.padding = '15px';
        this.highlightPre.style.overflow = 'auto';
        this.highlightPre.style.height = '100%';
        this.highlightPre.style.boxSizing = 'border-box';
        
        const code = document.createElement('code');
        code.className = 'yaml-highlight-code';
        this.highlightPre.appendChild(code);
        
        // Create textarea
        this.textarea = document.createElement('textarea');
        this.textarea.className = 'yaml-editor-textarea';
        this.textarea.placeholder = 'Enter YAML here...';
        this.textarea.spellcheck = false;
        this.textarea.wrap = 'off';
        this.textarea.style.background = 'transparent';
        this.textarea.style.position = 'absolute';
        this.textarea.style.left = '0';
        this.textarea.style.top = '0';
        this.textarea.style.width = '100%';
        this.textarea.style.height = '100%';
        this.textarea.style.resize = 'none';
        this.textarea.style.padding = '15px';
        this.textarea.style.boxSizing = 'border-box';
        this.textarea.style.color = 'transparent';
        this.textarea.style.caretColor = '#000';
        this.textarea.style.zIndex = '2';
        this.textarea.style.border = 'none';
        this.textarea.setAttribute('data-snap-id', 'yaml-editor');
        
        // Create error message container
        this.errorContainer = document.createElement('div');
        this.errorContainer.className = 'yaml-editor-error';
        this.errorContainer.style.display = 'none';
        
        // Assemble
        wrapper.appendChild(this.highlightPre);
        wrapper.appendChild(this.textarea);
        
        this.container.appendChild(header);
        this.container.appendChild(wrapper);
        this.container.appendChild(this.errorContainer);
        
        // Initialize highlight with initial content
        this.updateHighlight();
    }

    /**
     * Set up event listeners
     */
    setupEventListeners() {
        // Handle input events immediately
        this.textarea.addEventListener('input', (e) => {
            // Save cursor position and selection
            this.saveCursorPosition();
            
            // Process input immediately
            this.handleTextInput(e.target.value);
            this.updateHighlight();
        });
        
        // Sync scroll between textarea and highlight pre
        this.textarea.addEventListener('scroll', () => {
            this.highlightPre.scrollTop = this.textarea.scrollTop;
            this.highlightPre.scrollLeft = this.textarea.scrollLeft;
        });
        
        // Handle key events for Tab and Enter behavior
        this.textarea.addEventListener('keydown', (e) => {
            // Save cursor position before any changes
            this.saveCursorPosition();
            
            // Handle Tab key - indent selected lines or insert 2 spaces
            if (e.key === 'Tab') {
                e.preventDefault();
                const start = this.textarea.selectionStart;
                const end = this.textarea.selectionEnd;
                
                if (start !== end) {
                    // Indent or outdent selected lines
                    if (e.shiftKey) {
                        this._outdentSelectedLines(start, end);
                    } else {
                        this._indentSelectedLines(start, end);
                    }
                } else {
                    // No selection - insert spaces at cursor
                    this.insertText('  ');
                }
                this.updateHighlight();
                return;
            }
            
            // Handle Enter key - preserve current line indentation
            if (e.key === 'Enter') {
                e.preventDefault();
                this.handleEnterKey();
                this.updateHighlight();
                return;
            }
        });
        
        // Handle selection changes
        this.textarea.addEventListener('mouseup', () => {
            this.saveCursorPosition();
        });
        
        this.textarea.addEventListener('keyup', () => {
            this.saveCursorPosition();
        });
    }

    /**
     * Save current cursor position and selection
     */
    saveCursorPosition() {
        if (this.textarea) {
            this.lastCursorPosition = this.textarea.selectionStart;
            this.lastSelectionStart = this.textarea.selectionStart;
            this.lastSelectionEnd = this.textarea.selectionEnd;
        }
    }

    /**
     * Restore cursor position and selection
     */
    restoreCursorPosition() {
        if (this.textarea && document.activeElement === this.textarea) {
            try {
                this.textarea.setSelectionRange(
                    this.lastSelectionStart,
                    this.lastSelectionEnd
                );
            } catch (e) {
                // Ignore errors when restoring cursor position
                console.warn('Error restoring cursor position:', e);
            }
        }
    }

    /**
     * Insert text at current cursor position
     * @param {string} textToInsert - Text to insert
     */
    insertText(textToInsert) {
        if (!this.textarea) return;
        
        const start = this.textarea.selectionStart;
        const end = this.textarea.selectionEnd;
        const text = this.textarea.value;
        
        // Insert the text
        const newText = text.substring(0, start) + textToInsert + text.substring(end);
        
        // Update the textarea value
        this.textarea.value = newText;
        
        // Set cursor position after the inserted text
        const newCursorPos = start + textToInsert.length;
        this.textarea.setSelectionRange(newCursorPos, newCursorPos);
        
        // Trigger input event to update the data manager
        this.handleTextInput(newText);
        this.updateHighlight();
    }

    /**
     * Indent all lines that intersect the selection by 2 spaces
     * After modification the selection will cover the whole modified block (from start of first line to end of last line)
     */
    _indentSelectedLines(selectionStart, selectionEnd) {
        const text = this.textarea.value;
        const startLineStart = text.lastIndexOf('\n', selectionStart - 1) + 1;
        let endLineEnd = text.indexOf('\n', selectionEnd);
        if (endLineEnd === -1) endLineEnd = text.length;

        const before = text.substring(0, startLineStart);
        const selection = text.substring(startLineStart, endLineEnd);
        const after = text.substring(endLineEnd);

        const indentedLines = selection.split('\n').map(line => '  ' + line);
        const indented = indentedLines.join('\n');
        const newText = before + indented + after;

        // Set the textarea value, then select the full modified block
        this.textarea.value = newText;

        const newSelectionStart = startLineStart;
        const newSelectionEnd = startLineStart + indented.length;

        try {
            this.textarea.setSelectionRange(newSelectionStart, newSelectionEnd);
        } catch (e) {
            // ignore if selection fails
            console.warn('setSelectionRange error after indent:', e);
        }

        // Update data and highlight
        this.handleTextInput(newText);
        this.updateHighlight();
    }

    /**
     * Outdent selected lines by removing up to 2 leading spaces
     * After modification the selection will cover the whole modified block (from start of first line to end of last line)
     */
    _outdentSelectedLines(selectionStart, selectionEnd) {
        const text = this.textarea.value;
        const startLineStart = text.lastIndexOf('\n', selectionStart - 1) + 1;
        let endLineEnd = text.indexOf('\n', selectionEnd);
        if (endLineEnd === -1) endLineEnd = text.length;

        const before = text.substring(0, startLineStart);
        const selection = text.substring(startLineStart, endLineEnd);
        const after = text.substring(endLineEnd);

        // Count total characters removed across all lines
        let totalRemoved = 0;
        const outdentedLines = selection.split('\n').map(line => {
            if (line.startsWith('  ')) {
                totalRemoved += 2;
                return line.substring(2);
            } else if (line.startsWith(' ')) {
                totalRemoved += 1;
                return line.substring(1);
            }
            return line;
        });

        const outdented = outdentedLines.join('\n');
        const newText = before + outdented + after;

        this.textarea.value = newText;

        const newSelectionStart = startLineStart;
        const newSelectionEnd = startLineStart + outdented.length;

        try {
            this.textarea.setSelectionRange(newSelectionStart, newSelectionEnd);
        } catch (e) {
            console.warn('setSelectionRange error after outdent:', e);
        }

        // Update data and highlight
        this.handleTextInput(newText);
        this.updateHighlight();
    }

    /**
     * Handle Enter key - preserve current line indentation
     */
    handleEnterKey() {
        if (!this.textarea) return;
        
        const text = this.textarea.value;
        const cursorPos = this.textarea.selectionStart;
        
        // Find the start of the current line
        let lineStart = cursorPos;
        while (lineStart > 0 && text[lineStart - 1] !== '\n') {
            lineStart--;
        }
        
        // Extract indentation from the current line
        let indentation = '';
        let currentPos = lineStart;
        while (currentPos < text.length && (text[currentPos] === ' ' || text[currentPos] === '\t')) {
            indentation += text[currentPos];
            currentPos++;
        }
        
        // Create the new line with preserved indentation
        const newLine = '\n' + indentation;
        
        // Insert the new line
        this.insertText(newLine);
    }

    /**
     * Handle text input from the textarea
     * @param {string} text - Input text
     */
    handleTextInput(text) {
        console.log('[YamlEditorView] handleTextInput called, isUpdating:', this.isUpdating);
        if (this.isUpdating) return;
        
        console.log('[YamlEditorView] Setting source to "yaml" and updating YAML text');
        // Set the source before updating
        this.dataManager.updateSource = 'yaml';
        this.dataManager.setYamlText(text);
    }

    /**
     * Update the syntax-highlighted pre to mirror textarea content
     */
    updateHighlight() {
        if (!this.highlightPre) return;
        const code = this.highlightPre.querySelector('.yaml-highlight-code');
        if (!code) return;
        
        // Use raw textarea text and let the highlighter escape pieces as needed.
        const text = this.textarea ? this.textarea.value : '';
        const highlighted = this._applySimpleYamlHighlight(text);
        code.innerHTML = highlighted + '\n';
    }

    /**
     * Escape HTML special characters
     */
    _escapeHtml(str) {
        return String(str)
            .replace(/&/g, '&')
            .replace(/</g, '<')
            .replace(/>/g, '>');
    }

    /**
     * Lightweight YAML-like highlighter with type detection:
     * - keys => .yaml-key (bold)
     * - strings, numbers, booleans, nulls, list markers => distinct classes and light weight
     * - comments => .yaml-comment
     *
     * This is intentionally simple (not a full YAML parser) but covers common cases:
     *  - list items starting with "- "
     *  - key: value pairs
     *  - quoted strings, numbers, booleans, null
     *
     * Preserve exact leading spaces by converting them to non-breaking spaces
     * so the overlay does not collapse multiple spaces and shift caret alignment.
     */
    _applySimpleYamlHighlight(text) {
        const lines = String(text).split('\n');
        return lines.map(line => {
            // Separate comment first (raw text)
            const commentIndex = line.indexOf('#');
            let codePart = line;
            let commentPart = '';
            if (commentIndex !== -1) {
                codePart = line.substring(0, commentIndex);
                commentPart = line.substring(commentIndex);
            }

            // Preserve leading spaces visually using plain spaces escaped for HTML
            const leadingMatch = codePart.match(/^(\s*)/);
            const indent = leadingMatch ? leadingMatch[1] : '';
            const indentHtml = this._escapeHtml(indent);
    
            // Detect list item ("- ...") and preserve the exact whitespace after the dash
            const listMatch = codePart.match(/^\s*-(\s*)(.*)$/);
            if (listMatch) {
                const sepAfterDash = listMatch[1]; // exact whitespace (may be empty) after '-'
                const rest = listMatch[2];
                const kvInList = rest.match(/^([^:\n]+):(\s*)(.*)$/);
                if (kvInList) {
                    const [, key, sepAfterColon, value] = kvInList;
                    const keyHtml = `<span class="yaml-key">${this._escapeHtml(key)}</span>`;
                    const valueHtml = this._valueHtml(value);
                    const sepHtml = this._escapeHtml(sepAfterDash);
                    const colonSepHtml = this._escapeHtml(sepAfterColon);
                    return `${indentHtml}<span class="yaml-list-mark">-</span>${sepHtml}${keyHtml}:${colonSepHtml}${valueHtml}${this._escapeHtml(commentPart)}`;
                } else {
                    const valueHtml = this._valueHtml(rest);
                    const sepHtml = this._escapeHtml(sepAfterDash);
                    return `${indentHtml}<span class="yaml-list-mark">-</span>${sepHtml}${valueHtml}${this._escapeHtml(commentPart)}`;
                }
            }

            // Match key: value pattern
            const kvMatch = codePart.match(/^(\s*)([^:\n]+):(\s*)(.*)$/);
            if (kvMatch) {
                const [, , key, sepSpace, value] = kvMatch;
                const sepSpaceHtml = this._escapeHtml(sepSpace);
                const keyHtml = `<span class="yaml-key">${this._escapeHtml(key)}</span>`;
                const valueHtml = this._valueHtml(value);
                return `${indentHtml}${keyHtml}:${sepSpaceHtml}${valueHtml}${this._escapeHtml(commentPart)}`;
            }

            // Plain non-kv line (could be standalone value)
            if (codePart.trim() !== '') {
                // Keep original spacing visually
                const trimmedValue = codePart.trim();
                return `${indentHtml}${this._valueHtml(trimmedValue)}${this._escapeHtml(commentPart)}`;
            }

            // Empty or only comment line
            if (commentPart) {
                return `${this._escapeHtml(commentPart)}`;
            }

            // Preserve empty line
            return '';
        }).join('\n');
    }

    /**
     * Wrap a raw (escaped) value string with an appropriate span based on detected type.
     * Keeps the visual weight light for non-key elements.
     */
    _valueHtml(rawValue) {
        if (rawValue === undefined || rawValue === null) return '';
        const v = rawValue.trim();
        if (v === '') return '';

        // Quoted string
        if (/^["'].*["']$/.test(v)) {
            return `<span class="yaml-value yaml-string">${this._escapeHtml(v)}</span>`;
        }

        // Boolean
        if (/^(true|false)$/i.test(v)) {
            return `<span class="yaml-value yaml-boolean">${this._escapeHtml(v)}</span>`;
        }

        // Null/tilde
        if (/^(null|~)$/i.test(v)) {
            return `<span class="yaml-value yaml-null">${this._escapeHtml(v)}</span>`;
        }

        // Number (integer or float)
        if (/^[+-]?\d+(\.\d+)?$/.test(v)) {
            return `<span class="yaml-value yaml-number">${this._escapeHtml(v)}</span>`;
        }

        // Fallback - treat as plain value (string-like)
        return `<span class="yaml-value yaml-other">${this._escapeHtml(v)}</span>`;
    }

    /**
     * Handle data changes from the data manager
     * @param {Object} data - Change data
     */
    handleDataChange(data) {
        console.log('[YamlEditorView] handleDataChange called, isUpdating:', this.isUpdating, 'source:', data.source);
        if (this.isUpdating) return;
        
        // Don't update textarea content if this view was the source of the change
        // But always update error state
        if (data.source === 'yaml') {
            console.log('[YamlEditorView] Skipping textarea update because source is "yaml", but updating error state');
            // Update error state even when this view is the source
            this.updateErrorState(data.isValid, data.error);
            return;
        }
        
        console.log('[YamlEditorView] Processing update from source:', data.source);
        this.isUpdating = true;
        
        try {
            // Update textarea content only if it has changed
            if (this.textarea.value !== data.yamlText) {
                console.log('[YamlEditorView] Updating textarea content');
                this.textarea.value = data.yamlText;
                
                // Restore cursor position after content update
                setTimeout(() => {
                    this.restoreCursorPosition();
                    this.updateHighlight();
                }, 0);
            } else {
                console.log('[YamlEditorView] Textarea content unchanged, skipping update');
            }
            
            // Update error state
            this.updateErrorState(data.isValid, data.error);
        } finally {
            this.isUpdating = false;
        }
    }

    /**
     * Update error state display
     * @param {boolean} isValid - Whether YAML is valid
     * @param {string|null} error - Error message or null
     */
    updateErrorState(isValid, error) {
        console.log('[YamlEditorView] updateErrorState called with isValid:', isValid, 'error:', error);
        console.log('[YamlEditorView] textarea element:', this.textarea);
        console.log('[YamlEditorView] errorContainer element:', this.errorContainer);
        
        if (isValid) {
            console.log('[YamlEditorView] Removing error state');
            this.textarea.classList.remove('yaml-error');
            this.errorContainer.style.display = 'none';
        } else {
            console.log('[YamlEditorView] Adding error state');
            this.textarea.classList.add('yaml-error');
            this.errorContainer.textContent = error || 'Invalid YAML';
            this.errorContainer.style.display = 'block';
            
            // Verify the error state was applied
            console.log('[YamlEditorView] textarea classList after adding error:', this.textarea.classList);
            console.log('[YamlEditorView] errorContainer display after adding error:', this.errorContainer.style.display);
        }
    }

    /**
     * Set the YAML content
     * @param {string} yamlText - YAML text to set
     */
    setYaml(yamlText) {
        if (this.textarea) {
            this.textarea.value = yamlText;
            this.updateHighlight();
            this.dataManager.setYamlText(yamlText, true);
        }
    }

    /**
     * Get the current YAML content
     * @returns {string} Current YAML content
     */
    getYaml() {
        return this.textarea ? this.textarea.value : '';
    }

    /**
     * Focus the editor
     */
    focus() {
        if (this.textarea) {
            this.textarea.focus();
        }
    }

    /**
     * Clean up resources
     */
    destroy() {
        if (this.textarea) {
            this.textarea.removeEventListener('input', this.handleTextInput);
            this.textarea.removeEventListener('keydown', this.saveCursorPosition);
            this.textarea.removeEventListener('mouseup', this.saveCursorPosition);
            this.textarea.removeEventListener('keyup', this.saveCursorPosition);
        }
        
        if (this.dataManager) {
            this.dataManager.removeObserver(this.handleDataChange);
        }
    }
}