import express from 'express';
import multer from 'multer';
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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Security: Blacklist of dangerous executables, scripts, and blocked archive formats
export const RESTRICTED_EXTENSIONS = new Set([
  '.exe', '.scr', '.com', '.bat', '.cmd', '.ps1', '.psm1', '.psd1',
  '.vbs', '.vbe', '.js', '.jse', '.wsf', '.wsh', '.msi', '.msp',
  '.dll', '.sys', '.cpl', '.reg', '.hta', '.lnk', '.url', '.jar',
  '.rar', '.7z', '.iso', '.img', '.tar', '.gz', '.tgz', '.bz2', '.xz'
]);

/**
 * Check if a filename ends with any restricted extension
 */
export function getRestrictedExtension(filename) {
  if (!filename) return null;
  const lower = filename.toLowerCase().trim();
  for (const ext of RESTRICTED_EXTENSIONS) {
    if (lower === ext || lower.endsWith(ext)) {
      return ext;
    }
  }
  return null;
}

/**
 * Helper to cleanup uploaded disk files if validation fails
 */
function cleanupFiles(files) {
  if (!files || !Array.isArray(files)) return;
  for (const file of files) {
    const filePath = path.join(uploadsDir, file.filename);
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch (err) {
        console.warn('Failed to cleanup file:', file.filename);
      }
    }
  }
}

// Configure multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const uniqueName = `${Date.now()}-${uuidv4().substring(0, 8)}${ext}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 500 * 1024 * 1024 }, // 500MB limit
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
router.post('/upload', requireAuth, upload.array('files', 100), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'Please select at least one file or photo to upload.' });
    }

    // 1. Validate all direct uploaded file extensions
    for (const file of req.files) {
      const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
      const restrictedExt = getRestrictedExtension(originalName);
      if (restrictedExt) {
        cleanupFiles(req.files);
        return res.status(400).json({
          error: `Security Alert: File "${originalName}" is not allowed (${restrictedExt}). Executable files, dangerous scripts, and restricted archives are prohibited.`
        });
      }

      // 2. If it is a ZIP archive, inspect its contents entry-by-entry
      if (originalName.toLowerCase().endsWith('.zip')) {
        const filePath = path.join(uploadsDir, file.filename);
        try {
          const zip = new AdmZip(filePath);
          const zipEntries = zip.getEntries();
          for (const entry of zipEntries) {
            if (entry.isDirectory) continue;
            const innerRestricted = getRestrictedExtension(entry.entryName);
            if (innerRestricted) {
              cleanupFiles(req.files);
              return res.status(400).json({
                error: `Security Alert: ZIP archive "${originalName}" contains a prohibited file "${entry.entryName}" (${innerRestricted}). Upload cancelled.`
              });
            }
          }
        } catch (zipErr) {
          console.warn('Could not inspect zip file:', originalName, zipErr.message);
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

    const newShare = {
      id: uuidv4(),
      code: code.toUpperCase(),
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

    return res.status(201).json({
      message: 'Files uploaded successfully!',
      share: safeShare,
    });
  } catch (err) {
    console.error('Upload error:', err);
    cleanupFiles(req.files);
    return res.status(500).json({ error: 'Failed to upload files.' });
  }
});

// Get user's transfer history
router.get('/my-shares', requireAuth, (req, res) => {
  try {
    const userShares = db.findSharesByUserId(req.user.id);
    const safeShares = userShares.map(({ passwordHash, ...s }) => s);
    return res.json({ shares: safeShares });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to load transfer history.' });
  }
});

// Get Share details by Code (with password verification if needed)
router.get('/:code', async (req, res) => {
  try {
    const { code } = req.params;
    const { password } = req.query;

    const share = db.findShareByCode(code);
    if (!share) {
      return res.status(404).json({ error: 'Transfer not found or has been deleted.' });
    }

    // Check expiry
    if (share.expiresAt && new Date(share.expiresAt) < new Date()) {
      return res.status(410).json({ error: 'This transfer link has expired.' });
    }

    // Check password protection
    if (share.isPasswordProtected) {
      if (!password) {
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

      const match = await bcrypt.compare(password, share.passwordHash);
      if (!match) {
        return res.status(403).json({ error: 'Incorrect password.' });
      }
    }

    const { passwordHash: _, ...safeShare } = share;
    return res.json({ share: safeShare });
  } catch (err) {
    console.error('Get share error:', err);
    return res.status(500).json({ error: 'Failed to retrieve transfer.' });
  }
});

// Stream / Preview Image or File
router.get('/:code/preview/:fileId', (req, res) => {
  try {
    const { code, fileId } = req.params;
    const share = db.findShareByCode(code);
    if (!share) return res.status(404).send('Not found');

    const file = share.files.find((f) => f.id === fileId);
    if (!file) return res.status(404).send('File not found');

    const filePath = path.join(uploadsDir, file.filename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).send('File missing from disk');
    }

    res.setHeader('Content-Type', file.mimetype || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(file.originalName)}"`);
    return fs.createReadStream(filePath).pipe(res);
  } catch (err) {
    return res.status(500).send('Error streaming file');
  }
});

// Download Single File
router.get('/:code/download/:fileId', (req, res) => {
  try {
    const { code, fileId } = req.params;
    const share = db.findShareByCode(code);
    if (!share) return res.status(404).send('Transfer not found');

    if (share.expiresAt && new Date(share.expiresAt) < new Date()) {
      return res.status(410).send('Transfer has expired');
    }

    const file = share.files.find((f) => f.id === fileId);
    if (!file) return res.status(404).send('File not found');

    const filePath = path.join(uploadsDir, file.filename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).send('File missing from server');
    }

    db.incrementDownloadCount(code);

    res.setHeader('Content-Type', file.mimetype || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(file.originalName)}"`);
    return fs.createReadStream(filePath).pipe(res);
  } catch (err) {
    console.error('Download error:', err);
    return res.status(500).send('Error downloading file');
  }
});

// Download All Files as ZIP
router.get('/:code/download-all', (req, res) => {
  try {
    const { code } = req.params;
    const share = db.findShareByCode(code);
    if (!share) return res.status(404).send('Transfer not found');

    if (share.expiresAt && new Date(share.expiresAt) < new Date()) {
      return res.status(410).send('Transfer has expired');
    }

    db.incrementDownloadCount(code);

    const archive = archiver('zip', {
      zlib: { level: 6 },
    });

    const zipFilename = `${share.title.replace(/[^a-zA-Z0-9_-]/g, '_')}_${share.code}.zip`;

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(zipFilename)}"`);

    archive.pipe(res);

    share.files.forEach((file) => {
      const filePath = path.join(uploadsDir, file.filename);
      if (fs.existsSync(filePath)) {
        archive.file(filePath, { name: file.originalName });
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
