/**
 * @module CSVHandler
 * @description A robust, full-fledged, and configurable CSV parsing and stringifying module.
 * It handles headers, custom delimiters, quoted fields, newlines within fields,
 * and dynamic type conversion.
 *
 * @example
 * import { parse, stringify } from './csv.mjs';
 *
 * // --- Parsing Example ---
 * const csvData = `id,name,email\n1,"John Doe",john.doe@example.com\n2,"Jane ""The "" Smith",jane.smith@example.com`;
 * const jsonData = parse(csvData, { header: true, dynamicTyping: true });
 * console.log(jsonData);
 * // Output:
 * // [
 * //   { id: 1, name: 'John Doe', email: 'john.doe@example.com' },
 * //   { id: 2, name: 'Jane "The " Smith', email: 'jane.smith@example.com' }
 * // ]
 *
 * // --- Stringifying Example ---
 * const dataToConvert = [
 *   { id: 1, description: "Item with a comma, and a quote \"", price: 10.50 },
 *   { id: 2, description: "Another item\nwith a newline", price: 20.00 }
 * ];
 * const csvString = stringify(dataToConvert);
 * console.log(csvString);
 * // Output:
 * // id,description,price
 * // 1,"Item with a comma, and a quote """,10.5
 * // 2,"Another item
 * // with a newline",20
 */

const DEFAULT_PARSE_CONFIG = {
  delimiter: ',',
  newline: '\n', // The character to signify a new row
  quoteChar: '"',
  header: false, // Treat the first row as headers to create objects
  dynamicTyping: false, // Automatically convert numbers, booleans, and null
  skipEmptyLines: true, // Skip empty lines in the CSV
  strict: false, // Throw an error if a row has a different number of fields than the header
};

const DEFAULT_STRINGIFY_CONFIG = {
  delimiter: ',',
  newline: '\n',
  quoteChar: '"',
  header: true, // Include a header row from object keys
  columns: null, // Optional array of strings to specify order and columns
};

/**
 * Parses a CSV string into an array of objects or an array of arrays.
 * This parser correctly handles quoted fields, escaped quotes, and newlines within quotes.
 *
 * @param {string} csvString The CSV string to parse.
 * @param {object} [options={}] Configuration options for parsing.
 * @param {string} [options.delimiter=','] The character used to separate fields.
 * @param {string} [options.newline='\n'] The character sequence representing a new line.
 * @param {string} [options.quoteChar='"'] The character used to quote fields.
 * @param {boolean} [options.header=false] If true, the first row is treated as headers, and an array of objects is returned.
 * @param {boolean} [options.dynamicTyping=false] If true, attempts to convert numeric and boolean strings to their native types.
 * @param {boolean} [options.skipEmptyLines=true] If true, empty lines in the input string are ignored.
 * @param {boolean} [options.strict=false] If true and `header` is true, throws an error if a row has a different number of columns than the header.
 * @returns {Array<Object>|Array<Array<string|number|boolean|null>>} The parsed data.
 */
export function parse(csvString, options = {}) {
  if (typeof csvString !== 'string') {
    throw new Error('Input must be a string.');
  }

  const config = { ...DEFAULT_PARSE_CONFIG, ...options };
  const { delimiter, quoteChar, newline, skipEmptyLines } = config;

  const result = [];
  let currentRow = [];
  let currentField = '';
  let inQuotedField = false;

  // Normalize line endings to a single character for easier parsing
  const normalizedCsv = csvString.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  for (let i = 0; i < normalizedCsv.length; i++) {
    const char = normalizedCsv[i];
    const nextChar = normalizedCsv[i + 1];

    if (inQuotedField) {
      if (char === quoteChar && nextChar === quoteChar) {
        // This is an escaped quote
        currentField += quoteChar;
        i++; // Skip the next quote
      } else if (char === quoteChar) {
        // End of quoted field
        inQuotedField = false;
      } else {
        currentField += char;
      }
    } else {
      if (char === quoteChar) {
        // Start of a quoted field
        inQuotedField = true;
      } else if (char === delimiter) {
        // End of a field
        currentRow.push(_inferType(currentField, config));
        currentField = '';
      } else if (char === newline) {
        // End of a row
        currentRow.push(_inferType(currentField, config));
        currentField = '';
        
        if (!skipEmptyLines || currentRow.length > 1 || currentRow[0] !== '') {
           result.push(currentRow);
        }
        currentRow = [];

      } else {
        currentField += char;
      }
    }
  }

  // Add the last field and row if the file doesn't end with a newline
  if (currentField || currentRow.length > 0) {
    currentRow.push(_inferType(currentField, config));
    result.push(currentRow);
  }

  if (config.header && result.length > 0) {
    return _convertToObjects(result, config);
  }

  return result;
}

