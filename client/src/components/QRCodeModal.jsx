import React, { useState } from 'react';
import { 
  X, 
  Copy, 
  Check, 
  Download, 
  Printer, 
  ExternalLink, 
  QrCode, 
  Share2, 
  FileText, 
  Layers 
} from 'lucide-react';

export default function QRCodeModal({ share, isOpen, onClose, t, onOpenReceive }) {
  const [copied, setCopied] = useState(false);

  if (!isOpen || !share) return null;

  const handleCopyLink = () => {
    // Generate full URL (prefer LAN network shareUrl if available)
    const url = share.shareUrl || `${window.location.origin}/receive/${share.code}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleDownloadQR = () => {
    const link = document.createElement('a');
    link.download = `QR-Drop-${share.code}.png`;
    link.href = share.qrDataUrl;
    link.click();
  };

  const handlePrintQR = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>QR Code - ${share.title || share.code}</title>
          <style>
            body {
              font-family: system-ui, -apple-system, sans-serif;
              text-align: center;
              padding: 40px 20px;
              color: #0f172a;
            }
            .card {
              max-width: 400px;
              margin: 0 auto;
              border: 2px solid #e2e8f0;
              border-radius: 20px;
              padding: 30px;
            }
            img {
              width: 260px;
              height: 260px;
              border-radius: 12px;
            }
            .code {
              font-size: 28px;
              font-weight: 800;
              letter-spacing: 4px;
              margin: 15px 0;
              color: #0d9488;
            }
            .title {
              font-size: 20px;
              font-weight: 700;
              margin-bottom: 8px;
            }
            .note {
              font-size: 14px;
              color: #64748b;
              margin-bottom: 20px;
            }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="title">${share.title || 'Shared Files'}</div>
            <div class="note">Scan this QR Code with your smartphone camera to receive files</div>
            <img src="${share.qrDataUrl}" alt="QR Code" />
            <div class="code">${share.code}</div>
            <p style="font-size: 12px; color: #94a3b8;">Generated with QR Drop</p>
          </div>
          <script>
            window.onload = function() {
              window.print();
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl p-6 sm:p-8 overflow-hidden text-center"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Glow ambient background */}
        <div className="absolute -top-32 -left-32 w-64 h-64 bg-teal-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-32 -right-32 w-64 h-64 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="mb-5">
          <div className="inline-flex p-2.5 rounded-2xl bg-teal-500/10 border border-teal-500/20 text-teal-400 mb-2">
            <QrCode className="w-6 h-6" />
          </div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-white">
            {t.qrSuccessTitle}
          </h2>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            {t.qrSuccessSubtitle}
          </p>
        </div>

        {/* QR Code Container */}
        <div className="relative inline-block p-4 rounded-3xl bg-white shadow-2xl shadow-teal-500/10 border-4 border-teal-500/20 group">
          <img
            src={share.qrDataUrl}
            alt="QR Code"
            className="w-52 h-52 sm:w-60 sm:h-60 rounded-xl object-contain mx-auto"
          />
        </div>

        {/* 6-Digit Transfer Code Badge */}
        <div className="mt-4 flex flex-col items-center">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            {t.transferCode}
          </span>
          <span className="text-2xl sm:text-3xl font-black tracking-widest text-teal-300 bg-slate-950 px-4 py-1 rounded-xl border border-slate-800 mt-1 font-mono">
            {share.code}
          </span>
        </div>

        {/* Details snippet */}
        <div className="mt-3 flex items-center justify-center gap-3 text-xs text-slate-400">
          <span className="flex items-center gap-1">
            <Layers className="w-3.5 h-3.5 text-teal-400" />
            {share.files?.length || 1} {t.filesCount}
          </span>
          <span>•</span>
          <span className="truncate max-w-[150px] font-medium text-slate-300">
            {share.title}
          </span>
        </div>

        {/* Actions Button */}
        <div className="mt-5 flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            onClick={handleDownloadQR}
            className="w-full sm:w-auto flex-1 flex items-center justify-center gap-2 py-3 px-6 rounded-2xl bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-slate-950 text-xs font-black transition shadow-lg shadow-teal-500/20"
          >
            <Download className="w-4 h-4 text-slate-950" />
            <span>{t.downloadQR}</span>
          </button>

          <button
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-3 rounded-2xl bg-slate-800 hover:bg-slate-750 text-slate-200 text-xs font-bold border border-slate-700 transition"
          >
            {t.shareDone}
          </button>
        </div>

        {/* Bottom Helper Note */}
        <div className="mt-4 pt-3 border-t border-slate-850">
          <p className="text-[11px] text-slate-400">
            {t.scanWithPhone}
          </p>
        </div>


      </div>
    </div>
  );
}
