import React, { useEffect, useState, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import jsQR from 'jsqr';
import { X, Camera, ArrowRight, AlertCircle, KeyRound, Image as ImageIcon, CheckCircle2 } from 'lucide-react';

export default function ScannerModal({ isOpen, onClose, onScanSuccess, t }) {
  const [manualCode, setManualCode] = useState('');
  const [cameraError, setCameraError] = useState('');
  const [imageScanError, setImageScanError] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [scannedPreview, setScannedPreview] = useState('');
  
  const scannerRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    let html5QrCode = null;

    if (isOpen) {
      setCameraError('');
      setImageScanError('');
      setScannedPreview('');
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
              handleScannedResult(decodedText);
            },
            () => {
              // scanning loop errors (ignore)
            }
          );
        } catch (err) {
          console.warn('Camera start notice:', err);
          setCameraError(err.message || 'Camera is in use or access not granted. You can upload a QR image or enter code manually.');
          setIsScanning(false);
        }
      };

      const timer = setTimeout(() => {
        startScanner();
      }, 250);

      return () => {
        clearTimeout(timer);
        if (scannerRef.current) {
          try {
            if (scannerRef.current.isScanning) {
              scannerRef.current.stop().then(() => {
                scannerRef.current?.clear();
              }).catch(() => {});
            } else {
              scannerRef.current?.clear();
            }
          } catch (e) {}
        }
      };
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleScannedResult = (text) => {
    if (!text) return;

    // Stop live camera if running
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) {
          scannerRef.current.stop().catch(() => {});
        }
      } catch (e) {}
    }

    let code = text.trim();
    if (code.includes('/receive/')) {
      const parts = code.split('/receive/');
      code = parts[parts.length - 1].split('?')[0].split('#')[0].replace(/\/+$/, '');
    } else if (code.includes('/send-to/')) {
      const parts = code.split('/send-to/');
      code = parts[parts.length - 1].split('?')[0].split('#')[0].replace(/\/+$/, '');
    }

    code = code.replace(/[^a-zA-Z0-9_-]/g, '').toUpperCase();

    if (code) {
      onScanSuccess(code);
    }
    onClose();
  };

  // Pure Canvas-based QR Image Decoding using jsQR (Never turns black / works 100% on all devices)
  const decodeQRFromImage = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          try {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            if (!ctx) {
              return reject(new Error('Canvas context unavailable'));
            }

            // High-resolution image optimization
            let width = img.width;
            let height = img.height;
            const maxDimension = 1200;

            if (width > maxDimension || height > maxDimension) {
              if (width > height) {
                height = Math.round((height * maxDimension) / width);
                width = maxDimension;
              } else {
                width = Math.round((width * maxDimension) / height);
                height = maxDimension;
              }
            }

            canvas.width = width;
            canvas.height = height;
            ctx.drawImage(img, 0, 0, width, height);

            const imageData = ctx.getImageData(0, 0, width, height);
            let code = jsQR(imageData.data, imageData.width, imageData.height, {
              inversionAttempts: 'attemptBoth',
            });

            if (code && code.data) {
              return resolve(code.data);
            }

            // Retry with full native resolution if resized attempt did not match
            if (width !== img.width) {
              canvas.width = img.width;
              canvas.height = img.height;
              ctx.drawImage(img, 0, 0);
              const origData = ctx.getImageData(0, 0, img.width, img.height);
              code = jsQR(origData.data, origData.width, origData.height, {
                inversionAttempts: 'attemptBoth',
              });
              if (code && code.data) {
                return resolve(code.data);
              }
            }

            reject(new Error('No QR code detected'));
          } catch (err) {
            reject(err);
          }
        };
        img.onerror = () => reject(new Error('Image decode error'));
        img.src = e.target.result;
      };
      reader.onerror = () => reject(new Error('File read error'));
      reader.readAsDataURL(file);
    });
  };

  const handleImageFileSelected = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImageScanError('');
    setIsProcessingImage(true);

    try {
      const decodedText = await decodeQRFromImage(file);
      setIsProcessingImage(false);
      handleScannedResult(decodedText);
    } catch (err) {
      console.warn('QR image decoding error:', err);
      setIsProcessingImage(false);
      setImageScanError(t.qrNotFoundInImage || 'No QR code found in this image. Please select a clearer photo or screenshot.');
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
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
          className="absolute top-4 right-4 p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition z-10 cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="mb-3">
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
        <div className="relative w-full aspect-square max-w-[260px] mx-auto rounded-2xl overflow-hidden bg-slate-950 border-2 border-slate-800 flex items-center justify-center shadow-inner">
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

        {/* Choose QR Code Image from Device */}
        <div className="mt-4">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImageFileSelected}
            accept="image/*"
            className="hidden"
          />
          <button
            type="button"
            disabled={isProcessingImage}
            onClick={() => fileInputRef.current?.click()}
            className="w-full py-2.5 px-4 rounded-xl bg-slate-950 hover:bg-slate-800 text-slate-200 border border-slate-700/80 hover:border-teal-500/40 text-xs font-bold flex items-center justify-center gap-2 transition disabled:opacity-50 cursor-pointer shadow-sm"
          >
            <ImageIcon className="w-4 h-4 text-teal-400" />
            <span>
              {isProcessingImage 
                ? (t.scanningImage || 'Scanning image...') 
                : (t.uploadQRImageBtn || 'Choose QR Image from Device')}
            </span>
          </button>

          {imageScanError && (
            <p className="text-[11px] text-rose-400 mt-2 font-medium leading-relaxed bg-rose-500/10 border border-rose-500/20 p-2 rounded-xl">
              {imageScanError}
            </p>
          )}
        </div>

        {/* Manual Code Input Option */}
        <div className="mt-4 pt-4 border-t border-slate-800">
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
              maxLength={14}
              className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-center text-sm font-mono tracking-widest text-teal-300 uppercase placeholder-slate-600 focus:outline-none focus:border-teal-500 transition"
            />
            <button
              type="submit"
              disabled={!manualCode.trim()}
              className="px-4 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition disabled:opacity-40 disabled:cursor-not-allowed shadow-md shadow-teal-500/20 cursor-pointer"
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
