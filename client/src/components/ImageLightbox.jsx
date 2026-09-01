import React, { useEffect } from 'react';
import { X, Download, ChevronLeft, ChevronRight } from 'lucide-react';

export default function ImageLightbox({ images, currentIndex, isOpen, onClose, onNavigate, shareCode, customPreviewUrl, customDownloadUrl }) {
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

  if (!isOpen || images.length === 0) return null;

  const currentImage = images[currentIndex];
  if (!currentImage) return null;

  const previewUrl = customPreviewUrl ? customPreviewUrl(currentImage) : `/api/shares/${shareCode}/preview/${currentImage.id}`;
  const downloadUrl = customDownloadUrl ? customDownloadUrl(currentImage) : `/api/shares/${shareCode}/download/${currentImage.id}`;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/95 backdrop-blur-md animate-in fade-in duration-150"
      onClick={onClose}
    >
      {/* Top bar */}
      <div 
        className="absolute top-0 inset-x-0 p-4 flex items-center justify-between z-10 bg-gradient-to-b from-slate-950/80 to-transparent"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-white text-xs font-semibold truncate max-w-md">
          <span>{currentImage.originalName}</span>
          <span className="text-slate-400 ml-2">({currentIndex + 1} / {images.length})</span>
        </div>

        <div className="flex items-center gap-2">
          <a
            href={downloadUrl}
            download
            className="p-2.5 rounded-xl bg-slate-850 hover:bg-slate-800 text-teal-400 hover:text-teal-300 border border-slate-700 transition"
            title="Download Image"
          >
            <Download className="w-4 h-4" />
          </a>
          <button
            onClick={onClose}
            className="p-2.5 rounded-xl bg-slate-850 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-700 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Image container */}
      <div 
        className="relative max-w-5xl max-h-[85vh] p-4 flex items-center justify-center"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={previewUrl}
          alt={currentImage.originalName}
          className="max-w-full max-h-[80vh] object-contain rounded-2xl shadow-2xl border border-slate-800"
        />

        {/* Prev / Next buttons */}
        {currentIndex > 0 && (
          <button
            onClick={() => onNavigate(currentIndex - 1)}
            className="absolute left-2 top-1/2 -translate-y-1/2 p-3 rounded-2xl bg-slate-900/80 hover:bg-slate-900 text-white border border-slate-800 transition backdrop-blur-md shadow-xl"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
        )}

        {currentIndex < images.length - 1 && (
          <button
            onClick={() => onNavigate(currentIndex + 1)}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-3 rounded-2xl bg-slate-900/80 hover:bg-slate-900 text-white border border-slate-800 transition backdrop-blur-md shadow-xl"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        )}
      </div>

      {/* Bottom thumbnails strip if multiple */}
      {images.length > 1 && (
        <div 
          className="absolute bottom-4 inset-x-0 flex justify-center gap-2 overflow-x-auto p-2"
          onClick={(e) => e.stopPropagation()}
        >
          {images.map((img, idx) => (
            <button
              key={img.id}
              onClick={() => onNavigate(idx)}
              className={`w-12 h-12 rounded-lg overflow-hidden border-2 transition shrink-0 ${
                idx === currentIndex ? 'border-teal-400 scale-105' : 'border-slate-800 opacity-60 hover:opacity-100'
              }`}
            >
              <img
                src={`/api/shares/${shareCode}/preview/${img.id}`}
                alt={img.originalName}
                className="w-full h-full object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
