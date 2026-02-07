import express from 'express';
import { signup, login } from '../controllers/authController.js';

const router = express.Router();

console.log('[AuthRoutes] Initializing auth routes...');
console.log('[AuthRoutes] signup function:', signup ? '✅' : '❌');
console.log('[AuthRoutes] login function:', login ? '✅' : '❌');

// Health check for auth service
router.get('/health', (req, res) => {
  console.log('[AuthRoutes] GET /health called');
  res.json({ status: 'ok', service: 'auth' });
});

router.post('/signup', async (req, res, next) => {
  console.log('[AuthRoutes] POST /signup called');
  try {
    await signup(req, res, next);
  } catch (error) {
    console.error('[AuthRoutes] Unhandled signup error:', error);
    if (!res.headersSent) {
      return res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }
});

router.post('/login', async (req, res, next) => {
  console.log('[AuthRoutes] POST /login called');
  try {
    await login(req, res, next);
  } catch (error) {
    console.error('[AuthRoutes] Unhandled login error:', error);
    if (!res.headersSent) {
      return res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }
});

console.log('[AuthRoutes] Routes registered:');
console.log('  - GET  /health');
console.log('  - POST /signup');
console.log('  - POST /login');

export default router;

