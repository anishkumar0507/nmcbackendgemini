// Utility for extracting text from PDF and DOCX

let pdfParse;
async function loadPdfParse() {
  if (!pdfParse) {
    const module = await import('pdf-parse');
    pdfParse = module.default || module;
  }
  return pdfParse;
}
import mammoth from 'mammoth';

/**
 * Extract text from PDF buffer
 * @param {Buffer} buffer
 * @returns {Promise<string>} Extracted text
 */

export async function extractPdfText(buffer) {
  try {
    const pdfParser = await loadPdfParse();
    const data = await pdfParser(buffer);
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
