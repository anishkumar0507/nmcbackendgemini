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

    // Run Gemini audit
    const geminiResponse = await processContent(input, {
      userId: req.user.id,
      category,
      analysisMode
    });

    // SAFE handling for Gemini response
    if (!geminiResponse) {
      console.error('Gemini returned empty response');
      return res.status(400).json({
        success: false,
        error: 'Gemini returned empty response'
      });
    }

    let safeGeminiResult;
    if (typeof geminiResponse === 'object') {
      safeGeminiResult = geminiResponse;
    } else if (typeof geminiResponse === 'string') {
      try {
        safeGeminiResult = JSON.parse(geminiResponse);
      } catch {
        safeGeminiResult = { data: geminiResponse };
      }
    } else {
      return res.status(400).json({
        success: false,
        error: 'Unexpected Gemini response format'
      });
    }

    // Derive required fields BEFORE saving
    const contentType = req.body.contentType || (req.body.url ? 'url' : req.body.text ? 'text' : null);
    const originalInput = req.body.url || req.body.text || null;

    // Strict validation BEFORE save
    if (!contentType || !originalInput || !safeGeminiResult) {
      console.error('AuditRecord NOT saved - Missing required fields', {
        contentType,
        originalInput,
        safeGeminiResult
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
      auditResult: safeGeminiResult,
      createdAt: new Date()
    });
    console.log('AuditRecord saved successfully:', savedRecord._id);

    return res.json(safeGeminiResult);
  } catch (error) {
    console.error('Error in analyzeCompatibility:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
};
