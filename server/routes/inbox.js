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
import { db } from '../db.js';
import { requireAuth, optionalAuth } from '../middleware/auth.js';
import { getLocalIpAddress } from '../utils/network.js';
import { sendIncomingTransferNotification } from '../utils/mailer.js';
import {
  isRestrictedExtension,
  sanitizeFilename,
  safeResolveUploadPath,
  inspectFileHeader,
  generateSecretToken,
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

// Rate Limiter for uploading into inbox (60 uploads / 15 mins, skipped in test mode)
const inboxUploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  skip: () => process.env.NODE_ENV === 'test',
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Upload rate limit reached. Please wait a moment.' },
});

// Configure multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const rawExt = path.extname(file.originalname).toLowerCase();
    const safeExt = /^[a-zA-Z0-9_\.]+$/.test(rawExt) ? rawExt : '.bin';
    const uniqueName = `inbox-${Date.now()}-${uuidv4().substring(0, 8)}${safeExt}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB limit
    files: 50,
    fieldSize: 10 * 1024 * 1024,
  },
});

const router = express.Router();

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

// Helper to generate readable 6-character code
function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// 1. Get or Create Persistent Unique Personal Inbox QR Code (Requires Auth)
router.get('/my-qr', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const existingInbox = db.findInboxByUserId(userId);
    if (existingInbox) {
      return res.json({ inbox: existingInbox });
    }
    // If none exists, auto-create one
    return res.redirect(307, '/api/inbox/create');
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch personal receive inbox.' });
  }
});

// Create/Fetch Unique Personal Inbox QR Code
router.post('/create', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const userEmail = req.user.email;
    const hostName = req.user.name || (req.body.hostName || 'Host Device');
    
    // Unless forceNew is requested, preserve existing unique personal inbox for user
    if (!req.body.forceNew) {
      const existingInbox = db.findInboxByUserId(userId);
      if (existingInbox) {
        return res.json({ inbox: existingInbox });
      }
    }

    // Always generate a fresh, unique inbox ID so each user's QR code is distinct
    let inboxId;
    let attempts = 0;
    do {
      inboxId = 'INB-' + generateCode();
      attempts++;
    } while (db.findInboxById(inboxId) && attempts < 20);

    const localIp = getLocalIpAddress();
    const port = process.env.PORT || 3001;
    const sendUrl = `http://${localIp}:${port}/send-to/${inboxId}`;

    const qrDataUrl = await QRCode.toDataURL(sendUrl, {
      width: 400,
      margin: 2,
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
    });

    const secretToken = generateSecretToken();

    const inbox = {
      id: inboxId,
      secretToken,
      userId,
      userEmail,
      hostName,
      sendUrl,
      qrDataUrl,
      status: 'waiting',
      pendingTransfers: [],
      createdAt: new Date().toISOString(),
      lastActivityAt: new Date().toISOString(),
    };

    const existingInbox = db.findInboxByUserId(userId);
    if (existingInbox && req.body.forceNew) {
      db.updateInbox(existingInbox.id, inbox);
    } else {
      db.createInbox(inbox);
    }

    return res.status(201).json({ inbox });
  } catch (err) {
    console.error('Create inbox error:', err);
    return res.status(500).json({ error: 'Failed to create personal receive inbox.' });
  }
});

// 2. Get Inbox info for Sender
router.get('/:inboxId', (req, res) => {
  try {
    const { inboxId } = req.params;
    const inbox = db.findInboxById(inboxId);
    if (!inbox) {
      return res.status(404).json({ error: 'Personal receive inbox not found or has expired.' });
    }
    const { secretToken: _, ...safeInbox } = inbox;
    return res.json({ inbox: safeInbox });
  } catch (err) {
    return res.status(500).json({ error: 'Error fetching inbox.' });
  }
});

