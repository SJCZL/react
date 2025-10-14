# YAML Data Processing Guide

## Overview

This guide explains the revamped communication system between the YAML manager and prompt generators, which addresses the issue where YAML data was being passed as `[object Object]` instead of the actual content.

## Architecture

### Core Components

1. **YamlDataProcessor**: Central component that transforms YAML data into formats suitable for prompt generation
2. **Enhanced Generators**: All prompt generators (LLMGenerator, TemplateSubstitutionGenerator, DirectOutputGenerator) now use the YamlDataProcessor
3. **Improved SceneConfigManager**: Extracts and passes the correct YAML data structure to generators

### Data Flow

```
YAML Editor → YamlDataManager → SceneConfigManager → YamlDataProcessor → Prompt Generators
```

## Key Features

### 1. YamlDataProcessor

The `YamlDataProcessor` class provides comprehensive data transformation capabilities:

#### Flattening Nested Structures
- Converts nested YAML objects into flat key-value pairs
- Preserves hierarchical information through dot notation (e.g., `基本信息.年龄`)
- Handles arrays and objects within arrays

#### Advanced Array Handling
- Primitive arrays: `["a", "b", "c"]` → `"a, b, c"`
- Object arrays: Formatted as structured strings with key-value pairs
- Empty arrays: Handled gracefully

#### Custom Processing
- Register custom processors for specific data types
- Transform values based on business logic
- Apply formatting rules (e.g., adding currency symbols, units)

#### Template Extraction
- Extract specific fields using template definitions
- Map YAML paths to output keys
- Create targeted data subsets

### 2. Enhanced Prompt Generators

All generators now implement a consistent interface:

#### LLMGenerator
- Processes YAML data through YamlDataProcessor before sending to LLM
- Flattens complex structures for better LLM comprehension
- Filters out empty values to reduce noise

#### TemplateSubstitutionGenerator
- Uses flattened YAML data for placeholder replacement
- Supports nested field references (e.g., `{{基本信息.年龄}}`)
- Validates template placeholders against available data

#### DirectOutputGenerator
- Now supports template substitution within fixed output
- Maintains backward compatibility with simple fixed output
- Validates placeholders when used

### 3. Improved SceneConfigManager

- Extracts the main customer profile object from YAML data
- Passes correctly structured data to generators
- Enhanced logging for debugging

## Usage Examples

### Basic Data Processing

```javascript
const processor = new YamlDataProcessor();
const yamlData = {
    "顾客画像": {
        "基本信息": {
            "年龄": 28,
            "性别": "男"
        }
    }
};

// Flatten the data
const flattened = processor.processYamlData(yamlData["顾客画像"]);
// Result: { "基本信息.年龄": "28", "基本信息.性别": "男" }
```

### Custom Processing

```javascript
const processor = new YamlDataProcessor();
const customProcessors = {
    "基本信息.年龄": (value) => `${value}岁`,
    "需求描述.预算区间": (value) => `¥${value}`
};

const processed = processor.processYamlData(yamlData, { customProcessors });
```

### Template Extraction

```javascript
const template = {
    "age": "基本信息.年龄",
    "gender": "基本信息.性别",
    "painPoint": "需求描述.核心痛点"
};

const extracted = processor.extractFieldsByTemplate(yamlData, template);
```

## Migration Guide

### For Generator Implementations

1. **Update Method Signatures**
   ```javascript
   // Old
   async generate(formFields) { ... }
   
   // New
   async generate(yamlData) { ... }
   ```

2. **Add YamlDataProcessor**
   ```javascript
   constructor() {
       this.dataProcessor = new YamlDataProcessor();
       this.processingOptions = {
           flatten: true,
           includePaths: true,
           maxDepth: 5
       };
   }
   ```

3. **Process Data Before Use**
   ```javascript
   const processedData = this.dataProcessor.processYamlData(yamlData, this.processingOptions);
   ```

### For Template Users

1. **Update Placeholder References**
   ```javascript
   // Old
   {{age}}
   
   // New
   {{基本信息.年龄}}
   ```

2. **Use Full Paths for Nested Fields**
   ```javascript
   {{需求描述.核心痛点}}
   {{行为特征.进店流程}}
   ```

## Testing

A comprehensive test suite is provided in `YamlDataProcessorTest.js`:

```javascript
// Run tests
YamlDataProcessorTest.runTests();
```

The tests cover:
- Basic flattening functionality
- Array handling (both primitive and object arrays)
- Template extraction
- Summary generation
- Custom processing

## Benefits

1. **Correct Data Handling**: Eliminates the `[object Object]` issue
2. **Enhanced Flexibility**: Supports complex nested structures
3. **Improved Modularity**: Clear separation of concerns
4. **Better Debugging**: Enhanced logging and error handling
5. **Extensibility**: Easy to add custom processors and transformations

## Troubleshooting

### Common Issues

1. **Empty Output**
   - Check that YAML data has the expected structure
   - Verify that field paths in templates are correct

2. **Missing Placeholders**
   - Ensure all referenced fields exist in the YAML data
   - Use the test suite to validate field extraction

3. **Performance Issues**
   - Adjust `maxDepth` in processing options for very deep structures
   - Use custom processors to filter unnecessary data

### Debug Mode

Enable detailed logging by setting:
```javascript
console.log('[YamlDataProcessor] Processing:', data);
```

## Future Enhancements

1. **Schema Validation**: Add YAML schema validation
2. **Advanced Templates**: Support conditional template logic
3. **Performance Optimization**: Implement caching for repeated processing
4. **UI Integration**: Add visual template builder