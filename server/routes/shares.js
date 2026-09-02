import express from 'express';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import QRCode from 'qrcode';
import archiver from 'archiver';
import AdmZip from 'adm-zip';
import bcrypt from 'bcryptjs';
import { db } from '../db.js';
import { optionalAuth, requireAuth } from '../middleware/auth.js';
import { getLocalIpAddress } from '../utils/network.js';
import {
  isRestrictedExtension,
  sanitizeFilename,
  safeResolveUploadPath,
  inspectFileHeader,
  generateSecretToken,
  generateDownloadToken,
  verifyDownloadToken,
  getSafeMimeType,
} from '../utils/security.js';

import { logSecurityEvent } from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isVercel = Boolean(process.env.VERCEL);
const uploadsDir = isVercel ? '/tmp/uploads' : path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Rate Limiter for uploading shares (30 uploads / 15 mins)
const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Upload limit reached. Please wait before uploading more files.' },
  handler: (req, res, next, options) => {
    logSecurityEvent({
      type: 'rate_limit',
      ip: req.ip,
      endpoint: req.originalUrl,
      details: 'Upload rate limit exceeded',
    });
    res.status(429).json(options.message);
  }
});

// Rate Limiter for code lookups & password verification (prevents brute-force)
const codeLookupLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many lookup attempts. Please wait a moment.' },
});

/**
 * Helper to cleanup uploaded disk files if validation fails
 */
