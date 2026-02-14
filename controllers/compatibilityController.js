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
