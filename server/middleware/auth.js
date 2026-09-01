import jwt from 'jsonwebtoken';
import { db } from '../db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'qr-share-secret-key-super-secure-2026';

export function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required. Please log in.' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = db.findUserById(decoded.userId);
    if (!user) {
      return res.status(401).json({ error: 'User no longer exists.' });
    }

    if (user.isRestricted) {
      return res.status(403).json({
        error: 'Access Denied: Your account has been restricted by the administrator.',
        isRestricted: true,
      });
    }

    const { passwordHash, ...safeUser } = user;
    req.user = safeUser;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }
}

export function requireAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required.' });
  }

  const email = (req.user.email || '').toLowerCase();
  const isAdmin = req.user.role === 'admin' || req.user.isAdmin === true || email === 'samethxu@gmail.com' || email === 'korb.sameth@gmail.com';

  if (!isAdmin) {
    return res.status(403).json({ error: 'Access Denied: Administrator privileges required.' });
  }

  next();
}

export function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      const user = db.findUserById(decoded.userId);
      if (user) {
        const { passwordHash, ...safeUser } = user;
        req.user = safeUser;
      }
    } catch (err) {
      // ignore invalid optional token
    }
  }
  next();
}

export function generateToken(userId) {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' });
}