function cleanupFiles(files) {
  if (!files || !Array.isArray(files)) return;
  for (const file of files) {
    try {
      const filePath = safeResolveUploadPath(uploadsDir, file.filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch {
      // Ignore cleanup error
    }
  }
}

// Configure multer storage with sanitized names and limits
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const rawExt = path.extname(file.originalname).toLowerCase();
    const safeExt = /^[a-zA-Z0-9_\.]+$/.test(rawExt) ? rawExt : '.bin';
    const uniqueName = `${Date.now()}-${uuidv4().substring(0, 8)}${safeExt}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB per file
    files: 50, // max 50 files per upload batch
    fieldSize: 10 * 1024 * 1024, // 10MB text fields
  },
});

const router = express.Router();

// Helper to generate readable 6-character code
function generateTransferCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Upload photos / files and create share QR (Requires Google Login)
router.post('/upload', requireAuth, uploadLimiter, upload.array('files', 50), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'Please select at least one file or photo to upload.' });
    }

    // 1. Validate all direct uploaded file extensions & inspect binary magic bytes
    for (const file of req.files) {
      const rawName = Buffer.from(file.originalname, 'latin1').toString('utf8');
      const cleanOriginalName = sanitizeFilename(rawName);

      if (isRestrictedExtension(cleanOriginalName)) {
        cleanupFiles(req.files);
        logSecurityEvent({
          type: 'malware_blocked',
          ip: req.ip,
          endpoint: '/api/shares/upload',
          details: `Blocked restricted extension: ${cleanOriginalName}`,
        });
        return res.status(400).json({
          error: `Security Alert: File "${cleanOriginalName}" is prohibited for security reasons.`
        });
      }

      const filePath = safeResolveUploadPath(uploadsDir, file.filename);

      // Deep binary header inspection for executable signatures and malicious scripts
      const headerCheck = inspectFileHeader(filePath, cleanOriginalName);
      if (!headerCheck.isSafe) {
        cleanupFiles(req.files);
        logSecurityEvent({
          type: 'malware_blocked',
          ip: req.ip,
          endpoint: '/api/shares/upload',
          details: `Binary inspection failed: ${headerCheck.reason} for file ${cleanOriginalName}`,
        });
        return res.status(400).json({
          error: `Security Alert: ${headerCheck.reason}. Upload rejected.`
        });
      }

      // 2. If it is a ZIP archive, inspect its contents entry-by-entry
      if (cleanOriginalName.toLowerCase().endsWith('.zip')) {
        try {
          const zip = new AdmZip(filePath);
          const zipEntries = zip.getEntries();
          for (const entry of zipEntries) {
            if (entry.isDirectory) continue;
            if (isRestrictedExtension(entry.entryName)) {
              cleanupFiles(req.files);
              logSecurityEvent({
                type: 'malware_blocked',
                ip: req.ip,
                endpoint: '/api/shares/upload',
                details: `Blocked archive containing: ${entry.entryName}`,
              });
              return res.status(400).json({
                error: `Security Alert: ZIP archive "${cleanOriginalName}" contains a prohibited file "${entry.entryName}". Upload rejected.`
              });
            }
          }
        } catch (zipErr) {
          console.warn('Could not inspect zip file:', cleanOriginalName, zipErr.message);
        }
      }
    }


    const { title, note, expiryHours, password, folderName } = req.body;

    let code = generateTransferCode();
    // Ensure unique code
    while (db.findShareByCode(code)) {
      code = generateTransferCode();
    }

    let passwordHash = null;
    if (password && password.trim().length > 0) {
      const salt = await bcrypt.genSalt(10);
      passwordHash = await bcrypt.hash(password.trim(), salt);
    }

    const hours = parseInt(expiryHours, 10) || 24; // Default 24h
    let expiresAt = null;
    if (hours > 0) {
      const expDate = new Date();
      expDate.setHours(expDate.getHours() + hours);
      expiresAt = expDate.toISOString();
    }

    const fileRecords = req.files.map((file) => ({
      id: uuidv4(),
      originalName: Buffer.from(file.originalname, 'latin1').toString('utf8'), // handle utf8 filenames
      filename: file.filename,
      size: file.size,
      mimetype: file.mimetype,
      isImage: file.mimetype.startsWith('image/'),
      uploadedAt: new Date().toISOString(),
    }));

    // Auto-resolve title if not provided
    let finalTitle = title ? title.trim() : '';
    if (!finalTitle) {
      if (folderName && folderName.trim()) {
        finalTitle = `Folder: ${folderName.trim()}`;
      } else if (fileRecords.length === 1) {
        finalTitle = fileRecords[0].originalName;
      } else {
        finalTitle = `${fileRecords.length} Shared Files`;
      }
    }

    // Determine host with Local LAN IP for seamless phone QR scanning
    const localIp = getLocalIpAddress();
    let host = req.get('host') || `localhost:${process.env.PORT || 3001}`;
    
    // Replace localhost or 127.0.0.1 with local network IP (e.g. 192.168.x.x) so mobile cameras can connect
    if (host.startsWith('localhost') || host.startsWith('127.0.0.1')) {
      const port = host.includes(':') ? host.split(':')[1] : (process.env.PORT || 3001);
      host = `${localIp}:${port}`;
    }

    const protocol = req.protocol === 'https' ? 'https' : 'http';
    const shareUrl = `${protocol}://${host}/receive/${code}`;

    // Generate high quality QR code data URL
    const qrDataUrl = await QRCode.toDataURL(shareUrl, {
      width: 400,
      margin: 2,
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
    });

    const secretToken = generateSecretToken();

    const newShare = {
      id: uuidv4(),
      code: code.toUpperCase(),
      secretToken,
      userId: req.user ? req.user.id : null,
      senderName: req.user ? req.user.name : (req.body.senderName || 'Anonymous'),
      title: finalTitle,
      note: note ? note.trim() : '',
      isPasswordProtected: !!passwordHash,
      passwordHash,
      files: fileRecords,
      totalSize: fileRecords.reduce((acc, f) => acc + f.size, 0),
      createdAt: new Date().toISOString(),
      expiresAt,
      downloads: 0,
      qrDataUrl,
      shareUrl,
    };

    db.createShare(newShare);

    const { passwordHash: _, ...safeShare } = newShare;
    const downloadToken = generateDownloadToken(newShare.code, passwordHash || 'public');

    return res.status(201).json({
      message: 'Files uploaded successfully!',
      share: safeShare,
      downloadToken,
    });
  } catch (err) {
    console.error('Upload error:', err);
    cleanupFiles(req.files);
    return res.status(500).json({ error: 'Failed to upload files.' });
  }
});

