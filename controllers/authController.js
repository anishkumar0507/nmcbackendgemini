import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';

const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET || 'dev-secret-change-me';
  return secret;
};

const createToken = (user) => {
  const payload = { id: user._id, email: user.email };
  return jwt.sign(payload, getJwtSecret(), { expiresIn: '7d' });
};

export const signup = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    console.log('[Auth] Signup request received:', { email, name });

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, and password are required.'
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters long.'
      });
    }

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'An account with this email already exists.'
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await User.create({
      name,
      email: email.toLowerCase(),
      passwordHash
    });

    const token = createToken(user);

    console.log('[Auth] Signup successful', { userId: user._id, email: user.email });

    return res.status(201).json({
      success: true,
      message: 'Signup successful',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email
      }
    });
  } catch (error) {
    console.error('[Auth] Signup error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }
    const match = await user.comparePassword(password);
    if (!match) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }
    // Use process.env.JWT_SECRET for signing
    const payload = { id: user._id, email: user.email };
    const token = require('jsonwebtoken').sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' });
    return res.json({ token });
  } catch (error) {
    console.error('[Auth] Login error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

