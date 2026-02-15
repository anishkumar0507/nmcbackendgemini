import express from 'express';
import { scrapeBlogContent } from '../services/scrapeBlogContent.js';
import { youtubeAuditPipeline, isYouTubeUrl } from '../utils/youtubeAuditPipeline.js';

const router = express.Router();

// POST /api/analyze
router.post('/', async (req, res) => {
  try {
    console.log('Analyze Request Body:', req.body);
    console.log('Authorization:', req.headers.authorization);

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: 'GEMINI_API_KEY is missing in environment variables.' });
    }

    const { url, ...rest } = req.body;
    if (url && isYouTubeUrl(url)) {
      // YouTube pipeline
      const result = await youtubeAuditPipeline(url);
      if (result.error) {
        return res.status(400).json(result);
      }
      return res.json({
        ok: true,
        message: 'YouTube audio audit completed.',
        ...result
      });
    }

    let extracted = null;
    if (url) {
      extracted = await scrapeBlogContent(url);
      if (extracted && extracted.error) {
        return res.status(400).json({ error: extracted.message });
      }
    }
    res.json({
      ok: true,
      message: url ? 'Blog content scraped and ready for analysis.' : 'Analyze endpoint working.',
      ...(extracted ? { title: extracted.title, content: extracted.content } : {})
    });
  } catch (error) {
    console.error('Analyze API Error:', error);
    console.error('Stack:', error.stack);
    return res.status(500).json({
      message: 'Internal server error',
      error: error.message
    });
  }
});

export default router;
