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
        success: false,
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

    // Run audit
    const geminiResponse = await processContent(input, {
      userId: req.user.id,
      category,
      analysisMode
    });

    // Explicitly define required fields
    const detectedType = input.url ? 'url' : (input.text ? 'text' : (file ? file.mimetype?.split('/')[0] : undefined));
    const contentType = detectedType || 'unknown';
    const url = input.url;
    const text = input.text;
    const originalInput = url || text || req.body.input || (file ? file.originalname : null);
    const safeGeminiResult = geminiResponse && typeof geminiResponse === 'object' ? geminiResponse : null;
    const auditResult = safeGeminiResult || geminiResponse || null;

    // Defensive validation BEFORE save
    if (!contentType || !originalInput || !auditResult) {
      console.error('Missing required fields for AuditRecord save', {
        contentType,
        originalInput,
        auditResult
      });
      return res.status(400).json({
        success: false,
        error: 'Missing required audit data'
      });
    }

    // Lazy import to avoid circular deps
    const AuditRecord = (await import('../models/AuditRecord.js')).default;
    await AuditRecord.create({
      user: req.user?._id || null,
      contentType,
      originalInput,
      auditResult,
      createdAt: new Date()
    });
    console.log('AuditRecord saved successfully');

    return res.json(auditResult);
  } catch (error) {
    console.error('Error in analyzeCompatibility:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error.message
    });
  }
};
