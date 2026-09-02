import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import authRoutes from './routes/auth.js';
import shareRoutes from './routes/shares.js';
import inboxRoutes from './routes/inbox.js';
import adminRoutes from './routes/admin.js';
import { getLocalIpAddress } from './utils/network.js';
import { startCleanupWorker } from './services/cleanupService.js';
import { logSecurityEvent } from './utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Trust proxy for Render / Cloudflare / reverse proxy deployments
app.set('trust proxy', 1);

// Security Headers via Helmet
app.use(helmet({
  contentSecurityPolicy: false, // Allows cross-origin QR codes and data URLs
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// Rate Limiters
const globalLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 180,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please slow down.' },
  handler: (req, res, next, options) => {
    logSecurityEvent({
      type: 'rate_limit',
      ip: req.ip,
      endpoint: req.originalUrl,
      details: 'Global rate limit exceeded (180 req/min)',
    });
    res.status(429).json(options.message);
  }
});

app.use('/api', globalLimiter);

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

const isVercel = Boolean(process.env.VERCEL);
const uploadsDir = isVercel ? '/tmp/uploads' : path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Start auto cleanup background service (runs every 5 mins)
startCleanupWorker(5 * 60 * 1000);


// Routes
app.use('/api/auth', authRoutes);
app.use('/api/shares', shareRoutes);
app.use('/api/inbox', inboxRoutes);
app.use('/api/admin', adminRoutes);

// Health & Network info check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

app.get('/api/network-info', (req, res) => {
  const localIp = getLocalIpAddress();
  res.json({
    localIp,
    localUrl: `http://localhost:${PORT}`,
    networkUrl: `http://${localIp}:${PORT}`,
    port: PORT,
  });
});

// Serve frontend in production (Local or Monolith mode)
const clientDist = path.join(__dirname, '..', 'client', 'dist');
if (!isVercel && fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

if (!isVercel) {
  app.listen(PORT, '0.0.0.0', () => {
    const localIp = getLocalIpAddress();
    console.log(`\n======================================================`);
    console.log(`QR Drop Server is running:`);
    console.log(`   - Local PC : http://localhost:${PORT}`);
    console.log(`   - Phone/LAN: http://${localIp}:${PORT}`);
    console.log(`======================================================\n`);
  });
}

export default app;

