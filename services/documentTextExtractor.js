
import mammoth from 'mammoth';

/**
 * Extract text from PDF or DOCX buffer (ESM compatible, Node 22)
 * @param {Buffer} fileBuffer
 * @param {string} mimeType
 * @returns {Promise<{error: boolean, text: string, message: string}>}
 */
export async function extractDocumentText(fileBuffer, mimeType) {
  try {
    if (mimeType && mimeType.includes('wordprocessingml')) {
      // DOCX
      const result = await mammoth.extractRawText({ buffer: fileBuffer });
      return {
        error: false,
        text: (result.value || '').trim(),
        message: 'DOCX parsed successfully'
      };
    }
    if (mimeType && mimeType.includes('pdf')) {
      // PDF (dynamic import for ESM compatibility)
      let pdfParse;
      try {
        const module = await import('pdf-parse');
        pdfParse = module.default || module;
      } catch (err) {
        return {
          error: true,
          text: '',
          message: 'Failed to load pdf-parse module'
        };
      }
      try {
        const data = await pdfParse(fileBuffer);
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
    return {
      error: true,
      text: '',
      message: 'Unsupported document type'
    };
  } catch (err) {
    return {
      error: true,
      text: '',
      message: 'Document extraction failed'
    };
  }
}
