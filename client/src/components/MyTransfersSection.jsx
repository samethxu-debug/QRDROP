import React, { useState, useEffect } from 'react';
import { 
  FolderArchive, 
  QrCode, 
  Trash2, 
  Download, 
  Clock, 
  Layers, 
  ExternalLink, 
  LogIn, 
  AlertCircle,
  Copy,
  Check,
  Eye,
  Image as ImageIcon,
  Film,
  Lock
} from 'lucide-react';
import ImageLightbox from './ImageLightbox';

export default function MyTransfersSection({ user, onOpenAuth, onShowQR, onOpenReceive, t }) {
  const [transfers, setTransfers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copiedCode, setCopiedCode] = useState(null);
  const [lightboxShare, setLightboxShare] = useState(null);
  const [lightboxIndex, setLightboxIndex] = useState(-1);


  const fetchTransfers = async () => {
    if (!user) return;
    setLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('qr_token');
      const res = await fetch('/api/shares/my-shares', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load transfers');
      setTransfers(data.shares || []);
    } catch (err) {
      setError(err.message || 'Error fetching transfers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransfers();
  }, [user]);

  const handleDelete = async (code) => {
    if (!window.confirm(t.confirmDelete)) return;

    try {
      const token = localStorage.getItem('qr_token');
      const res = await fetch(`/api/shares/${code}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete');
      }
      setTransfers((prev) => prev.filter((s) => s.code !== code));
    } catch (err) {
      alert(err.message || 'Failed to delete transfer');
    }
  };

  const handleCopy = (code) => {
    const url = `${window.location.origin}/receive/${code}`;
    navigator.clipboard.writeText(url);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const formatFileSize = (bytes) => {
    if (!bytes || bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // If not logged in
  if (!user) {
    return (
      <div className="max-w-md mx-auto py-16 px-4 text-center">
        <div className="p-8 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400">
            <FolderArchive className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-white">{t.myTransfersTitle}</h2>
          <p className="text-xs text-slate-400">{t.loginToViewTransfers}</p>
          <button
            onClick={() => onOpenAuth('login')}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 text-slate-950 font-bold text-xs shadow-lg shadow-teal-500/20 hover:opacity-90 transition cursor-pointer"
          >
            <LogIn className="w-4 h-4" />
            <span>{t.login}</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white flex items-center gap-2.5">
            <FolderArchive className="w-6 h-6 text-teal-400" />
            <span>{t.myTransfersTitle}</span>
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            {t.myTransfersSubtitle}
          </p>
        </div>
        <div className="text-xs font-semibold text-teal-400 bg-teal-500/10 px-3 py-1.5 rounded-xl border border-teal-500/20 self-start">
          {transfers.length} {t.filesCount} Total
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="py-20 text-center space-y-3">
          <div className="w-10 h-10 mx-auto rounded-full border-4 border-teal-500/20 border-t-teal-400 animate-spin" />
          <p className="text-xs text-slate-400">Loading your transfers...</p>
        </div>
      ) : transfers.length === 0 ? (
        <div className="py-16 text-center space-y-3 bg-slate-900/60 rounded-3xl border border-slate-800">
          <FolderArchive className="w-12 h-12 mx-auto text-slate-600" />
          <p className="text-sm font-semibold text-slate-300">{t.noTransfers}</p>
          <p className="text-xs text-slate-500 max-w-xs mx-auto">
            Uploaded photos and files will be organized and saved here automatically.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {transfers.map((item) => {
            const isExpired = item.expiresAt && new Date(item.expiresAt) < new Date();
            const mediaFiles = item.files?.filter((f) => f.isImage || f.mimetype?.startsWith('image/') || f.mimetype?.startsWith('video/')) || [];

            return (
              <div
                key={item.id}
                className="p-5 rounded-3xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition space-y-3 relative group shadow-xl"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="px-2 py-0.5 rounded-md bg-slate-950 text-teal-300 font-mono text-[11px] font-bold border border-slate-800">
                        {item.code}
                      </span>
                      {isExpired ? (
                        <span className="px-2 py-0.5 rounded-md bg-rose-500/10 text-rose-400 text-[10px] font-bold border border-rose-500/30">
                          {t.statusExpired}
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 text-[10px] font-bold border border-emerald-500/30">
                          {t.statusActive}
                        </span>
                      )}
                      {item.isPasswordProtected && (
                        <span className="p-1 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/30" title="Password Protected">
                          <Lock className="w-3 h-3" />
                        </span>
                      )}
                    </div>
                    <h3 className="text-sm font-bold text-white truncate">
                      {item.title}
                    </h3>
                  </div>

                  <button
                    onClick={() => handleDelete(item.code)}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition cursor-pointer"
                    title={t.deleteTransfer}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Media Thumbnails Preview Strip (if media exists) */}
                {mediaFiles.length > 0 && (
                  <div className="flex items-center gap-2 overflow-x-auto py-1">
                    {mediaFiles.slice(0, 4).map((img, idx) => (
                      <div
                        key={img.id}
                        onClick={() => {
                          setLightboxShare(item);
                          setLightboxIndex(idx);
                        }}
                        className="group/thumb relative w-12 h-12 rounded-xl overflow-hidden bg-transparency-grid border border-slate-800 hover:border-teal-500 cursor-pointer shrink-0 transition"
                        title={img.originalName}
                      >
                        <img
                          src={`/api/shares/${item.code}/preview/${img.id}`}
                          alt={img.originalName}
                          className="w-full h-full object-cover group-hover/thumb:scale-110 transition duration-200"
                          onError={(e) => {
                            e.target.style.opacity = '0';
                          }}
                        />
                        <div className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover/thumb:opacity-100 transition flex items-center justify-center text-teal-300">
                          <Eye className="w-3.5 h-3.5" />
                        </div>
                      </div>
                    ))}
                    {mediaFiles.length > 4 && (
                      <button
                        onClick={() => {
                          setLightboxShare(item);
                          setLightboxIndex(0);
                        }}
                        className="w-12 h-12 rounded-xl bg-slate-950 border border-slate-800 text-xs font-bold text-teal-400 hover:text-white flex items-center justify-center shrink-0 hover:border-teal-500 transition cursor-pointer"
                      >
                        +{mediaFiles.length - 4}
                      </button>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-400 bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80">
                  <div className="flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-teal-400" />
                    <span>{item.files?.length || 0} Files ({formatFileSize(item.totalSize)})</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Download className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{item.downloads || 0} Downloads</span>
                  </div>
                  <div className="col-span-2 flex items-center gap-1.5 pt-1 border-t border-slate-800/60">
                    <Clock className="w-3.5 h-3.5 text-amber-400" />
                    <span>{new Date(item.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={() => onShowQR(item)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 text-xs font-semibold border border-slate-700 transition cursor-pointer"
                  >
                    <QrCode className="w-3.5 h-3.5 text-teal-400" />
                    <span>{t.viewQR}</span>
                  </button>

                  <button
                    onClick={() => handleCopy(item.code)}
                    className="p-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 border border-slate-700 transition cursor-pointer"
                    title="Copy Link"
                  >
                    {copiedCode === item.code ? (
                      <Check className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>

                  <button
                    onClick={() => onOpenReceive(item.code)}
                    className="p-2 rounded-xl bg-teal-500/10 hover:bg-teal-500/20 text-teal-400 border border-teal-500/30 transition cursor-pointer"
                    title="Open Receiver View"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </button>
                </div>

              </div>
            );
          })}
        </div>
      )}

      {/* Lightbox for previewing images/videos in history */}
      {lightboxShare && lightboxIndex >= 0 && (
        <ImageLightbox
          images={lightboxShare.files?.filter((f) => f.isImage || f.mimetype?.startsWith('image/') || f.mimetype?.startsWith('video/')) || []}
          currentIndex={lightboxIndex}
          isOpen={lightboxIndex >= 0}
          onClose={() => {
            setLightboxShare(null);
            setLightboxIndex(-1);
          }}
          onNavigate={(newIdx) => setLightboxIndex(newIdx)}
          shareCode={lightboxShare.code}
          t={t}
        />
      )}

    </div>
  );
}
