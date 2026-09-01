import React, { useEffect, useState, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { X, Camera, ArrowRight, AlertCircle, RefreshCw, KeyRound } from 'lucide-react';

export default function ScannerModal({ isOpen, onClose, onScanSuccess, t }) {
  const [manualCode, setManualCode] = useState('');
  const [cameraError, setCameraError] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const scannerRef = useRef(null);

  useEffect(() => {
    let html5QrCode = null;

    if (isOpen) {
      setCameraError('');
      setIsScanning(true);

      const startScanner = async () => {
        try {
          html5QrCode = new Html5Qrcode('qr-reader');
          scannerRef.current = html5QrCode;

          const config = {
            fps: 10,
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1.0,
          };

          await html5QrCode.start(
            { facingMode: 'environment' },
            config,
            (decodedText) => {
              // Successfully decoded
              handleScannedResult(decodedText);
            },
            (errorMessage) => {
              // scanning loop errors (ignore)
            }
          );
        } catch (err) {
          console.warn('Camera start error:', err);
          setCameraError(err.message || 'Unable to access camera. Please enter code manually.');
          setIsScanning(false);
        }
      };

      // Slight delay to ensure DOM element is ready
      const timer = setTimeout(() => {
        startScanner();
      }, 300);

      return () => {
        clearTimeout(timer);
        if (scannerRef.current) {
          scannerRef.current
            .stop()
            .then(() => scannerRef.current.clear())
            .catch(() => {});
        }
      };
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleScannedResult = (text) => {
    // Stop camera
    if (scannerRef.current) {
      scannerRef.current.stop().catch(() => {});
    }

    // Extract code if it's a URL (e.g. /receive/ABC123 or http://.../receive/ABC123)
    let code = text.trim();
    if (code.includes('/receive/')) {
      const parts = code.split('/receive/');
      code = parts[parts.length - 1].split('?')[0].split('#')[0].replace(/\/+$/, '');
    }

    code = code.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();

    if (code) {
      onScanSuccess(code);
    }
    onClose();
  };

  const handleManualSubmit = (e) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    handleScannedResult(manualCode.trim().toUpperCase());
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl p-6 sm:p-7 overflow-hidden text-center"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition z-10"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="mb-4">
          <div className="inline-flex p-2.5 rounded-2xl bg-teal-500/10 border border-teal-500/20 text-teal-400 mb-2">
            <Camera className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-white">
            {t.scanCameraTitle}
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {t.scanCameraSubtitle}
          </p>
        </div>

        {/* Camera Viewfinder Box */}
        <div className="relative w-full aspect-square max-w-[280px] mx-auto rounded-2xl overflow-hidden bg-slate-950 border-2 border-slate-800 flex items-center justify-center shadow-inner">
          <div id="qr-reader" className="w-full h-full" />
          
          {/* Laser scanning beam overlay */}
          {isScanning && !cameraError && (
            <div className="absolute inset-x-4 h-0.5 bg-gradient-to-r from-transparent via-teal-400 to-transparent animate-scan-line shadow-[0_0_8px_#14b8a6]" />
          )}

          {cameraError && (
            <div className="absolute inset-0 p-4 bg-slate-950/90 flex flex-col items-center justify-center text-center">
              <AlertCircle className="w-8 h-8 text-amber-400 mb-2" />
              <p className="text-xs text-amber-300 font-medium">
                {cameraError}
              </p>
              <p className="text-[11px] text-slate-400 mt-2">
                {t.cameraPermission}
              </p>
            </div>
          )}
        </div>

        {/* Manual Code Input Option */}
        <div className="mt-5 pt-4 border-t border-slate-800">
          <div className="flex items-center justify-center gap-1.5 text-xs text-slate-400 mb-2.5 font-medium">
            <KeyRound className="w-3.5 h-3.5 text-teal-400" />
            <span>{t.orEnterCode}</span>
          </div>

          <form onSubmit={handleManualSubmit} className="flex gap-2">
            <input
              type="text"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value.toUpperCase())}
              placeholder={t.enterCodePlaceholder}
              maxLength={12}
              className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-center text-sm font-mono tracking-widest text-teal-300 uppercase placeholder-slate-600 focus:outline-none focus:border-teal-500 transition"
            />
            <button
              type="submit"
              disabled={!manualCode.trim()}
              className="px-4 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition disabled:opacity-40 disabled:cursor-not-allowed shadow-md shadow-teal-500/20"
            >
              <span>{t.submitCode}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>

      </div>
    </div>
  );
}
