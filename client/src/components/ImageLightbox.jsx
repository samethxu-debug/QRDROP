import React, { useState, useEffect } from 'react';
import { 
  X, 
  Download, 
  ChevronLeft, 
  ChevronRight, 
  Sun, 
  Moon, 
  Grid, 
  AlertCircle, 
  Image as ImageIcon,
  RefreshCw 
} from 'lucide-react';

export default function ImageLightbox({ 
  images, 
  currentIndex, 
  isOpen, 
  onClose, 
  onNavigate, 
  shareCode, 
  customPreviewUrl, 
  customDownloadUrl,
  t = {} 
}) {
  const [bgMode, setBgMode] = useState('grid'); // 'grid' | 'light' | 'dark'
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!isOpen) return;
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight' && currentIndex < images.length - 1) onNavigate(currentIndex + 1);
      if (e.key === 'ArrowLeft' && currentIndex > 0) onNavigate(currentIndex - 1);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, currentIndex, images.length, onClose, onNavigate]);

  // Reset loading and error when navigating to a new image
  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      setHasError(false);
    }
  }, [currentIndex, isOpen]);

  if (!isOpen || images.length === 0) return null;

  const currentImage = images[currentIndex];
  if (!currentImage) return null;

  const previewUrl = customPreviewUrl 
    ? customPreviewUrl(currentImage) 
    : `/api/shares/${shareCode}/preview/${currentImage.id}`;
    
  const downloadUrl = customDownloadUrl 
    ? customDownloadUrl(currentImage) 
    : `/api/shares/${shareCode}/download/${currentImage.id}`;

  const cycleBgMode = () => {
    if (bgMode === 'grid') setBgMode('light');
    else if (bgMode === 'light') setBgMode('dark');
    else setBgMode('grid');
  };

  const getBackdropClass = () => {
    if (bgMode === 'light') return 'bg-transparency-grid-light text-slate-900';
    if (bgMode === 'dark') return 'bg-slate-950 text-white';
    return 'bg-transparency-grid text-white'; // default checkered transparency
  };

  // Check if filename might be an unsupported preview format (e.g. .heic, .raw, .tiff)
  const ext = (currentImage.originalName || '').toLowerCase();
  const isVideo = currentImage.mimetype?.startsWith('video/') || ext.endsWith('.mp4') || ext.endsWith('.webm') || ext.endsWith('.mov') || ext.endsWith('.m4v') || ext.endsWith('.mkv');
  const isSpecialFormat = ext.endsWith('.heic') || ext.endsWith('.heif') || ext.endsWith('.raw') || ext.endsWith('.cr2') || ext.endsWith('.nef') || ext.endsWith('.tiff') || ext.endsWith('.tif') || ext.endsWith('.psd');

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/95 backdrop-blur-md animate-in fade-in duration-150 select-none"
      onClick={onClose}
    >
      {/* Top bar */}
      <div 
        className="absolute top-0 inset-x-0 p-4 flex items-center justify-between z-20 bg-gradient-to-b from-slate-950/90 via-slate-950/60 to-transparent"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-white text-xs sm:text-sm font-semibold truncate max-w-[200px] sm:max-w-md flex items-center gap-2">
          <ImageIcon className="w-4 h-4 text-teal-400 shrink-0" />
          <span className="truncate">{currentImage.originalName}</span>
          <span className="text-slate-400 font-mono shrink-0">({currentIndex + 1} / {images.length})</span>
        </div>

        <div className="flex items-center gap-2">
          {/* Background Mode Switcher (Checkerboard / Light / Dark) - only for images */}
          {!isVideo && (
            <button
              type="button"
              onClick={cycleBgMode}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700 text-xs font-semibold transition cursor-pointer"
              title={t.toggleBgTip || "Toggle background backdrop (useful for transparent PNGs)"}
            >
              {bgMode === 'grid' && (
                <>
                  <Grid className="w-3.5 h-3.5 text-teal-400" />
                  <span className="hidden sm:inline">{t.previewBgCheckerboard || "Checkerboard"}</span>
                </>
              )}
              {bgMode === 'light' && (
                <>
                  <Sun className="w-3.5 h-3.5 text-amber-400" />
                  <span className="hidden sm:inline">{t.previewBgLight || "Light"}</span>
                </>
              )}
              {bgMode === 'dark' && (
                <>
                  <Moon className="w-3.5 h-3.5 text-blue-400" />
                  <span className="hidden sm:inline">{t.previewBgDark || "Dark"}</span>
                </>
              )}
            </button>
          )}

          {/* Download Button */}
          <a
            href={downloadUrl}
            download
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-slate-950 font-bold text-xs shadow-lg shadow-teal-500/20 transition cursor-pointer"
            title="Download Original File"
          >
            <Download className="w-4 h-4 text-slate-950" />
            <span className="hidden sm:inline">{t.downloadSingle || "Download"}</span>
          </a>

          {/* Close Button */}
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-700 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Media Viewport */}
      <div 
        className="relative max-w-5xl max-h-[80vh] w-full p-4 flex items-center justify-center"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Loading Spinner */}
        {loading && !hasError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 z-10 pointer-events-none">
            <RefreshCw className="w-8 h-8 text-teal-400 animate-spin" />
            <p className="text-xs font-semibold text-slate-300">{t.imageLoading || "Loading media..."}</p>
          </div>
        )}

        {/* Error / Unsupported Format Card */}
        {hasError ? (
          <div className="p-8 max-w-md mx-auto text-center rounded-3xl bg-slate-900/90 border border-slate-800 space-y-4 shadow-2xl backdrop-blur-xl">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <AlertCircle className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white mb-1">
                {isSpecialFormat 
                  ? (t.unsupportedImagePreview || "Browser cannot display this format natively (e.g. .HEIC/.RAW)")
                  : (t.imageLoadError || "Unable to display preview")}
              </h3>
              <p className="text-xs text-slate-400">
                {currentImage.originalName}
              </p>
            </div>
            <a
              href={downloadUrl}
              download
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-gradient-to-r from-teal-500 to-emerald-500 text-slate-950 font-bold text-xs shadow-lg shadow-teal-500/20 hover:opacity-95 transition"
            >
              <Download className="w-4 h-4" />
              <span>{t.downloadToView || "Download Original File"}</span>
            </a>
          </div>
        ) : isVideo ? (
          <div className="relative p-2 rounded-2xl overflow-hidden shadow-2xl border border-slate-700/60 max-w-full max-h-[75vh] flex items-center justify-center bg-slate-950">
            <video
              key={previewUrl}
              src={previewUrl}
              controls
              autoPlay
              playsInline
              onLoadedData={() => setLoading(false)}
              onError={() => {
                setLoading(false);
                setHasError(true);
              }}
              className={`max-w-full max-h-[70vh] rounded-xl shadow-2xl transition duration-200 ${
                loading ? 'opacity-0 scale-95' : 'opacity-100 scale-100'
              }`}
            />
          </div>
        ) : (
          <div className={`relative p-2 rounded-2xl overflow-hidden shadow-2xl border border-slate-700/60 max-w-full max-h-[75vh] flex items-center justify-center ${getBackdropClass()}`}>
            <img
              key={previewUrl}
              src={previewUrl}
              alt={currentImage.originalName}
              onLoad={() => setLoading(false)}
              onError={() => {
                setLoading(false);
                setHasError(true);
              }}
              className={`max-w-full max-h-[70vh] object-contain rounded-xl transition duration-200 ${
                loading ? 'opacity-0 scale-95' : 'opacity-100 scale-100'
              }`}
            />
          </div>
        )}

        {/* Prev / Next buttons */}
        {currentIndex > 0 && (
          <button
            type="button"
            onClick={() => onNavigate(currentIndex - 1)}
            className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 p-3 rounded-2xl bg-slate-900/80 hover:bg-slate-900 text-white border border-slate-700/80 transition backdrop-blur-md shadow-xl hover:scale-105 cursor-pointer"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
        )}

        {currentIndex < images.length - 1 && (
          <button
            type="button"
            onClick={() => onNavigate(currentIndex + 1)}
            className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 p-3 rounded-2xl bg-slate-900/80 hover:bg-slate-900 text-white border border-slate-700/80 transition backdrop-blur-md shadow-xl hover:scale-105 cursor-pointer"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        )}
      </div>

      {/* Bottom thumbnails strip if multiple */}
      {images.length > 1 && (
        <div 
          className="absolute bottom-4 inset-x-0 flex justify-center gap-2 overflow-x-auto p-2 z-20"
          onClick={(e) => e.stopPropagation()}
        >
          {images.map((img, idx) => {
            const thumbUrl = customPreviewUrl 
              ? customPreviewUrl(img) 
              : `/api/shares/${shareCode}/preview/${img.id}`;

            return (
              <button
                key={img.id}
                type="button"
                onClick={() => onNavigate(idx)}
                className={`w-14 h-14 rounded-xl overflow-hidden border-2 transition shrink-0 bg-transparency-grid relative cursor-pointer ${
                  idx === currentIndex 
                    ? 'border-teal-400 scale-105 ring-2 ring-teal-400/40' 
                    : 'border-slate-800 opacity-60 hover:opacity-100'
                }`}
              >
                <img
                  src={thumbUrl}
                  alt={img.originalName}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.target.style.display = 'none';
                  }}
                />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