// Helper for download/preview authorization
async function verifyShareAccess(req, share) {
  if (!share.isPasswordProtected) return true;
  const token = req.query.token || req.headers['x-download-token'];
  const password = req.query.password || req.body?.password;

  if (token && verifyDownloadToken(share.code, token, share.passwordHash)) {
    return true;
  }

  if (password && (await bcrypt.compare(password, share.passwordHash))) {
    return true;
  }

  return false;
}

// Get user's transfer history (Created QR Shares, Claimed/Received Transfers, Inbox Transfers)
router.get('/my-shares', requireAuth, (req, res) => {
  try {
    const allShares = db.getShares() || [];

    // 1. Shares created by this user
    const createdShares = allShares
      .filter((s) => s.userId === req.user.id)
      .map(({ passwordHash, ...s }) => ({
        ...s,
        type: 'share',
        role: 'sender',
      }));

    // 2. Shares received/claimed by this user from other senders
    const claimedShares = allShares
      .filter((s) => s.userId !== req.user.id && (s.claimedByUserIds || []).includes(req.user.id))
      .map(({ passwordHash, ...s }) => ({
        ...s,
        type: 'claimed_share',
        role: 'receiver',
      }));

    // 3. User personal inboxes (incoming requests to host)
    const inboxes = (db.getInboxes() || []).filter((i) => i.userId === req.user.id);
    const inboxTransfers = [];
    for (const inbox of inboxes) {
      for (const t of inbox.pendingTransfers || []) {
        inboxTransfers.push({
          ...t,
          type: 'inbox_transfer',
          inboxId: inbox.id,
          inboxHostName: inbox.hostName,
          role: 'receiver',
        });
      }
    }

    // 4. Outgoing transfers sent by this user to another host's inbox
    const allInboxes = db.getInboxes() || [];
    const outgoingInboxTransfers = [];
    for (const inbox of allInboxes) {
      if (inbox.userId !== req.user.id) {
        for (const t of inbox.pendingTransfers || []) {
          if (t.senderUserId === req.user.id) {
            outgoingInboxTransfers.push({
              ...t,
              type: 'sent_inbox_transfer',
              inboxId: inbox.id,
              inboxHostName: inbox.hostName,
              role: 'sender',
            });
          }
        }
      }
    }

    return res.json({ 
      shares: createdShares, 
      claimedShares, 
      inboxTransfers,
      outgoingInboxTransfers 
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to load transfer history.' });
  }
});

// Explicitly claim / save a received transfer into user's history
router.post('/:code/claim', requireAuth, (req, res) => {
  try {
    const { code } = req.params;
    const share = db.findShareByCode(code);
    if (!share) return res.status(404).json({ error: 'Transfer not found.' });

    const claimed = share.claimedByUserIds || [];
    if (!claimed.includes(req.user.id)) {
      claimed.push(req.user.id);
      db.updateShare(code, { claimedByUserIds: claimed });
    }

    return res.json({ success: true, message: 'Transfer saved to your history.' });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to claim transfer.' });
  }
});

// Unlock password-protected share and receive a signed download token
router.post('/:code/unlock', codeLookupLimiter, async (req, res) => {
  try {
    const { code } = req.params;
    const { password } = req.body;
    const share = db.findShareByCode(code);
    if (!share) return res.status(404).json({ error: 'Transfer not found.' });

    if (!share.isPasswordProtected) {
      const { passwordHash: _, ...safeShare } = share;
      const downloadToken = generateDownloadToken(share.code, 'public');
      return res.json({ success: true, share: safeShare, downloadToken });
    }

    if (!password) {
      return res.status(400).json({ error: 'Password is required to unlock this transfer.' });
    }

    const match = await bcrypt.compare(password, share.passwordHash);
    if (!match) {
      logSecurityEvent({
        type: 'auth_failure',
        ip: req.ip,
        endpoint: `/api/shares/${code}/unlock`,
        details: 'Incorrect share unlock password attempt',
      });
      return res.status(403).json({ error: 'Incorrect password.' });
    }

    const downloadToken = generateDownloadToken(share.code, share.passwordHash);
    const { passwordHash: _, ...safeShare } = share;
    return res.json({ success: true, share: safeShare, downloadToken });
  } catch (err) {
    return res.status(500).json({ error: 'Unlock verification failed.' });
  }
});

// Get Share details by Code (with password verification if needed)
router.get('/:code', optionalAuth, codeLookupLimiter, async (req, res) => {
  try {
    const { code } = req.params;
    const { password, token } = req.query;

    const share = db.findShareByCode(code);
    if (!share) {
      return res.status(404).json({ error: 'Transfer not found or has been deleted.' });
    }

    // Check expiry
    if (share.expiresAt && new Date(share.expiresAt) < new Date()) {
      return res.status(410).json({ error: 'This transfer link has expired.' });
    }

    // Check if files still exist on disk (prevents phantom transfers after server wipes)
    const existingFiles = (share.files || []).filter((f) => {
      try {
        const filePath = safeResolveUploadPath(uploadsDir, f.filename);
        return fs.existsSync(filePath);
      } catch {
        return false;
      }
    });

    if (existingFiles.length === 0 && share.files && share.files.length > 0) {
      return res.status(404).json({ error: 'This transfer has expired or the files are no longer available on the server.' });
    }

    // Check password protection
    if (share.isPasswordProtected) {
      let authorized = false;
      if (token && verifyDownloadToken(share.code, token, share.passwordHash)) {
        authorized = true;
      } else if (password) {
        authorized = await bcrypt.compare(password, share.passwordHash);
      }

      if (!authorized) {
        return res.status(401).json({
          isPasswordProtected: true,
          title: share.title,
          senderName: share.senderName,
          code: share.code,
          fileCount: share.files.length,
          totalSize: share.totalSize,
          message: 'Password required to access these files.',
        });
      }
    }

    // If logged-in user is claiming/viewing someone else's share, automatically record to their history
    if (req.user && req.user.id !== share.userId) {
      const claimed = share.claimedByUserIds || [];
      if (!claimed.includes(req.user.id)) {
        claimed.push(req.user.id);
        db.updateShare(code, { claimedByUserIds: claimed });
      }
    }

    const { passwordHash: _, ...safeShare } = share;
    const downloadToken = generateDownloadToken(share.code, share.passwordHash || 'public');
    return res.json({ share: safeShare, downloadToken });
  } catch (err) {
    console.error('Get share error:', err);
    return res.status(500).json({ error: 'Failed to retrieve transfer.' });
  }
});


// Stream / Preview Image or File (supports HTTP 206 Range requests for videos)
router.get('/:code/preview/:fileId', async (req, res) => {
  try {
    const { code, fileId } = req.params;
    const share = db.findShareByCode(code);
    if (!share) return res.status(404).send('Not found');

    const hasAccess = await verifyShareAccess(req, share);
    if (!hasAccess) {
      return res.status(401).send('Unauthorized: Password or valid download token required');
    }

    const file = share.files.find((f) => f.id === fileId);
    if (!file) return res.status(404).send('File not found');

    const filePath = safeResolveUploadPath(uploadsDir, file.filename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).send('File missing from disk');
    }

    const safeMime = getSafeMimeType(file.originalName, file.mimetype);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=86400');

    // Support HTTP 206 partial content for HTML5 video seeking & iOS Safari
    if (range && (safeMime.startsWith('video/') || safeMime.startsWith('audio/'))) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
      const chunksize = (end - start) + 1;
      const stream = fs.createReadStream(filePath, { start, end });
      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${stat.size}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': safeMime,
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'public, max-age=86400',
      });
      return stream.pipe(res);
    }

    res.setHeader('Content-Type', safeMime);
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(file.originalName)}"`);
    res.setHeader('Content-Length', stat.size);
    res.setHeader('Accept-Ranges', 'bytes');
    return fs.createReadStream(filePath).pipe(res);
  } catch (err) {
    return res.status(500).send('Error streaming file');
  }
});

