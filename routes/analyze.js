import express from 'express';
import { scrapeBlogContent } from '../utils/scrapeBlogContent.js';

const router = express.Router();

// POST /api/analyze
router.post('/', async (req, res) => {
  try {
    // Example: If GEMINI_API_KEY is required
    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: 'GEMINI_API_KEY is missing in environment variables.' });
    }

    const { url, ...rest } = req.body;
    let extracted = null;
    if (url) {
      try {
        extracted = await scrapeBlogContent(url);
      } catch (scrapeErr) {
        return res.status(400).json({ error: scrapeErr.message || 'Failed to scrape blog content' });
      }
    }

    // TODO: Pass extracted.content to compliance/analysis logic if needed
    // For now, just return the extracted content (no HTML)
    res.json({
      ok: true,
      message: url ? 'Blog content scraped and ready for analysis.' : 'Analyze endpoint working.',
      ...(extracted ? { title: extracted.title, content: extracted.content } : {})
    });
  } catch (error) {
    console.error('[Analyze] Error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

export default router;
