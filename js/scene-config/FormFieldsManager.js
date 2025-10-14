/**
 * Manages dynamic form fields for the Scene Config tab
 */
export class FormFieldsManager {
    constructor(containerId, addButtonId) {
        this.container = document.getElementById(containerId);
        this.addButton = document.getElementById(addButtonId);
        this.fields = new Map(); // Map of field ID to field data
        this.nextId = 1;
        
        this.init();
    }

    /**
     * Initialize the form fields manager
     */
    init() {
        if (!this.container || !this.addButton) {
            console.error('Form fields container or add button not found');
            return;
        }

        // Add event listener for the add button
        this.addButton.addEventListener('click', () => this.addField());

        // Add some default fields
        this.addField('角色', '销售');
        this.addField('任务', '推销产品');
        this.addField('约束', '保持礼貌和专业');
    }

    /**
     * Add a new form field
     * @param {string} name - Field name (optional)
     * @param {string} value - Field value (optional)
     * @returns {string} - Field ID
     */
    addField(name = '', value = '') {
        const id = `field-${this.nextId++}`;
        const fieldData = { id, name, value };
        this.fields.set(id, fieldData);

        const fieldElement = this.createFieldElement(fieldData);
        this.container.appendChild(fieldElement);

        return id;
    }

    /**
     * Remove a form field
     * @param {string} id - Field ID
     */
    removeField(id) {
        if (!this.fields.has(id)) {
            return;
        }

        this.fields.delete(id);
        const fieldElement = document.getElementById(id);
        if (fieldElement) {
            fieldElement.remove();
        }
    }

    /**
     * Update a form field
     * @param {string} id - Field ID
     * @param {string} name - New field name
     * @param {string} value - New field value
     */
    updateField(id, name, value) {
        if (!this.fields.has(id)) {
            return;
        }

        const fieldData = this.fields.get(id);
        fieldData.name = name;
        fieldData.value = value;
    }

    /**
     * Get all form fields as an object
     * @returns {Object} - Object with field names as keys and field values as values
     */
    getFields() {
        const result = {};
        
        for (const [id, fieldData] of this.fields) {
            if (fieldData.name && fieldData.name.trim() !== '') {
                result[fieldData.name] = fieldData.value;
            }
        }
        
        return result;
    }

    /**
     * Get all form fields as an array
     * @returns {Array} - Array of field data objects
     */
    getFieldsArray() {
        return Array.from(this.fields.values());
    }

    /**
     * Clear all form fields
     */
    clearFields() {
        this.fields.clear();
        this.container.innerHTML = '';
        this.nextId = 1;
    }

    /**
     * Create a form field element
     * @param {Object} fieldData - Field data object
     * @returns {HTMLElement} - Form field element
     */
    createFieldElement(fieldData) {
        const fieldElement = document.createElement('div');
        fieldElement.className = 'form-field';
        fieldElement.id = fieldData.id;

        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.className = 'field-name';
        nameInput.placeholder = '字段名';
        nameInput.value = fieldData.name;

        const valueInput = document.createElement('input');
        valueInput.type = 'text';
        valueInput.className = 'field-value';
        valueInput.placeholder = '字段值';
        valueInput.value = fieldData.value;

        const removeButton = document.createElement('button');
        removeButton.className = 'remove-field-btn';
        removeButton.textContent = '删除';

        // Add event listeners
        nameInput.addEventListener('input', (e) => {
            this.updateField(fieldData.id, e.target.value, fieldData.value);
        });

        valueInput.addEventListener('input', (e) => {
            this.updateField(fieldData.id, fieldData.name, e.target.value);
        });

        removeButton.addEventListener('click', () => {
            this.removeField(fieldData.id);
        });

        // Add elements to the field element
        fieldElement.appendChild(nameInput);
        fieldElement.appendChild(valueInput);
        fieldElement.appendChild(removeButton);

        return fieldElement;
    }

    /**
     * Load fields from an object
     * @param {Object} fieldsData - Object with field names as keys and field values as values
     */
    loadFields(fieldsData) {
        this.clearFields();
        
        for (const [name, value] of Object.entries(fieldsData)) {
            this.addField(name, value);
        }
    }

    /**
     * Load fields from an array
     * @param {Array} fieldsArray - Array of field data objects
     */
    loadFieldsFromArray(fieldsArray) {
        this.clearFields();
        
        for (const fieldData of fieldsArray) {
            this.addField(fieldData.name || '', fieldData.value || '');
        }
    }
}