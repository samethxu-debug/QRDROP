import fs from 'fs';
import path from 'path';
import db from '../db.js';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isVercel = Boolean(process.env.VERCEL);
const uploadsDir = isVercel ? '/tmp/uploads' : path.join(__dirname, '..', 'uploads');

export function runAutoCleanup() {
  try {
    const now = new Date();
    let filesDeleted = 0;
    let sharesRemoved = 0;

    // 1. Clean expired shares
    const allShares = db.getShares();
    const activeShares = [];

    for (const share of allShares) {
      const isExpired = share.expiresAt && new Date(share.expiresAt) < now;
      if (isExpired) {
        // Delete all associated files from disk
        for (const f of share.files || []) {
          try {
            const filePath = path.join(uploadsDir, f.filename);
            if (fs.existsSync(filePath)) {
              fs.unlinkSync(filePath);
              filesDeleted++;
            }
          } catch (err) {
            console.error(`Failed to delete expired file ${f.filename}:`, err.message);
          }
        }
        sharesRemoved++;
      } else {
        activeShares.push(share);
      }
    }

    if (sharesRemoved > 0) {
      db.saveShares(activeShares);
    }

    // 2. Clean stale inboxes (> 24 hours) & rejected pending transfers
    const allInboxes = db.getInboxes();
    const activeInboxes = [];
    const maxInboxAgeMs = 24 * 60 * 60 * 1000;

    for (const inbox of allInboxes) {
      const inboxAge = now - new Date(inbox.createdAt);
      if (inboxAge > maxInboxAgeMs) {
        // Delete all pending transfer files for this stale inbox
        for (const transfer of inbox.pendingTransfers || []) {
          for (const f of transfer.files || []) {
            try {
              const filePath = path.join(uploadsDir, f.filename);
              if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
                filesDeleted++;
              }
            } catch (err) {
              console.error(`Failed to delete stale inbox file ${f.filename}:`, err.message);
            }
          }
        }
      } else {
        // Keep active inbox, but clean rejected transfers older than 1 hour
        const keptTransfers = [];
        for (const transfer of inbox.pendingTransfers || []) {
          if (transfer.status === 'rejected') {
            for (const f of transfer.files || []) {
              try {
                const filePath = path.join(uploadsDir, f.filename);
                if (fs.existsSync(filePath)) {
                  fs.unlinkSync(filePath);
                  filesDeleted++;
                }
              } catch (err) {
                // Ignore unlink errors
              }
            }
          } else {
            keptTransfers.push(transfer);
          }
        }
        inbox.pendingTransfers = keptTransfers;
        activeInboxes.push(inbox);
      }
    }

    db.saveInboxes(activeInboxes);

    if (filesDeleted > 0 || sharesRemoved > 0) {
      console.log(`[AUTO_CLEANUP] Deleted ${filesDeleted} expired files and pruned ${sharesRemoved} expired transfers.`);
    }
  } catch (err) {
    console.error('[AUTO_CLEANUP_ERROR]', err);
  }
}

export function startCleanupWorker(intervalMs = 5 * 60 * 1000) {
  // Run once immediately on start
  runAutoCleanup();
  // Set recurring interval
  const timer = setInterval(runAutoCleanup, intervalMs);
  return timer;
}
