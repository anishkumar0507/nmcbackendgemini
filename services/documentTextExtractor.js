// Utility for extracting text from PDF and DOCX
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';

/**
 * Extract text from PDF buffer
 * @param {Buffer} buffer
 * @returns {Promise<string>} Extracted text
 */
export async function extractPdfText(buffer) {
  try {
    const data = await pdfParse(buffer);
    return (data.text || '').trim();
  } catch (err) {
    return '';
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
    return (result.value || '').trim();
  } catch (err) {
    return '';
  }
}