// 3. Sender uploads files into Host's Inbox
router.post('/:inboxId/upload', optionalAuth, inboxUploadLimiter, upload.array('files', 50), async (req, res) => {
  try {
    const { inboxId } = req.params;
    const inbox = db.findInboxById(inboxId);
    if (!inbox) {
      cleanupFiles(req.files);
      return res.status(404).json({ error: 'Receiver inbox not found.' });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'Please select at least one photo or file to send.' });
    }

    // Validate restricted extensions and deep binary header inspection
    for (const file of req.files) {
      const rawName = Buffer.from(file.originalname, 'latin1').toString('utf8');
      const cleanOriginalName = sanitizeFilename(rawName);

      if (isRestrictedExtension(cleanOriginalName)) {
        cleanupFiles(req.files);
        logSecurityEvent({
          type: 'malware_blocked',
          ip: req.ip,
          endpoint: `/api/inbox/${inboxId}/upload`,
          details: `Blocked restricted extension: ${cleanOriginalName}`,
        });
        return res.status(400).json({
          error: `Security Alert: File "${cleanOriginalName}" is prohibited for security reasons.`
        });
      }

      const filePath = safeResolveUploadPath(uploadsDir, file.filename);

      // Deep binary header check for executable binaries and active scripts
      const headerCheck = inspectFileHeader(filePath, cleanOriginalName);
      if (!headerCheck.isSafe) {
        cleanupFiles(req.files);
        logSecurityEvent({
          type: 'malware_blocked',
          ip: req.ip,
          endpoint: `/api/inbox/${inboxId}/upload`,
          details: `Binary inspection failed: ${headerCheck.reason} for file ${cleanOriginalName}`,
        });
        return res.status(400).json({
          error: `Security Alert: ${headerCheck.reason}. Upload rejected.`
        });
      }

      // Check inside ZIP
      if (cleanOriginalName.toLowerCase().endsWith('.zip')) {
        try {
          const zip = new AdmZip(filePath);
          for (const entry of zip.getEntries()) {
            if (entry.isDirectory) continue;
            if (isRestrictedExtension(entry.entryName)) {
              cleanupFiles(req.files);
              logSecurityEvent({
                type: 'malware_blocked',
                ip: req.ip,
                endpoint: `/api/inbox/${inboxId}/upload`,
                details: `Blocked archive containing: ${entry.entryName}`,
              });
              return res.status(400).json({
                error: `Security Alert: ZIP archive contains prohibited file "${entry.entryName}". Upload rejected.`
              });
            }
          }
        } catch (zipErr) {
          console.warn('Zip parsing error:', zipErr.message);
        }
      }
    }

    const { senderName, title, folderName, note, isHighQuality } = req.body;

    const fileRecords = req.files.map((file) => {
      const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
      const ext = path.extname(originalName).toLowerCase();
      const isImage = file.mimetype.startsWith('image/') || ['.heic', '.heif', '.jpg', '.jpeg', '.png', '.webp'].includes(ext);
      const isVideo = file.mimetype.startsWith('video/') || ['.mov', '.mp4', '.m4v', '.webm'].includes(ext);
      return {
        id: uuidv4(),
        originalName,
        filename: file.filename,
        size: file.size,
        mimetype: file.mimetype,
        isImage,
        isVideo,
        uploadedAt: new Date().toISOString(),
      };
    });

    // Auto-detect and pair Live Photo matching components (e.g. IMG_0001.JPG + IMG_0001.MOV)
    fileRecords.forEach((file) => {
      if (file.isImage) {
        const dotIdx = file.originalName.lastIndexOf('.');
        const baseName = dotIdx > 0 ? file.originalName.substring(0, dotIdx).toLowerCase() : file.originalName.toLowerCase();
        const pairedVideo = fileRecords.find((v) => {
          if (!v.isVideo) return false;
          const vDotIdx = v.originalName.lastIndexOf('.');
          const vBaseName = vDotIdx > 0 ? v.originalName.substring(0, vDotIdx).toLowerCase() : v.originalName.toLowerCase();
          return vBaseName === baseName;
        });

        if (pairedVideo) {
          file.isLivePhoto = true;
          file.pairedLiveVideoId = pairedVideo.id;
          pairedVideo.isLiveVideoComponent = true;
        }
      }
    });

    let finalTitle = title ? title.trim() : '';
    if (!finalTitle) {
      if (folderName && folderName.trim()) {
        finalTitle = `Folder: ${folderName.trim()}`;
      } else if (fileRecords.length === 1) {
        finalTitle = fileRecords[0].originalName;
      } else {
        finalTitle = `${fileRecords.length} Files`;
      }
    }

    const transfer = {
      transferId: uuidv4(),
      senderUserId: req.user ? req.user.id : null,
      senderName: req.user?.name || (senderName ? senderName.trim() : 'Guest Phone'),
      title: finalTitle,
      folderName: folderName || '',
      note: note ? note.trim() : '',
      isHighQuality: isHighQuality !== 'false',
      files: fileRecords,
      totalSize: fileRecords.reduce((acc, f) => acc + f.size, 0),
      status: 'pending_approval', // pending_approval | accepted | rejected
      sentAt: new Date().toISOString(),
    };


    const pending = inbox.pendingTransfers || [];
    pending.unshift(transfer);

    db.updateInbox(inboxId, {
      status: 'has_pending',
      pendingTransfers: pending,
      lastActivityAt: new Date().toISOString(),
    });

    // Send email notification to the exact Google email account connected by the user
    const hostUser = inbox.userId ? db.findUserById(inbox.userId) : null;
    const recipientEmail = inbox.userEmail || (hostUser ? hostUser.email : null);
    const recipientName = hostUser ? hostUser.name : (inbox.hostName || 'User');

    function formatBytesHelper(b) {
      if (!b || b === 0) return '0 Bytes';
      const k = 1024;
      const sizes = ['Bytes', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(b) / Math.log(k));
      return parseFloat((b / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    sendIncomingTransferNotification({
      recipientEmail,
      recipientName,
      senderName: transfer.senderName,
      title: transfer.title,
      fileCount: transfer.files.length,
      totalSizeFormatted: formatBytesHelper(transfer.totalSize),
      note: transfer.note,
      reviewUrl: inbox.sendUrl,
    }).catch((e) => console.warn('[Mailer] Notice:', e.message));

    return res.status(201).json({
      message: 'Files sent! Waiting for recipient to confirm and accept.',
      transferId: transfer.transferId,
      transfer,
    });
  } catch (err) {
    console.error('Inbox upload error:', err);
    cleanupFiles(req.files);
    return res.status(500).json({ error: 'Failed to send files to receiver.' });
  }
});

// 4. Check Status (Host & Sender Polling)
router.get('/:inboxId/status', (req, res) => {
  try {
    const { inboxId } = req.params;
    const { transferId } = req.query;
    const inbox = db.findInboxById(inboxId);
    if (!inbox) {
      return res.status(404).json({ error: 'Inbox not found.' });
    }

    if (transferId) {
      const transfer = (inbox.pendingTransfers || []).find((t) => t.transferId === transferId);
      if (!transfer) {
        return res.status(404).json({ error: 'Transfer not found.' });
      }
      return res.json({ status: transfer.status, transfer });
    }

    return res.json({
      status: inbox.status,
      pendingTransfers: inbox.pendingTransfers || [],
    });
  } catch (err) {
    return res.status(500).json({ error: 'Error checking status.' });
  }
});

// 5. Host Previews Image or Video from Pending Transfer (supports HTTP 206 Range for videos)
router.get('/:inboxId/preview/:fileId', (req, res) => {
  try {
    const { inboxId, fileId } = req.params;
    const inbox = db.findInboxById(inboxId);
    if (!inbox) return res.status(404).send('Inbox not found');

    let targetFile = null;
    let targetTransfer = null;
    for (const transfer of inbox.pendingTransfers || []) {
      const found = transfer.files.find((f) => f.id === fileId);
      if (found) {
        targetFile = found;
        targetTransfer = transfer;
        break;
      }
    }

    if (!targetFile || !targetTransfer) return res.status(404).send('File not found');

    // Security & Privacy Protection: Require explicit viewing approval from recipient before streaming photo previews
    if (!targetTransfer.isViewApproved && targetTransfer.status !== 'accepted') {
      return res.status(403).send('Viewing approval required. Recipient must approve viewing access first.');
    }

    const filePath = safeResolveUploadPath(uploadsDir, targetFile.filename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).send('File missing from disk');
    }

    const safeMime = getSafeMimeType(targetFile.originalName, targetFile.mimetype);
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
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(targetFile.originalName)}"`);
    res.setHeader('Content-Length', stat.size);
    res.setHeader('Accept-Ranges', 'bytes');
    return fs.createReadStream(filePath).pipe(res);
  } catch (err) {
    return res.status(500).send('Error streaming file');
  }
});

