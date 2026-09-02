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
  Lock,
  Inbox,
  User,
  X,
  ArrowDownToLine,
  CheckCircle2
} from 'lucide-react';
import ImageLightbox from './ImageLightbox';

export default function MyTransfersSection({ user, onOpenAuth, onShowQR, onOpenReceive, t }) {
  const [transfers, setTransfers] = useState([]);
  const [inboxTransfers, setInboxTransfers] = useState([]);
  const [filterTab, setFilterTab] = useState('all'); // 'all' | 'needs_review' | 'shares' | 'inbox'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copiedCode, setCopiedCode] = useState(null);
  const [lightboxShare, setLightboxShare] = useState(null);
  const [lightboxIndex, setLightboxIndex] = useState(-1);
  const [reviewModalTransfer, setReviewModalTransfer] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

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
      setInboxTransfers(data.inboxTransfers || []);
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

  // Host confirms transfer from History
  const handleConfirmInboxTransfer = async (transfer) => {
    if (!transfer?.inboxId || !transfer?.transferId) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/inbox/${transfer.inboxId}/confirm/${transfer.transferId}`, {
        method: 'POST',
      });
      const data = await res.json();

      if (res.ok && data.downloadUrl) {
        setStatusMessage(t.transferAcceptedAndSaved || 'Transfer accepted! Saving to device...');

        // Trigger automatic browser download
        const link = document.createElement('a');
        link.href = data.downloadUrl;
        link.setAttribute('download', '');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        // Update transfer status in local state
        setInboxTransfers((prev) =>
          prev.map((item) =>
            item.transferId === transfer.transferId ? { ...item, status: 'accepted' } : item
          )
        );

        setReviewModalTransfer(null);
        setTimeout(() => setStatusMessage(''), 4000);
      }
    } catch (err) {
      console.warn('Confirm error:', err);
    } finally {
      setActionLoading(false);
    }
  };

  // Host rejects transfer from History
  const handleRejectInboxTransfer = async (transfer) => {
    if (!transfer?.inboxId || !transfer?.transferId) return;
    setActionLoading(true);
    try {
      await fetch(`/api/inbox/${transfer.inboxId}/reject/${transfer.transferId}`, {
        method: 'POST',
      });
      setInboxTransfers((prev) =>
        prev.filter((item) => item.transferId !== transfer.transferId)
      );
      setReviewModalTransfer(null);
    } catch (err) {
      console.warn('Reject error:', err);
    } finally {
      setActionLoading(false);
    }
  };

  // Pending transfers count that require user review
  const pendingReviewTransfers = inboxTransfers.filter((t) => t.status === 'pending_approval');

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

  // Filtered items
  const filteredShares = filterTab === 'all' || filterTab === 'shares' ? transfers : [];
  const filteredInbox =
    filterTab === 'all'
      ? inboxTransfers
      : filterTab === 'needs_review'
      ? pendingReviewTransfers
      : filterTab === 'inbox'
      ? inboxTransfers
      : [];

  const totalCount = transfers.length + inboxTransfers.length;

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
          {totalCount} {t.filesCount} Total
        </div>
      </div>

      {statusMessage && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>{statusMessage}</span>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      {/* Prominent Needs User Review Alert Banner */}
      {pendingReviewTransfers.length > 0 && (
        <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-r from-amber-500/15 via-slate-900 to-teal-500/15 border-2 border-amber-500/40 text-amber-300 shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <span className="relative flex h-3.5 w-3.5 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-amber-500"></span>
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-lg bg-amber-500 text-slate-950 font-extrabold text-[10px] uppercase tracking-wider">
                  {t.needsReviewBadge || 'Needs Review'} ({pendingReviewTransfers.length})
                </span>
                <span className="font-bold text-white text-sm">
                  {pendingReviewTransfers[0].title}
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1">
                {t.pendingReviewBanner || 'Incoming transfer: Please review files before accepting'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setReviewModalTransfer(pendingReviewTransfers[0])}
            className="w-full sm:w-auto px-5 py-2.5 rounded-2xl bg-gradient-to-r from-amber-500 to-teal-500 hover:from-amber-400 hover:to-teal-400 text-slate-950 font-black text-xs shadow-lg shadow-amber-500/20 hover:scale-105 transition cursor-pointer flex items-center justify-center gap-2 shrink-0"
          >
            <Eye className="w-4 h-4" />
            <span>{t.reviewAndConfirmBtn || 'Review & Confirm'}</span>
          </button>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <button
          onClick={() => setFilterTab('all')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 ${
            filterTab === 'all'
              ? 'bg-teal-500 text-slate-950'
              : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          All ({totalCount})
        </button>

        {pendingReviewTransfers.length > 0 && (
          <button
            onClick={() => setFilterTab('needs_review')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 flex items-center gap-1.5 ${
              filterTab === 'needs_review'
                ? 'bg-amber-500 text-slate-950'
                : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
            <span>{t.needsReviewBadge || 'Needs Review'} ({pendingReviewTransfers.length})</span>
          </button>
        )}

        <button
          onClick={() => setFilterTab('shares')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 ${
            filterTab === 'shares'
              ? 'bg-teal-500 text-slate-950'
              : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          QR Shares ({transfers.length})
        </button>

        <button
          onClick={() => setFilterTab('inbox')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 ${
            filterTab === 'inbox'
              ? 'bg-teal-500 text-slate-950'
              : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          Inbox Requests ({inboxTransfers.length})
        </button>
      </div>

      {loading ? (
        <div className="py-20 text-center space-y-3">
          <div className="w-10 h-10 mx-auto rounded-full border-4 border-teal-500/20 border-t-teal-400 animate-spin" />
          <p className="text-xs text-slate-400">Loading your transfers...</p>
        </div>
      ) : filteredShares.length === 0 && filteredInbox.length === 0 ? (
        <div className="py-16 text-center space-y-3 bg-slate-900/60 rounded-3xl border border-slate-800">
          <FolderArchive className="w-12 h-12 mx-auto text-slate-600" />
          <p className="text-sm font-semibold text-slate-300">{t.noTransfers}</p>
          <p className="text-xs text-slate-500 max-w-xs mx-auto">
            Uploaded photos and files will be organized and saved here automatically.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          
          {/* 1. Pending & Accepted Inbox Transfers */}
          {filteredInbox.map((item) => {
            const isPending = item.status === 'pending_approval';
            const isAccepted = item.status === 'accepted';
            const mediaFiles = item.files?.filter((f) => f.isImage || f.mimetype?.startsWith('image/') || f.mimetype?.startsWith('video/')) || [];

            return (
              <div
                key={item.transferId}
                className={`p-5 rounded-3xl bg-slate-900 border transition space-y-3 relative group shadow-xl ${
                  isPending ? 'border-amber-500/50 bg-amber-950/10' : 'border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="px-2 py-0.5 rounded-md bg-slate-950 text-teal-300 font-mono text-[11px] font-bold border border-slate-800">
                        {item.inboxId}
                      </span>
                      {isPending && (
                        <span className="px-2 py-0.5 rounded-md bg-amber-500 text-slate-950 text-[10px] font-extrabold uppercase flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-950 animate-ping" />
                          <span>{t.needsReviewBadge || 'Needs Review'}</span>
                        </span>
                      )}
                      {isAccepted && (
                        <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 text-[10px] font-bold border border-emerald-500/30">
                          {t.statusAcceptedBadge || 'Accepted & Saved'}
                        </span>
                      )}
                    </div>
                    <h3 className="text-sm font-bold text-white truncate">
                      {item.title}
                    </h3>
                  </div>

                  {isPending && (
                    <button
                      onClick={() => handleRejectInboxTransfer(item)}
                      disabled={actionLoading}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition cursor-pointer"
                      title={t.declineTransfer || 'Decline'}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Media Thumbnails Preview Strip */}
                {mediaFiles.length > 0 && (
                  <div className="flex items-center gap-2 overflow-x-auto py-1">
                    {mediaFiles.slice(0, 4).map((img, idx) => (
                      <div
                        key={img.id}
                        onClick={() => {
                          setLightboxShare({
                            code: item.inboxId,
                            files: mediaFiles,
                            customPreviewUrl: (f) => `/api/inbox/${item.inboxId}/preview/${f.id}`,
                            customDownloadUrl: (f) => `/api/inbox/${item.inboxId}/download/${item.transferId}`,
                          });
                          setLightboxIndex(idx);
                        }}
                        className="group/thumb relative w-12 h-12 rounded-xl overflow-hidden bg-transparency-grid border border-slate-800 hover:border-teal-500 cursor-pointer shrink-0 transition"
                        title={img.originalName}
                      >
                        <img
                          src={`/api/inbox/${item.inboxId}/preview/${img.id}`}
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
                        onClick={() => setReviewModalTransfer(item)}
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
                    <User className="w-3.5 h-3.5 text-purple-400" />
                    <span>From: {item.senderName}</span>
                  </div>
                  <div className="col-span-2 flex items-center gap-1.5 pt-1 border-t border-slate-800/60">
                    <Clock className="w-3.5 h-3.5 text-amber-400" />
                    <span>{new Date(item.sentAt || Date.now()).toLocaleDateString()}</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 pt-1">
                  {isPending ? (
                    <button
                      onClick={() => setReviewModalTransfer(item)}
                      className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-teal-500 hover:from-amber-400 hover:to-teal-400 text-slate-950 font-black text-xs shadow-lg shadow-amber-500/20 transition flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Eye className="w-4 h-4" />
                      <span>{t.reviewAndConfirmBtn || 'Review & Confirm'}</span>
                    </button>
                  ) : (
                    <a
                      href={`/api/inbox/${item.inboxId}/download/${item.transferId}`}
                      download
                      className="w-full py-2 px-3 rounded-xl bg-slate-800 hover:bg-teal-500 hover:text-slate-950 text-slate-200 text-xs font-bold border border-slate-700 transition flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <ArrowDownToLine className="w-4 h-4" />
                      <span>{t.downloadSingle || 'Download'}</span>
                    </a>
                  )}
                </div>

              </div>
            );
          })}

          {/* 2. Standard QR Shares */}
          {filteredShares.map((item) => {
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

                {/* Media Thumbnails Preview Strip */}
                {mediaFiles.length > 0 && (
                  <div className="flex items-center gap-2 overflow-x-auto py-1">
                    {mediaFiles.slice(0, 4).map((img, idx) => (
                      <div
                        key={img.id}
                        onClick={() => {
                          setLightboxShare({
                            code: item.code,
                            files: mediaFiles,
                          });
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
                          setLightboxShare({
                            code: item.code,
                            files: mediaFiles,
                          });
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

      {/* Review Modal for Pending Inbox Transfers */}
      {reviewModalTransfer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
          <div 
            className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl p-6 sm:p-7 overflow-hidden space-y-4 max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-3 border-b border-slate-800 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-md bg-amber-500 text-slate-950 text-[10px] font-extrabold uppercase">
                    {t.needsReviewBadge || 'Needs Review'}
                  </span>
                  <span className="text-xs font-mono text-slate-400">
                    {reviewModalTransfer.inboxId}
                  </span>
                </div>
                <h2 className="text-xl font-extrabold text-white mt-1">
                  {reviewModalTransfer.title}
                </h2>
                <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
                  <span>{t.fromSender}: <strong className="text-slate-200">{reviewModalTransfer.senderName}</strong></span>
                  <span>•</span>
                  <span>{reviewModalTransfer.files.length} {t.filesCount}</span>
                  <span>•</span>
                  <span>{formatFileSize(reviewModalTransfer.totalSize)}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setReviewModalTransfer(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Note / Message */}
            {reviewModalTransfer.note && (
              <p className="text-xs text-slate-300 bg-slate-950/70 p-3 rounded-2xl border border-slate-800 italic">
                "{reviewModalTransfer.note}"
              </p>
            )}

            {/* Previews Grid */}
            <div className="overflow-y-auto flex-1 space-y-3 pr-1">
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
                {t.previewImage || 'Preview Photos Before Accept'} ({reviewModalTransfer.files.length})
              </span>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {reviewModalTransfer.files.map((file, idx) => (
                  <div
                    key={file.id}
                    onClick={() => {
                      setLightboxShare({
                        code: reviewModalTransfer.inboxId,
                        files: reviewModalTransfer.files,
                        customPreviewUrl: (f) => `/api/inbox/${reviewModalTransfer.inboxId}/preview/${f.id}`,
                        customDownloadUrl: (f) => `/api/inbox/${reviewModalTransfer.inboxId}/download/${reviewModalTransfer.transferId}`,
                      });
                      setLightboxIndex(idx);
                    }}
                    className="group relative aspect-square rounded-2xl overflow-hidden bg-transparency-grid border border-slate-800 hover:border-teal-500/50 transition cursor-pointer flex items-center justify-center"
                  >
                    <ImageIcon className="w-8 h-8 text-teal-400/40 absolute pointer-events-none" />
                    <img
                      src={`/api/inbox/${reviewModalTransfer.inboxId}/preview/${file.id}`}
                      alt={file.originalName}
                      className="w-full h-full object-cover group-hover:scale-105 transition duration-200 relative z-10"
                      onError={(e) => {
                        e.target.style.opacity = '0';
                      }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity p-2.5 flex flex-col justify-between z-20">
                      <span className="self-end p-1 rounded-lg bg-slate-900/80 text-teal-300 border border-slate-700">
                        <Eye className="w-3 h-3" />
                      </span>
                      <p className="text-[10px] font-semibold text-white truncate">{file.originalName}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Modal Bottom Actions */}
            <div className="flex flex-col sm:flex-row items-center gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => handleRejectInboxTransfer(reviewModalTransfer)}
                disabled={actionLoading}
                className="w-full sm:w-auto px-5 py-3 rounded-2xl bg-slate-800 hover:bg-rose-500/20 text-slate-300 hover:text-rose-400 font-bold text-xs border border-slate-700 transition cursor-pointer"
              >
                {t.declineTransfer || 'Decline / Reject'}
              </button>

              <button
                type="button"
                onClick={() => handleConfirmInboxTransfer(reviewModalTransfer)}
                disabled={actionLoading}
                className="w-full sm:flex-1 py-3.5 px-6 rounded-2xl bg-gradient-to-r from-teal-500 via-emerald-500 to-teal-400 hover:from-teal-400 hover:to-emerald-300 text-slate-950 font-black text-sm shadow-xl shadow-teal-500/25 flex items-center justify-center gap-2 transition cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{actionLoading ? (t.processing || 'Processing...') : (t.confirmAndSaveToDevice || 'Confirm & Save to Device')}</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Lightbox for previewing images/videos in history */}
      {lightboxShare && lightboxIndex >= 0 && (
        <ImageLightbox
          images={lightboxShare.files || []}
          currentIndex={lightboxIndex}
          isOpen={lightboxIndex >= 0}
          onClose={() => {
            setLightboxShare(null);
            setLightboxIndex(-1);
          }}
          onNavigate={(newIdx) => setLightboxIndex(newIdx)}
          shareCode={lightboxShare.code}
          customPreviewUrl={lightboxShare.customPreviewUrl}
          customDownloadUrl={lightboxShare.customDownloadUrl}
          t={t}
        />
      )}

    </div>
  );
}
