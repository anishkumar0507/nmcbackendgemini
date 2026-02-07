/**
 * Input validation utilities
 */

/**
 * Validate URL format
 * @param {string} url - URL to validate
 * @returns {boolean}
 */
export const isValidUrl = (url) => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

/**
 * Validate text content
 * @param {string} text - Text to validate
 * @param {number} maxLength - Maximum length
 * @returns {boolean}
 */
export const isValidText = (text, maxLength = 100000) => {
  return typeof text === 'string' && text.trim().length > 0 && text.length <= maxLength;
};

/**
 * Validate file
 * @param {object} file - File object
 * @returns {boolean}
 */
export const isValidFile = (file) => {
  return file && file.buffer && Buffer.isBuffer(file.buffer) && file.mimetype;
};

export default {
  isValidUrl,
  isValidText,
  isValidFile
};
