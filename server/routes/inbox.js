import express from 'express';
import multer from 'multer';
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
import { RESTRICTED_EXTENSIONS, getRestrictedExtension } from './shares.js';
import { sendIncomingTransferNotification } from '../utils/mailer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const uniqueName = `inbox-${Date.now()}-${uuidv4().substring(0, 8)}${ext}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 500 * 1024 * 1024 }, // 500MB limit
});

const router = express.Router();

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

// Helper to generate readable 6-character code
function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// 1. Create a FRESH, unique Personal Inbox QR Code (Requires Google Login)
router.post('/create', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const userEmail = req.user.email;
    const hostName = req.user.name || (req.body.hostName || 'Host Device');
    
    // Always generate a fresh, unique inbox ID so each QR code is distinct
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

    const inbox = {
      id: inboxId,
      userId,
      userEmail,
      hostName,
      sendUrl,
      qrDataUrl,
      status: 'waiting',
      pendingTransfers: [],
      createdAt: new Date().toISOString(),
    };

    db.createInbox(inbox);

    return res.status(201).json({ inbox });
  } catch (err) {
    console.error('Inbox create error:', err);
    return res.status(500).json({ error: 'Failed to create personal receive QR.' });
  }
});

// 2. Get Inbox Info
router.get('/:inboxId', (req, res) => {
  try {
    const { inboxId } = req.params;
    const inbox = db.findInboxById(inboxId);
    if (!inbox) {
      return res.status(404).json({ error: 'Personal receive inbox not found or has expired.' });
    }
    return res.json({ inbox });
  } catch (err) {
    return res.status(500).json({ error: 'Error fetching inbox.' });
  }
});

// 3. Sender uploads files into Host's Inbox
router.post('/:inboxId/upload', upload.array('files', 100), async (req, res) => {
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

    // Validate restricted extensions
    for (const file of req.files) {
      const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
      const restrictedExt = getRestrictedExtension(originalName);
      if (restrictedExt) {
        cleanupFiles(req.files);
        return res.status(400).json({
          error: `Security Alert: File "${originalName}" is restricted (${restrictedExt}). Executables, scripts, and archives are prohibited.`
        });
      }

      // Check inside ZIP
      if (originalName.toLowerCase().endsWith('.zip')) {
        const filePath = path.join(uploadsDir, file.filename);
        try {
          const zip = new AdmZip(filePath);
          for (const entry of zip.getEntries()) {
            if (entry.isDirectory) continue;
            const innerRestricted = getRestrictedExtension(entry.entryName);
            if (innerRestricted) {
              cleanupFiles(req.files);
              return res.status(400).json({
                error: `Security Alert: ZIP archive contains restricted file "${entry.entryName}" (${innerRestricted}).`
              });
            }
          }
        } catch (zipErr) {
          console.warn('Zip parsing error:', zipErr.message);
        }
      }
    }

    const { senderName, title, folderName, note } = req.body;

    const fileRecords = req.files.map((file) => ({
      id: uuidv4(),
      originalName: Buffer.from(file.originalname, 'latin1').toString('utf8'),
      filename: file.filename,
      size: file.size,
      mimetype: file.mimetype,
      isImage: file.mimetype.startsWith('image/'),
      uploadedAt: new Date().toISOString(),
    }));

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
      senderName: senderName ? senderName.trim() : 'Guest Phone',
      title: finalTitle,
      folderName: folderName || '',
      note: note ? note.trim() : '',
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
    for (const transfer of inbox.pendingTransfers || []) {
      const found = transfer.files.find((f) => f.id === fileId);
      if (found) {
        targetFile = found;
        break;
      }
    }

    if (!targetFile) return res.status(404).send('File not found');

    const filePath = path.join(uploadsDir, targetFile.filename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).send('File missing from disk');
    }

    const stat = fs.statSync(filePath);
    const range = req.headers.range;

    // Support HTTP 206 partial content for HTML5 video seeking & iOS Safari
    if (range && (targetFile.mimetype?.startsWith('video/') || targetFile.mimetype?.startsWith('audio/'))) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
      const chunksize = (end - start) + 1;
      const stream = fs.createReadStream(filePath, { start, end });
      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${stat.size}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': targetFile.mimetype || 'video/mp4',
      });
      return stream.pipe(res);
    }

    res.setHeader('Content-Type', targetFile.mimetype || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(targetFile.originalName)}"`);
    res.setHeader('Content-Length', stat.size);
    res.setHeader('Accept-Ranges', 'bytes');
    return fs.createReadStream(filePath).pipe(res);
  } catch (err) {
    return res.status(500).send('Error streaming file');
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

    // If single file, download directly
    if (transfer.files.length === 1) {
      const file = transfer.files[0];
      const filePath = path.join(uploadsDir, file.filename);
      if (!fs.existsSync(filePath)) return res.status(404).send('File missing');

      res.setHeader('Content-Type', file.mimetype || 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(file.originalName)}"`);
      return fs.createReadStream(filePath).pipe(res);
    }

    // If multiple files, stream as ZIP
    const archive = archiver('zip', { zlib: { level: 6 } });
    const zipName = `${(transfer.title || 'Received_Files').replace(/[^a-zA-Z0-9_-]/g, '_')}.zip`;

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(zipName)}"`);

    archive.pipe(res);

    transfer.files.forEach((file) => {
      const filePath = path.join(uploadsDir, file.filename);
      if (fs.existsSync(filePath)) {
        archive.file(filePath, { name: file.originalName });
      }
    });

    archive.finalize();
  } catch (err) {
    console.error('Download error:', err);
    return res.status(500).send('Error downloading files');
  }
});

export default router;
