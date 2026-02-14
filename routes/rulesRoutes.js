import express from 'express';

const router = express.Router();

// GET /api/rules/metadata
router.get('/metadata', async (req, res) => {
  try {
    // TODO: Replace with actual rules metadata logic
    res.json({ ok: true, data: { countries: [] } });
  } catch (error) {
    console.error('[Rules] Metadata error:', error);
    res.status(500).json({ ok: false, error: error.message || 'Failed to load rules metadata' });
  }
});

export default router;
