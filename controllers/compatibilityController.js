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

    // STRICT: Explicitly derive required fields
    const detectedType = input.url ? 'url' : (input.text ? 'text' : null);
    const contentType = detectedType || req.body.contentType || (req.body.url ? 'url' : req.body.text ? 'text' : null);
    const originalInput = req.body.url || req.body.text || req.body.input || null;
    const safeGeminiResult = geminiResponse && typeof geminiResponse === 'object' ? geminiResponse : null;
    const auditResult = safeGeminiResult || geminiResponse || null;

    // HARD validation BEFORE save
    if (!contentType || !originalInput || !auditResult) {
      console.error('AuditRecord NOT saved - Missing required fields', {
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
    const savedRecord = await AuditRecord.create({
      user: req.user?._id || null,
      contentType,
      originalInput,
      auditResult,
      createdAt: new Date()
    });
    console.log('AuditRecord saved successfully:', savedRecord._id);

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
