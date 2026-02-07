import jwt from 'jsonwebtoken';

const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET || 'dev-secret-change-me';
  return secret;
};

export const authMiddleware = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || '';
    if (!authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, error: 'Authorization header missing or invalid' });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, getJwtSecret());

    req.user = { id: decoded.id, email: decoded.email };
    return next();
  } catch (error) {
    console.error('[AuthMiddleware] JWT error:', error.message);
    return res.status(401).json({ success: false, error: 'Invalid or expired token' });
  }
};

export default { authMiddleware };

