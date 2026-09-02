import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

const DANGEROUS_EXTENSIONS = new Set([
  '.exe', '.bat', '.cmd', '.sh', '.bash', '.zsh',
  '.msi', '.msp', '.com', '.scr', '.hta', '.cpl',
  '.vbs', '.vbe', '.js', '.jse', '.wsf', '.wsh',
  '.ps1', '.ps1xml', '.ps2', '.ps2xml', '.psc1', '.psc2',
  '.phtml', '.php', '.php3', '.php4', '.php5', '.php7', '.phps',
  '.jar', '.apk', '.gadget', '.reg', '.dll', '.sys', '.drv',
  '.iso', '.vhd', '.vhdx', '.img'
]);

export function isRestrictedExtension(filename) {
  if (!filename) return false;
  const ext = path.extname(filename).toLowerCase();
  return DANGEROUS_EXTENSIONS.has(ext);
}

export function sanitizeFilename(originalName) {
  if (!originalName || typeof originalName !== 'string') return 'unnamed_file';
  
  let clean = path.basename(originalName);
  clean = clean.replace(/[\x00-\x1f\x7f-\x9f]/g, '');
  clean = clean.replace(/[<>:"/\\|?*]/g, '_');
  clean = clean.replace(/^\.+/, '');
  clean = clean.normalize('NFKC').trim();

  if (clean.length === 0) clean = 'unnamed_file';
  if (clean.length > 255) {
    const ext = path.extname(clean);
    const base = path.basename(clean, ext).slice(0, 255 - ext.length);
    clean = base + ext;
  }
  return clean;
}

export function safeResolveUploadPath(uploadsDir, filename) {
  if (!filename || typeof filename !== 'string') {
    throw new Error('Invalid filename specified');
  }

  // Explicitly block path traversal sequences and separators in file identifiers
  if (filename.includes('/') || filename.includes('\\') || filename.includes('..')) {
    throw new Error('Path traversal sequence detected in filename');
  }

  const safeBasename = path.basename(filename);
  if (!/^[a-zA-Z0-9_\-\.]+$/.test(safeBasename)) {
    throw new Error('Filename contains illegal characters');
  }

  const baseDir = path.resolve(uploadsDir);
  const resolvedPath = path.resolve(baseDir, safeBasename);

  if (!resolvedPath.startsWith(baseDir + path.sep) && resolvedPath !== baseDir) {
    throw new Error('Path traversal boundary violation detected');
  }

  return resolvedPath;
}

export function inspectFileHeader(filePath, originalName = '') {
  try {
    if (!fs.existsSync(filePath)) {
      return { isSafe: false, reason: 'File does not exist on disk' };
    }

    const stat = fs.statSync(filePath);
    if (stat.size === 0) {
      return { isSafe: true };
    }

    const bytesToRead = Math.min(stat.size, 512);
    const buffer = Buffer.alloc(bytesToRead);
    const fd = fs.openSync(filePath, 'r');
    fs.readSync(fd, buffer, 0, bytesToRead, 0);
    fs.closeSync(fd);

    // 1. Windows PE Executable (MZ header)
    if (buffer.length >= 2 && buffer[0] === 0x4D && buffer[1] === 0x5A) {
      return { isSafe: false, reason: 'Dangerous Windows executable binary (MZ header) detected' };
    }

    // 2. Linux ELF Executable (\x7fELF)
    if (buffer.length >= 4 && buffer[0] === 0x7F && buffer[1] === 0x45 && buffer[2] === 0x4C && buffer[3] === 0x46) {
      return { isSafe: false, reason: 'Dangerous Linux executable binary (ELF header) detected' };
    }

    // 3. Mach-O Executable (macOS)
    if (buffer.length >= 4) {
      const magic32 = buffer.readUInt32BE(0);
      if (magic32 === 0xFEEDFACE || magic32 === 0xFEEDFACF || magic32 === 0xCEFAEDFE || magic32 === 0xCFFAEDFE) {
        return { isSafe: false, reason: 'Dangerous Mach-O executable binary detected' };
      }
    }

    // 4. SVG / HTML / XML script payload inspection
    const ext = path.extname(originalName || filePath).toLowerCase();
    if (ext === '.svg' || ext === '.xml' || ext === '.html' || ext === '.htm') {
      const text = buffer.toString('utf8').toLowerCase();
      const dangerousPatterns = ['<script', 'javascript:', 'onload=', 'onerror=', '<iframe', '<embed', '<object', '<applet'];
      for (const pattern of dangerousPatterns) {
        if (text.includes(pattern)) {
          return { isSafe: false, reason: `Malicious active script payload (${pattern}) detected in media file` };
        }
      }
    }

    return { isSafe: true };
  } catch (err) {
    return { isSafe: false, reason: 'Inspection error: ' + err.message };
  }
}

export function generateSecretToken() {
  return crypto.randomBytes(24).toString('hex');
}

export function generateDownloadToken(shareCode, secretOrKey = 'qrdrop-secret') {
  const expiresAt = Date.now() + 15 * 60 * 1000; // 15 minutes
  const payload = `${shareCode}:${expiresAt}`;
  const hmac = crypto.createHmac('sha256', secretOrKey).update(payload).digest('hex');
  return `${expiresAt}.${hmac}`;
}

export function verifyDownloadToken(shareCode, token, secretOrKey = 'qrdrop-secret') {
  if (!token || typeof token !== 'string') return false;
  const parts = token.split('.');
  if (parts.length !== 2) return false;

  const [expiresAtStr, providedHmac] = parts;
  const expiresAt = parseInt(expiresAtStr, 10);
  if (isNaN(expiresAt) || Date.now() > expiresAt) {
    return false; // Token expired
  }

  const payload = `${shareCode}:${expiresAt}`;
  const expectedHmac = crypto.createHmac('sha256', secretOrKey).update(payload).digest('hex');

  try {
    return crypto.timingSafeEqual(Buffer.from(providedHmac, 'hex'), Buffer.from(expectedHmac, 'hex'));
  } catch {
    return false;
  }
}
