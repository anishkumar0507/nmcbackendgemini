// Utility for extracting text from PDF and DOCX
import pdfParseModule from 'pdf-parse';
const pdfParse = pdfParseModule.default || pdfParseModule;
import mammoth from 'mammoth';

/**
 * Extract text from PDF buffer
 * @param {Buffer} buffer
 * @returns {Promise<string>} Extracted text
 */

export async function extractPdfText(buffer) {
  try {
    const data = await pdfParse(buffer);
    return {
      error: false,
      text: (data.text || '').trim(),
      message: 'PDF parsed successfully'
    };
  } catch (err) {
    return {
      error: true,
      text: '',
      message: 'PDF parsing failed'
    };
  }
}

/**
 * Extract text from DOCX buffer
 * @param {Buffer} buffer
 * @returns {Promise<string>} Extracted text
 */

export async function extractDocxText(buffer) {
  try {
    const result = await mammoth.extractRawText({ buffer });
    return {
      error: false,
      text: (result.value || '').trim(),
      message: 'DOCX parsed successfully'
    };
  } catch (err) {
    return {
      error: true,
      text: '',
      message: 'DOCX parsing failed'
    };
  }
}