/**
 * Converts an array of JavaScript objects or arrays into a CSV string.
 *
 * @param {Array<Object>|Array<Array>} data The data to stringify.
 * @param {object} [options={}] Configuration options for stringifying.
 * @param {string} [options.delimiter=','] The character to use for separating fields.
 * @param {string} [options.newline='\n'] The character sequence to use for new lines.
 * @param {string} [options.quoteChar='"'] The character to use for quoting fields.
 * @param {boolean} [options.header=true] If true and data is an array of objects, a header row is added.
 * @param {string[]} [options.columns=null] An array of strings to force specific column order. If not provided, keys from the first object are used.
 * @returns {string} The resulting CSV string.
 */
export function stringify(data, options = {}) {
  if (!Array.isArray(data)) {
    throw new Error('Input must be an array.');
  }
  if (data.length === 0) {
    return '';
  }

  const config = { ...DEFAULT_STRINGIFY_CONFIG, ...options };
  const { delimiter, newline } = config;

  const isObjectArray = typeof data[0] === 'object' && data[0] !== null && !Array.isArray(data[0]);
  let headers = config.columns;

  if (isObjectArray && !headers) {
    headers = Object.keys(data[0]);
  }

  let csv = '';

  // Add header row
  if (config.header && headers) {
    csv += headers.map(h => _formatCell(h, config)).join(delimiter) + newline;
  }

  // Add data rows
  for (const row of data) {
    let rowValues;
    if (isObjectArray) {
      rowValues = headers.map(header => (row[header] !== undefined && row[header] !== null) ? row[header] : '');
    } else {
      rowValues = Array.isArray(row) ? row : [row];
    }
    csv += rowValues.map(value => _formatCell(value, config)).join(delimiter) + newline;
  }

  return csv;
}

/**
 * @private
 * Helper function to infer data types if dynamicTyping is enabled.
 * @param {string} value The string value from the CSV cell.
 * @param {object} config The parse configuration object.
 * @returns {string|number|boolean|null} The potentially converted value.
 */
function _inferType(value, config) {
  if (!config.dynamicTyping) {
    return value;
  }
  if (value === '') return null; // Empty string should become null when dynamicTyping is true
  if (value.toLowerCase() === 'true') return true;
  if (value.toLowerCase() === 'false') return false;
  if (value.toLowerCase() === 'null') return null;
  
  // Check if it's a valid number (integer or float)
  if (!isNaN(value) && isFinite(value) && value.trim() !== '') {
    return Number(value);
  }
  
  return value;
}

/**
 * @private
 * Helper function to convert an array of arrays to an array of objects.
 * @param {Array<Array>} dataRows The data rows, with the first row being the header.
 * @param {object} config The parse configuration object.
 * @returns {Array<Object>} The data as an array of objects.
 */
function _convertToObjects(dataRows, config) {
  const headers = dataRows.shift();
  const objectArray = [];

  for (const row of dataRows) {
    if (config.strict && row.length !== headers.length) {
      throw new Error(`Row with ${row.length} fields does not match header with ${headers.length} fields.`);
    }

    const obj = {};
    for (let i = 0; i < headers.length; i++) {
        const key = headers[i] === '' ? '' : (headers[i] || `column_${i+1}`);
        obj[key] = row[i] !== undefined ? row[i] : '';
    }
    objectArray.push(obj);
  }
  return objectArray;
}

/**
 * @private
 * Helper function to format a single cell for CSV output, quoting if necessary.
 * @param {*} value The value of the cell.
 * @param {object} config The stringify configuration object.
 * @returns {string} The formatted and possibly quoted cell value.
 */
function _formatCell(value, config) {
  if (value === null || value === undefined) {
    return '';
  }

  const strValue = String(value);
  const { delimiter, quoteChar, newline } = config;

  const needsQuotes = strValue.includes(delimiter) ||
                      strValue.includes(quoteChar) ||
                      strValue.includes(newline) ||
                      strValue.includes('\r');

  if (needsQuotes) {
    const escapedValue = strValue.replace(new RegExp(quoteChar, 'g'), quoteChar + quoteChar);
    return `${quoteChar}${escapedValue}${quoteChar}`;
  }

  return strValue;
}