// Download Single File
router.get('/:code/download/:fileId', async (req, res) => {
  try {
    const { code, fileId } = req.params;
    const share = db.findShareByCode(code);
    if (!share) return res.status(404).send('Transfer not found');

    if (share.expiresAt && new Date(share.expiresAt) < new Date()) {
      return res.status(410).send('Transfer has expired');
    }

    const hasAccess = await verifyShareAccess(req, share);
    if (!hasAccess) {
      return res.status(401).send('Unauthorized: Password or valid download token required');
    }

    const file = share.files.find((f) => f.id === fileId);
    if (!file) return res.status(404).send('File not found');

    const filePath = safeResolveUploadPath(uploadsDir, file.filename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).send('File missing from server');
    }

    db.incrementDownloadCount(code);

    const safeMime = getSafeMimeType(file.originalName, file.mimetype);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Type', safeMime);
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(file.originalName)}"`);
    return fs.createReadStream(filePath).pipe(res);

  } catch (err) {
    console.error('Download error:', err);
    return res.status(500).send('Error downloading file');
  }
});

// Download All Files as ZIP
router.get('/:code/download-all', async (req, res) => {
  try {
    const { code } = req.params;
    const share = db.findShareByCode(code);
    if (!share) return res.status(404).send('Transfer not found');

    if (share.expiresAt && new Date(share.expiresAt) < new Date()) {
      return res.status(410).send('Transfer has expired');
    }

    const hasAccess = await verifyShareAccess(req, share);
    if (!hasAccess) {
      return res.status(401).send('Unauthorized: Password or valid download token required');
    }

    db.incrementDownloadCount(code);

    const archive = archiver('zip', {
      zlib: { level: 6 },
    });

    const safeTitle = sanitizeFilename(share.title).replace(/[^a-zA-Z0-9_-]/g, '_');
    const zipFilename = `${safeTitle}_${share.code}.zip`;

    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(zipFilename)}"`);

    archive.pipe(res);

    share.files.forEach((file) => {
      try {
        const filePath = safeResolveUploadPath(uploadsDir, file.filename);
        if (fs.existsSync(filePath)) {
          archive.file(filePath, { name: file.originalName });
        }
      } catch {
        // Skip inaccessible file
      }
    });

    archive.finalize();
  } catch (err) {
    console.error('ZIP download error:', err);
    return res.status(500).send('Error generating ZIP download');
  }
});


// Delete Transfer (Owner or Creator)
router.delete('/:code', requireAuth, (req, res) => {
  try {
    const { code } = req.params;
    const share = db.findShareByCode(code);
    if (!share) {
      return res.status(404).json({ error: 'Transfer not found.' });
    }

    if (share.userId !== req.user.id) {
      return res.status(403).json({ error: 'You do not have permission to delete this transfer.' });
    }

    // Delete files from uploads folder
    share.files.forEach((f) => {
      const filePath = path.join(uploadsDir, f.filename);
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch (e) {
          console.warn('Failed to delete file:', f.filename);
        }
      }
    });

    db.deleteShare(code);
    return res.json({ message: 'Transfer deleted successfully.' });
  } catch (err) {
    console.error('Delete share error:', err);
    return res.status(500).json({ error: 'Failed to delete transfer.' });
  }
});

export default router;
