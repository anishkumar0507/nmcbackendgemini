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

    // If URL is provided, scrape readable content using Mozilla Readability
    if (req.body.url) {
      try {
        const { scrapeBlogContent } = await import('../utils/scrapeBlogContent.js');
        const scrapeResult = await scrapeBlogContent(req.body.url);
        if (scrapeResult.error) {
          return res.status(400).json({ success: false, error: scrapeResult.message });
        }
        return res.json({
          success: true,
          title: scrapeResult.title,
          content: scrapeResult.content
        });
      } catch (err) {
        console.error('Scraping failed:', err);
        return res.status(500).json({ success: false, error: 'Scraping failed', details: err.message });
      }
    }

    // ...existing Gemini audit logic for non-URL cases...
    const geminiResponse = await processContent(input, {
      userId: req.user.id,
      category,
      analysisMode
    });

    if (!geminiResponse) {
      console.error('Gemini returned empty response');
      return res.status(400).json({ success: false, error: 'Gemini returned empty response' });
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
      return res.status(400).json({ success: false, error: 'Unexpected Gemini response format' });
    }

    const contentType = req.body.contentType || (req.body.url ? 'url' : req.body.text ? 'text' : null);
    const originalInput = req.body.url || req.body.text || null;

    if (!contentType || !originalInput || !safeGeminiResult) {
      console.error('AuditRecord NOT saved - Missing required fields', {
        contentType,
        originalInput,
        safeGeminiResult
      });
      return res.status(400).json({ success: false, error: 'Missing required audit data' });
    }

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
