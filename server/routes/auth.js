import express from 'express';
import rateLimit from 'express-rate-limit';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db.js';
import { requireAuth, generateToken } from '../middleware/auth.js';
import { logSecurityEvent } from '../utils/logger.js';

const router = express.Router();

// Strict Auth Rate Limiter (20 login requests / 15 minutes)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many authentication attempts. Please try again later.' },
  handler: (req, res, next, options) => {
    logSecurityEvent({
      type: 'auth_rate_limit',
      ip: req.ip,
      endpoint: req.originalUrl,
      details: 'Auth rate limit exceeded',
    });
    res.status(429).json(options.message);
  }
});

// Google Sign-In Endpoint
router.post('/google', authLimiter, async (req, res) => {

  try {
    const { googleId, email, name, picture, credential } = req.body;

    let userEmail = email;
    let userName = name;
    let userPicture = picture;
    let userIdGoogle = googleId;

    if (credential) {
      try {
        const payloadBase64 = credential.split('.')[1];
        const decoded = JSON.parse(Buffer.from(payloadBase64, 'base64').toString('utf8'));
        userEmail = decoded.email || userEmail;
        userName = decoded.name || userName;
        userPicture = decoded.picture || userPicture;
        userIdGoogle = decoded.sub || userIdGoogle;
      } catch (e) {
        console.warn('Failed to parse Google credential token:', e.message);
      }
    }

    if (!userEmail) {
      return res.status(400).json({ error: 'Google email address is required.' });
    }

    const cleanEmail = userEmail.trim().toLowerCase();
    const isSpecialAdmin = cleanEmail === 'samethxu@gmail.com' || cleanEmail === 'korb.sameth@gmail.com';
    let user = db.findUserByEmail(cleanEmail);

    if (user) {
      user = db.updateUser(user.id, {
        name: userName || user.name,
        googleId: userIdGoogle || user.googleId,
        picture: userPicture || user.picture,
        ...(isSpecialAdmin ? { role: 'admin', isAdmin: true } : {}),
        lastLoginAt: new Date().toISOString(),
      });
    } else {
      const newUser = {
        id: uuidv4(),
        googleId: userIdGoogle || `g_${Date.now()}`,
        name: userName ? userName.trim() : cleanEmail.split('@')[0],
        username: cleanEmail.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '') || `user_${Date.now()}`,
        email: cleanEmail,
        picture: userPicture || null,
        role: isSpecialAdmin ? 'admin' : 'user',
        isAdmin: isSpecialAdmin,
        authProvider: 'google',
        createdAt: new Date().toISOString(),
        lastLoginAt: new Date().toISOString(),
      };

      user = db.createUser(newUser);
    }

    const token = generateToken(user.id);
    const { passwordHash: _, ...safeUser } = user;

    return res.json({
      message: 'Signed in with Google successfully!',
      user: safeUser,
      token,
    });
  } catch (err) {
    console.error('Google auth error:', err);
    return res.status(500).json({ error: 'Failed to authenticate with Google.' });
  }
});

// Admin Password Login (for samethxu@gmail.com)
router.post('/admin-login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    
    // Check credentials for admin
    const isValidAdmin = (cleanEmail === 'samethxu@gmail.com' || cleanEmail === 'korb.sameth@gmail.com') && password === 'Sa12252005@';

    if (!isValidAdmin) {
      return res.status(401).json({ error: 'Invalid admin email or password.' });
    }

    let user = db.findUserByEmail(cleanEmail);
    if (!user) {
      const newUser = {
        id: uuidv4(),
        googleId: `admin_${Date.now()}`,
        name: cleanEmail === 'samethxu@gmail.com' ? 'Sameth Admin' : 'Korb Sameth',
        username: cleanEmail.split('@')[0],
        email: cleanEmail,
        role: 'admin',
        isAdmin: true,
        authProvider: 'password',
        createdAt: new Date().toISOString(),
        lastLoginAt: new Date().toISOString(),
      };
      user = db.createUser(newUser);
    } else {
      user = db.updateUser(user.id, {
        role: 'admin',
        isAdmin: true,
        lastLoginAt: new Date().toISOString(),
      });
    }

    const token = generateToken(user.id);
    const { passwordHash: _, ...safeUser } = user;

    return res.json({
      message: 'Admin signed in successfully!',
      user: safeUser,
      token,
    });
  } catch (err) {
    console.error('Admin login error:', err);
    return res.status(500).json({ error: 'Failed to sign in as admin.' });
  }
});

// Current User Profile
router.get('/me', requireAuth, (req, res) => {
  return res.json({ user: req.user });
});

export default router;