// Approve Viewing for pending transfer (triggered when user clicks View)
router.post('/:inboxId/approve-view/:transferId', (req, res) => {
  try {
    const { inboxId, transferId } = req.params;
    const inbox = db.findInboxById(inboxId);
    if (!inbox) return res.status(404).json({ error: 'Inbox not found.' });

    const transfers = inbox.pendingTransfers || [];
    const transfer = transfers.find((t) => t.transferId === transferId);
    if (!transfer) return res.status(404).json({ error: 'Transfer not found.' });

    transfer.isViewApproved = true;
    transfer.viewApprovedAt = new Date().toISOString();

    db.updateInbox(inboxId, {
      pendingTransfers: transfers,
    });

    return res.json({
      message: 'Viewing approved.',
      transfer,
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to approve viewing.' });
  }
});

// 6. Host Confirms & Accepts Transfer (triggers auto download)
router.post('/:inboxId/confirm/:transferId', (req, res) => {
  try {
    const { inboxId, transferId } = req.params;
    const inbox = db.findInboxById(inboxId);
    if (!inbox) return res.status(404).json({ error: 'Inbox not found.' });

    const transfers = inbox.pendingTransfers || [];
    const transfer = transfers.find((t) => t.transferId === transferId);
    if (!transfer) return res.status(404).json({ error: 'Transfer not found.' });

    transfer.status = 'accepted';
    transfer.acceptedAt = new Date().toISOString();

    db.updateInbox(inboxId, {
      pendingTransfers: transfers,
      status: transfers.some((t) => t.status === 'pending_approval') ? 'has_pending' : 'waiting',
    });

    return res.json({
      message: 'Transfer accepted successfully.',
      transfer,
      downloadUrl: `/api/inbox/${inboxId}/download/${transferId}`,
    });
  } catch (err) {
    console.error('Confirm error:', err);
    return res.status(500).json({ error: 'Failed to confirm transfer.' });
  }
});

// 7. Host Rejects Transfer
router.post('/:inboxId/reject/:transferId', (req, res) => {
  try {
    const { inboxId, transferId } = req.params;
    const inbox = db.findInboxById(inboxId);
    if (!inbox) return res.status(404).json({ error: 'Inbox not found.' });

    const transfers = inbox.pendingTransfers || [];
    const transferIndex = transfers.findIndex((t) => t.transferId === transferId);
    if (transferIndex === -1) return res.status(404).json({ error: 'Transfer not found.' });

    const [rejected] = transfers.splice(transferIndex, 1);
    cleanupFiles(rejected.files);

    db.updateInbox(inboxId, {
      pendingTransfers: transfers,
      status: transfers.some((t) => t.status === 'pending_approval') ? 'has_pending' : 'waiting',
    });

    return res.json({ message: 'Transfer rejected and files cleaned up.' });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to reject transfer.' });
  }
});

// 8. Auto-Download Transfer as ZIP (or single file) to Host device
router.get('/:inboxId/download/:transferId', (req, res) => {
  try {
    const { inboxId, transferId } = req.params;
    const inbox = db.findInboxById(inboxId);
    if (!inbox) return res.status(404).send('Inbox not found');

    const transfer = (inbox.pendingTransfers || []).find((t) => t.transferId === transferId);
    if (!transfer) return res.status(404).send('Transfer not found');

    if (transfer.status !== 'accepted') {
      return res.status(403).send('Transfer must be accepted by host before download');
    }

    res.setHeader('X-Content-Type-Options', 'nosniff');

    // If single file, download directly
    if (transfer.files.length === 1) {
      const file = transfer.files[0];
      const filePath = safeResolveUploadPath(uploadsDir, file.filename);
      if (!fs.existsSync(filePath)) return res.status(404).send('File missing');

      const safeMime = getSafeMimeType(file.originalName, file.mimetype);
      res.setHeader('Content-Type', safeMime);
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(file.originalName)}"`);
      return fs.createReadStream(filePath).pipe(res);
    }


    // If multiple files, stream as ZIP
    const archive = archiver('zip', { zlib: { level: 6 } });
    const safeTitle = sanitizeFilename(transfer.title || 'Received_Files').replace(/[^a-zA-Z0-9_-]/g, '_');
    const zipName = `${safeTitle}.zip`;

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(zipName)}"`);

    archive.pipe(res);

    transfer.files.forEach((file) => {
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
    console.error('Download error:', err);
    return res.status(500).send('Error downloading files');
  }
});


export default router;
