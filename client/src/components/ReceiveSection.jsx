import React, { useState, useEffect } from 'react';
import { 
  Download, 
  Archive, 
  Image as ImageIcon, 
  FileText, 
  Film, 
  Music, 
  File, 
  Lock, 
  Clock, 
  User, 
  Eye, 
  Layers, 
  AlertCircle, 
  CheckCircle2, 
  QrCode,
  ArrowLeft,
  BookmarkPlus,
  Check
} from 'lucide-react';
import ImageLightbox from './ImageLightbox';

export default function ReceiveSection({ code, t, onGoBack, onShowQR }) {
  const [share, setShare] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isPasswordRequired, setIsPasswordRequired] = useState(false);
  const [password, setPassword] = useState('');
  const [downloadToken, setDownloadToken] = useState('');
  const [isClaimed, setIsClaimed] = useState(false);
  const [claimLoading, setClaimLoading] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [lightboxIndex, setLightboxIndex] = useState(-1);

  const fetchShare = async (unlockPassword = null) => {
    setLoading(true);
    setError('');
    setPasswordError('');
    try {
      let url = `/api/shares/${code}`;
      if (unlockPassword) {
        url += `?password=${encodeURIComponent(unlockPassword)}`;
      }

      const token = localStorage.getItem('qr_token');
      const headers = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch(url, { headers });
      const data = await res.json();


      if (res.status === 401 && data.isPasswordProtected) {
        setIsPasswordRequired(true);
        setShare({
          title: data.title,
          senderName: data.senderName,
          code: data.code,
          fileCount: data.fileCount,
          totalSize: data.totalSize,
        });
        setLoading(false);
        return;
      }

      if (!res.ok) {
        if (res.status === 403) {
          setPasswordError(t.wrongPassword);
          setLoading(false);
          return;
        }
        throw new Error(data.error || 'Failed to load files.');
      }

      setShare(data.share);
      setIsClaimed(Boolean(data.isClaimed));
      if (data.downloadToken) {
        setDownloadToken(data.downloadToken);
      }
      setIsPasswordRequired(false);
    } catch (err) {
      setError(err.message || 'Error fetching transfer');
    } finally {
      setLoading(false);
    }
  };

  const handleClaimToggle = async () => {
    const token = localStorage.getItem('qr_token');
    if (!token) {
      alert(t.loginToClaimTransfer || 'Please sign in with Google to save this transfer to your history.');
      return;
    }

    setClaimLoading(true);
    try {
      const endpoint = isClaimed ? `/api/shares/${code}/unclaim` : `/api/shares/${code}/claim`;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (res.ok) {
        setIsClaimed(Boolean(data.isClaimed));
      }
    } catch (e) {
      console.warn('Claim toggle error:', e);
    } finally {
      setClaimLoading(false);
    }
  };

  useEffect(() => {
    if (code) {
      fetchShare();
    }
  }, [code]);

  const handleUnlock = (e) => {
    e.preventDefault();
    if (!password.trim()) return;
    fetchShare(password.trim());
  };

  const formatFileSize = (bytes) => {
    if (!bytes || bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (file) => {
    if (file.isImage || file.mimetype?.startsWith('image/')) return <ImageIcon className="w-5 h-5 text-teal-400" />;
    if (file.mimetype?.startsWith('video/')) return <Film className="w-5 h-5 text-purple-400" />;
    if (file.mimetype?.startsWith('audio/')) return <Music className="w-5 h-5 text-pink-400" />;
    if (file.mimetype?.includes('pdf') || file.mimetype?.includes('document')) return <FileText className="w-5 h-5 text-blue-400" />;
    if (file.mimetype?.includes('zip') || file.mimetype?.includes('rar')) return <Archive className="w-5 h-5 text-amber-400" />;
    return <File className="w-5 h-5 text-slate-400" />;
  };

  const imageFiles = share?.files?.filter((f) => f.isImage || f.mimetype?.startsWith('image/')) || [];
  const otherFiles = share?.files?.filter((f) => !(f.isImage || f.mimetype?.startsWith('image/'))) || [];

  if (loading) {
    return (
      <div className="max-w-xl mx-auto py-20 text-center space-y-4">
        <div className="w-12 h-12 mx-auto rounded-full border-4 border-teal-500/20 border-t-teal-400 animate-spin" />
        <p className="text-sm font-semibold text-slate-300">Loading shared files...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-md mx-auto py-16 text-center space-y-4">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-white">{error}</h2>
        <p className="text-xs text-slate-400">
          {error.includes('expired') ? t.transferExpired : t.transferNotFound}
        </p>
        <button
          onClick={onGoBack}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Home</span>
        </button>
      </div>
    );
  }

  // Password Lock Screen
  if (isPasswordRequired) {
    return (
      <div className="max-w-md mx-auto py-12 px-4 text-center">
        <div className="p-6 sm:p-8 rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl space-y-5">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <Lock className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">{t.enterPasswordToUnlock}</h2>
            <p className="text-xs text-slate-400 mt-1">{t.enterPasswordSubtitle}</p>
          </div>

          {passwordError && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center justify-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{passwordError}</span>
            </div>
          )}

          <form onSubmit={handleUnlock} className="space-y-3">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter transfer password"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-center text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 transition"
              autoFocus
            />
            <button
              type="submit"
              className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-teal-500 text-slate-950 font-bold text-sm shadow-lg shadow-amber-500/20 hover:opacity-95 transition"
            >
              {t.unlockButton}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      
      {/* Top Banner with Transfer Info */}
      <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-md bg-teal-500/10 text-teal-400 border border-teal-500/30 text-[11px] font-mono font-bold tracking-wider uppercase">
                {share.code}
              </span>
              <span className="text-xs text-slate-400">
                {formatFileSize(share.totalSize)} • {share.files?.length || 0} {t.filesCount}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white mt-1">
              {share.title}
            </h1>
            {share.note && (
              <p className="text-xs text-slate-300 bg-slate-950/60 p-3 rounded-xl border border-slate-800/80 mt-2 max-w-xl">
                "{share.note}"
              </p>
            )}
          </div>

          {/* Action buttons (Download All, Claim to History & Show QR) */}
          <div className="flex flex-wrap items-center gap-2.5">
            {share.qrDataUrl && onShowQR && (
              <button
                type="button"
                onClick={() => onShowQR(share)}
                className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition cursor-pointer"
              >
                <QrCode className="w-4 h-4 text-teal-400" />
                <span>QR Code</span>
              </button>
            )}

            {/* Claim / Save to My History Button */}
            <button
              type="button"
              onClick={handleClaimToggle}
              disabled={claimLoading}
              className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-bold border transition cursor-pointer ${
                isClaimed
                  ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/25'
                  : 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-750 hover:border-teal-500'
              }`}
              title={isClaimed ? (t.unclaimTransferTip || "Click to remove from your history") : (t.claimTransferTip || "Save this transfer to your permanent history")}
            >
              {isClaimed ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>{t.claimedBadge || 'Saved in History'}</span>
                </>
              ) : (
                <>
                  <BookmarkPlus className="w-4 h-4 text-teal-400" />
                  <span>{t.claimTransferBtn || 'Claim & Save to History'}</span>
                </>
              )}
            </button>

            <a
              href={`/api/shares/${share.code}/download-all${downloadToken ? '?token=' + downloadToken : ''}`}
              download
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-slate-950 text-xs font-extrabold shadow-lg shadow-teal-500/20 transition cursor-pointer"
            >
              <Archive className="w-4 h-4" />
              <span>{t.downloadAllZip}</span>
            </a>
          </div>
        </div>


        {/* Metadata stats bar */}
        <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400 pt-3 border-t border-slate-800/80">
          <div className="flex items-center gap-1.5">
            <User className="w-3.5 h-3.5 text-teal-400" />
            <span>{t.fromSender}: <strong className="text-slate-200">{share.senderName}</strong></span>
          </div>
          {share.expiresAt && (
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              <span>{t.expiresOn}: <span className="text-slate-300">{new Date(share.expiresAt).toLocaleDateString()}</span></span>
            </div>
          )}
          <div className="flex items-center gap-1.5 ml-auto">
            <Download className="w-3.5 h-3.5 text-emerald-400" />
            <span>{share.downloads || 0} {t.downloadsCount}</span>
          </div>
        </div>
      </div>

      {/* Photos Grid Section */}
      {imageFiles.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <ImageIcon className="w-4 h-4 text-teal-400" />
            <span>{t.previewImage} ({imageFiles.length})</span>
          </h3>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {imageFiles.map((img, idx) => (
              <div 
                key={img.id}
                className="group relative aspect-square rounded-2xl overflow-hidden bg-transparency-grid border border-slate-800 hover:border-teal-500/50 transition cursor-pointer flex items-center justify-center"
                onClick={() => setLightboxIndex(idx)}
              >
                <ImageIcon className="w-8 h-8 text-teal-400/40 absolute pointer-events-none" />
                <img
                  src={`/api/shares/${share.code}/preview/${img.id}${downloadToken ? '?token=' + downloadToken : ''}`}
                  alt={img.originalName}
                  className="w-full h-full object-cover group-hover:scale-105 transition duration-300 relative z-10"
                  loading="lazy"
                  onError={(e) => {
                    // If preview fails, show a clean background fallback
                    e.target.style.opacity = '0';
                  }}
                />

                {/* Hover overlay with action buttons */}
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity p-3 flex flex-col justify-between">
                  <div className="self-end">
                    <span className="p-1.5 rounded-lg bg-slate-900/80 text-teal-300 border border-slate-700 flex items-center justify-center">
                      <Eye className="w-3.5 h-3.5" />
                    </span>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold text-white truncate">{img.originalName}</p>
                    <p className="text-[10px] text-slate-300">{formatFileSize(img.size)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Other Files / Full File List */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <Layers className="w-4 h-4 text-teal-400" />
          <span>{t.selectedFiles} ({share.files?.length || 0})</span>
        </h3>

        <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden divide-y divide-slate-800/80">
          {share.files?.map((file) => (
            <div
              key={file.id}
              className="p-3.5 sm:p-4 flex items-center justify-between gap-3 hover:bg-slate-850/50 transition"
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 shrink-0">
                  {getFileIcon(file)}
                </div>
                <div className="min-w-0">
                  <p className="text-xs sm:text-sm font-semibold text-white truncate max-w-[220px] sm:max-w-md">
                    {file.originalName}
                  </p>
                  <p className="text-[11px] text-slate-400">
                    {formatFileSize(file.size)}
                  </p>
                </div>
              </div>

              <a
                href={`/api/shares/${share.code}/download/${file.id}${downloadToken ? '?token=' + downloadToken : ''}`}
                download
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-teal-500 hover:text-slate-950 text-slate-200 text-xs font-bold border border-slate-700 transition cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{t.downloadSingle}</span>
              </a>
            </div>
          ))}
        </div>
      </div>

      {/* Lightbox Component */}
      <ImageLightbox
        images={imageFiles}
        currentIndex={lightboxIndex}
        isOpen={lightboxIndex >= 0}
        onClose={() => setLightboxIndex(-1)}
        onNavigate={(newIdx) => setLightboxIndex(newIdx)}
        shareCode={share.code}
        customPreviewUrl={(file) => `/api/shares/${share.code}/preview/${file.id}${downloadToken ? '?token=' + downloadToken : ''}`}
        customDownloadUrl={(file) => `/api/shares/${share.code}/download/${file.id}${downloadToken ? '?token=' + downloadToken : ''}`}
        t={t}
      />



    </div>
  );
}
