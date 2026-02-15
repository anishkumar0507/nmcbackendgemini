import { processContent } from '../services/contentProcessor.js';

/**
 * Compatibility endpoint for /api/analyze
 * POST /api/analyze
 */
export const analyzeCompatibility = async (req, res) => {
  try {
    const { content, inputType, category, analysisMode } = req.body;
    const file = req.file;

    // Validate input
    if (!content && !file) {
      return res.status(400).json({
        ok: false,
        error: 'Content or file is required'
      });
    }

    // Prepare input object
    const input = {};
    if (content) {
      if (inputType === 'URL') {
        input.url = content;
      } else {
        input.text = content;
      }
    }
    if (file) {
      input.file = file;
    }

    const auditResult = await processContent(input, {
      userId: req.user.id,
      category,
      analysisMode
    });

    // Defensive: ensure required fields for AuditRecord
    const contentType = input.url ? 'url' : (input.text ? 'text' : (file ? file.mimetype?.split('/')[0] : undefined));
    const originalInput = input.url || input.text || (file ? file.originalname : undefined);

    if (!contentType || !originalInput || !auditResult) {
      return res.status(400).json({
        ok: false,
        error: 'Missing required fields for audit record',
        details: { contentType, originalInput, auditResult }
      });
    }

    // Lazy import to avoid circular deps
    const AuditRecord = (await import('../models/AuditRecord.js')).default;
    const record = new AuditRecord({
      userId: req.user.id,
      contentType,
      originalInput,
      extractedText: '',
      transcript: '',
      auditResult
    });
    await record.save();
    console.log('[AuditRecord] Saved successfully:', record._id);

    return res.json(auditResult);
  } catch (error) {
    console.error('Error in analyzeCompatibility:', error);
    return res.status(500).json({
      ok: false,
      error: 'Internal server error',
      details: error.message
    });
  }
};
