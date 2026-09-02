import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { db } from '../db.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { getRecentSecurityLogs, getSecurityStats } from '../utils/logger.js';
import { safeResolveUploadPath } from '../utils/security.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const isVercel = Boolean(process.env.VERCEL);
const uploadsDir = isVercel ? '/tmp/uploads' : path.join(__dirname, '..', 'uploads');

const router = express.Router();

// Apply auth & admin check to all admin routes
router.use(requireAuth, requireAdmin);

// 1. Get Platform Summary Stats
router.get('/stats', (req, res) => {
  try {
    const stats = db.getAdminStats();
    return res.json({ stats });
  } catch (err) {
    console.error('Admin stats error:', err);
    return res.status(500).json({ error: 'Failed to retrieve admin stats.' });
  }
});

// 2. Get All Users with Activity Stats
router.get('/users', (req, res) => {
  try {
    const users = db.getUsersWithStats();
    return res.json({ users });
  } catch (err) {
    console.error('Admin users error:', err);
    return res.status(500).json({ error: 'Failed to retrieve user list.' });
  }
});

// 3. Toggle or Set User Restriction (Ban/Suspend)
router.post('/users/:userId/restrict', (req, res) => {
  try {
    const { userId } = req.params;
    const { isRestricted } = req.body;

    const targetUser = db.findUserById(userId);
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found.' });
    }

    // Prevent restricting the founder account
    if ((targetUser.email || '').toLowerCase() === 'korb.sameth@gmail.com') {
      return res.status(400).json({ error: 'Cannot restrict the primary admin / founder account.' });
    }

    const updatedUser = db.toggleUserRestriction(userId, isRestricted);
    return res.json({
      message: updatedUser.isRestricted ? 'User account has been restricted.' : 'User account restriction removed.',
      user: updatedUser,
    });
  } catch (err) {
    console.error('Admin restrict error:', err);
    return res.status(500).json({ error: 'Failed to update user restriction.' });
  }
});

// 4. Delete User Account
router.delete('/users/:userId', (req, res) => {
  try {
    const { userId } = req.params;
    const targetUser = db.findUserById(userId);
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found.' });
    }

    if ((targetUser.email || '').toLowerCase() === 'korb.sameth@gmail.com') {
      return res.status(400).json({ error: 'Cannot delete the primary admin / founder account.' });
    }

    // Delete user's shares and files
    const userShares = db.findSharesByUserId(userId);
    for (const share of userShares) {
      for (const file of share.files || []) {
        try {
          const filePath = safeResolveUploadPath(uploadsDir, file.filename);
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
        } catch (e) {}
      }
      db.deleteShare(share.code);
    }

    db.deleteUser(userId);
    return res.json({ message: 'User and all associated data deleted successfully.' });
  } catch (err) {
    console.error('Admin delete user error:', err);
    return res.status(500).json({ error: 'Failed to delete user.' });
  }
});

// 5. Get All Live Shares for Monitoring
router.get('/shares', (req, res) => {
  try {
    const shares = db.getShares();
    return res.json({ shares });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to retrieve transfers.' });
  }
});

// 6. Delete Any Share (Content Moderation)
router.delete('/shares/:code', (req, res) => {
  try {
    const { code } = req.params;
    const share = db.findShareByCode(code);
    if (!share) {
      return res.status(404).json({ error: 'Transfer not found.' });
    }

    for (const file of share.files || []) {
      try {
        const filePath = safeResolveUploadPath(uploadsDir, file.filename);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch (e) {}
    }

    db.deleteShare(code);
    return res.json({ message: 'Transfer deleted by admin.' });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to delete transfer.' });
  }
});

// 7. Get Recent Security Logs & Incidents (Monitoring)
router.get('/security-logs', (req, res) => {
  try {
    const logs = getRecentSecurityLogs(50);
    const stats = getSecurityStats();
    return res.json({ logs, stats });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to retrieve security logs.' });
  }
});

export default router;
