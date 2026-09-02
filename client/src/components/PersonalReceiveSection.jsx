import React, { useState, useEffect, useRef } from 'react';
import {
  QrCode,
  Download,
  Check,
  X,
  Eye,
  Image as ImageIcon,
  FileText,
  Film,
  Music,
  Archive,
  File,
  ShieldCheck,
  Clock,
  User,
  Layers,
  ArrowDownToLine,
  RefreshCw,
  Sparkles,
  AlertCircle
} from 'lucide-react';
import ImageLightbox from './ImageLightbox';
import { safeFetchJson } from '../utils/api';

export default function PersonalReceiveSection({ user, t, onOpenAuth }) {
  const [inbox, setInbox] = useState(null);
  const [loading, setLoading] = useState(false);
  const [pendingTransfer, setPendingTransfer] = useState(null);
  const [acceptedTransfers, setAcceptedTransfers] = useState([]);
  const [actionLoading, setActionLoading] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(-1);
  const [statusMessage, setStatusMessage] = useState('');
  const [showReviewModal, setShowReviewModal] = useState(true);
  const pollTimerRef = useRef(null);

  // Initialize or generate a fresh unique Inbox
  const initInbox = async () => {
    if (!user) return;
    try {
      setLoading(true);
      const token = localStorage.getItem('qr_token');
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const hostName = user.name || 'Host Device';
      const res = await safeFetchJson('/api/inbox/create', {
        method: 'POST',
        headers,
        body: JSON.stringify({ hostName }),
      });

      if (res.ok && res.data.inbox) {
        setInbox(res.data.inbox);
      }
    } catch (err) {
      console.warn('Inbox init error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      initInbox();
    } else {
      setInbox(null);
    }
  }, [user]);

  // Polling for incoming pending transfers
  useEffect(() => {
    if (!inbox?.id) return;

    const checkInboxStatus = async () => {
      try {
        const res = await safeFetchJson(`/api/inbox/${inbox.id}/status`);
        if (res.ok && res.data.pendingTransfers) {
          const pending = res.data.pendingTransfers.find((t) => t.status === 'pending_approval');
          if (pending) {
            setPendingTransfer(pending);
          } else {
            setPendingTransfer(null);
          }

          // Track accepted transfers
          const accepted = res.data.pendingTransfers.filter((t) => t.status === 'accepted');
          setAcceptedTransfers(accepted);
        }
      } catch (err) {
        // quiet polling error
      }
    };

    pollTimerRef.current = setInterval(checkInboxStatus, 1500);

    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [inbox]);

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

  // Host confirms transfer: auto-downloads file/zip to host local device
  const handleConfirmTransfer = async (transfer) => {
    if (!inbox?.id || !transfer?.transferId) return;
    setActionLoading(true);
    try {
      const res = await safeFetchJson(`/api/inbox/${inbox.id}/confirm/${transfer.transferId}`, {
        method: 'POST',
      });
      const data = res.data;

      if (res.ok && data.downloadUrl) {
        setStatusMessage(t.transferAcceptedAndSaved || 'Transfer accepted! Saving to device...');

        // Trigger automatic browser download to local device
        const link = document.createElement('a');
        link.href = data.downloadUrl;
        link.setAttribute('download', '');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        setPendingTransfer(null);
        setTimeout(() => setStatusMessage(''), 4000);
      }
    } catch (err) {
      console.warn('Confirm error:', err);
    } finally {
      setActionLoading(false);
    }
  };

  // Host rejects transfer
  const handleRejectTransfer = async (transfer) => {
    if (!inbox?.id || !transfer?.transferId) return;
    setActionLoading(true);
    try {
      await fetch(`/api/inbox/${inbox.id}/reject/${transfer.transferId}`, {
        method: 'POST',
      });
      setPendingTransfer(null);
    } catch (err) {
      console.warn('Reject error:', err);
    } finally {
      setActionLoading(false);
    }
  };

  // If user is NOT logged in: Show Google Login Required screen
  if (!user) {
    return (
      <div className="max-w-xl mx-auto my-8 p-8 sm:p-10 rounded-3xl bg-slate-900 border border-slate-800 text-center space-y-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        <div className="w-16 h-16 mx-auto rounded-3xl bg-slate-950 border border-slate-800 flex items-center justify-center shadow-xl">
          <svg className="w-8 h-8" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
          </svg>
        </div>

        <div className="space-y-2">
          <h2 className="text-xl sm:text-2xl font-extrabold text-white">
            {t.loginRequiredForReceiveTitle || 'Google Login Required for Receive QR'}
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 max-w-md mx-auto">
            {t.loginRequiredForReceiveSubtitle || 'Please sign in with your Google account to create and activate your personal receive QR code.'}
          </p>
        </div>

        <div className="pt-2 flex justify-center">
          <button
            type="button"
            onClick={() => onOpenAuth && onOpenAuth()}
            className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-white hover:bg-slate-100 text-slate-900 font-black text-sm shadow-xl shadow-teal-500/10 flex items-center justify-center gap-3 transition cursor-pointer hover:scale-105"
          >
            <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
            </svg>
            <span>{t.signInWithGoogleBtn || 'Sign in with Google'}</span>
          </button>
        </div>
      </div>
    );
  }

  if (loading && !inbox) {
    return (
      <div className="max-w-md mx-auto py-20 text-center space-y-4">
        <div className="w-12 h-12 mx-auto rounded-full border-4 border-teal-500/20 border-t-teal-400 animate-spin" />
        <p className="text-sm font-semibold text-slate-300">
          {t.generatingPersonalQR || 'Generating your unique personal receive QR code...'}
        </p>
      </div>
    );
  }

  const imageFiles = pendingTransfer?.files?.filter((f) => f.isImage || f.mimetype?.startsWith('image/')) || [];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      
      {/* Header Banner */}
      <div className="text-center space-y-2 py-2">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-white">
          {t.personalReceiveTitle || 'Receive Files & Photos'}
        </h1>
        <p className="text-sm text-slate-400 max-w-lg mx-auto">
          {t.personalReceiveSubtitle || 'Show this QR code to any nearby phone or device so they can scan and send photos or folders directly to you.'}
        </p>
      </div>

      {statusMessage && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-sm flex items-center justify-center gap-2 animate-in fade-in">
          <Check className="w-5 h-5 text-emerald-400" />
          <span>{statusMessage}</span>
        </div>
      )}

      {/* Persistent Needs Review Notification Bar (When incoming transfer is pending approval) */}
      {pendingTransfer && (
        <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-r from-amber-500/15 via-slate-900 to-teal-500/15 border-2 border-amber-500/40 text-amber-300 shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-4 animate-in fade-in zoom-in-95">
          <div className="flex items-center gap-3.5">
            <span className="relative flex h-3.5 w-3.5 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-amber-500"></span>
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-lg bg-amber-500 text-slate-950 font-extrabold text-[10px] uppercase tracking-wider">
                  {t.needsReviewBadge || 'Needs Review'}
                </span>
                <span className="font-bold text-white text-sm">
                  {pendingTransfer.title}
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1">
                {t.pendingReviewBanner || 'Incoming transfer: Please review files before accepting'} ({pendingTransfer.files?.length} files • {formatFileSize(pendingTransfer.totalSize)} • {pendingTransfer.senderName})
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowReviewModal(true)}
            className="w-full sm:w-auto px-5 py-2.5 rounded-2xl bg-gradient-to-r from-amber-500 to-teal-500 hover:from-amber-400 hover:to-teal-400 text-slate-950 font-black text-xs shadow-lg shadow-amber-500/20 hover:scale-105 transition cursor-pointer flex items-center justify-center gap-2 shrink-0"
          >
            <Eye className="w-4 h-4" />
            <span>{t.reviewAndConfirmBtn || 'Review & Confirm'}</span>
          </button>
        </div>
      )}

      {/* Main Container */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        
        {/* Left: Personal Receive QR Code (6 cols) */}
        <div className="md:col-span-6 bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 text-center space-y-4 shadow-xl">
          
          <div className="inline-flex p-2.5 rounded-2xl bg-teal-500/10 border border-teal-500/20 text-teal-400">
            <QrCode className="w-6 h-6" />
          </div>

          <div>
            <h2 className="text-lg font-bold text-white">
              {t.myReceiveQR || 'My Receive QR Code'}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {t.waitingForSender || 'Waiting for other users to scan and send files...'}
            </p>
          </div>

          {/* QR Code Presentation */}
          <div className="relative inline-block p-4 rounded-3xl bg-white shadow-2xl shadow-teal-500/10 border-4 border-teal-500/20">
            {inbox?.qrDataUrl ? (
              <img
                src={inbox.qrDataUrl}
                alt="Receive QR Code"
                className="w-56 h-56 rounded-xl object-contain mx-auto"
              />
            ) : (
              <div className="w-56 h-56 flex items-center justify-center">
                <RefreshCw className="w-8 h-8 text-teal-500 animate-spin" />
              </div>
            )}
          </div>

          {/* Inbox Code Identifier & Refresh Button */}
          <div className="flex flex-col items-center gap-2">
            <div className="flex flex-col items-center">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                {t.inboxIdLabel || 'Inbox ID'}
              </span>
              <span className="text-lg font-mono font-bold tracking-widest text-teal-300 bg-slate-950 px-3.5 py-1 rounded-xl border border-slate-800 mt-1">
                {inbox?.id}
              </span>
            </div>

            {/* Refresh / Generate New QR Button */}
            <button
              type="button"
              disabled={loading}
              onClick={initInbox}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-950 hover:bg-slate-800 text-slate-300 hover:text-teal-300 border border-slate-800 text-xs font-semibold transition cursor-pointer mt-1"
              title="Generate a fresh new QR code"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-teal-400' : ''}`} />
              <span>{t.generateNewQR || 'Generate New QR Code'}</span>
            </button>
          </div>

        </div>


        {/* Right: Live Activity & Instructions (6 cols) */}
        <div className="md:col-span-6 space-y-4">
          
          {/* Live Status Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <span className="text-xs font-bold text-white flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                <span>{t.liveListener || 'Live Connection Active'}</span>
              </span>
              <span className="text-[11px] text-slate-400 font-mono">
                {inbox?.hostName}
              </span>
            </div>

            <div className="space-y-3 text-xs text-slate-300">
              <div className="flex items-start gap-2.5 p-3 rounded-2xl bg-slate-950/70 border border-slate-800">
                <div className="p-2 rounded-xl bg-teal-500/10 text-teal-400 font-bold shrink-0">1</div>
                <div>
                  <p className="font-bold text-white">{t.step1ScanTitle || 'Scan QR Code'}</p>
                  <p className="text-slate-400 mt-0.5">{t.step1ScanDesc || 'Other user points camera at this screen to open the upload page.'}</p>
                </div>
              </div>

              <div className="flex items-start gap-2.5 p-3 rounded-2xl bg-slate-950/70 border border-slate-800">
                <div className="p-2 rounded-xl bg-teal-500/10 text-teal-400 font-bold shrink-0">2</div>
                <div>
                  <p className="font-bold text-white">{t.step2SelectTitle || 'Select Photos or Folder'}</p>
                  <p className="text-slate-400 mt-0.5">{t.step2SelectDesc || 'Sender selects files and taps Send to Host.'}</p>
                </div>
              </div>

              <div className="flex items-start gap-2.5 p-3 rounded-2xl bg-slate-950/70 border border-slate-800">
                <div className="p-2 rounded-xl bg-teal-500/10 text-teal-400 font-bold shrink-0">3</div>
                <div>
                  <p className="font-bold text-white">{t.step3ConfirmTitle || 'View & Confirm Auto Save'}</p>
                  <p className="text-slate-400 mt-0.5">{t.step3ConfirmDesc || 'You preview photos and click Confirm to auto save files directly to your device.'}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Previous Accepted Transfers in this session */}
          {acceptedTransfers.length > 0 && (
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-3 shadow-xl">
              <h3 className="text-xs font-bold text-slate-300 flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-400" />
                <span>{t.receivedInSession || 'Received in This Session'} ({acceptedTransfers.length})</span>
              </h3>

              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {acceptedTransfers.map((item) => (
                  <div key={item.transferId} className="p-3 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-white truncate">{item.title}</p>
                      <p className="text-[10px] text-slate-400">
                        {item.files.length} {t.filesCount} • {formatFileSize(item.totalSize)} • {item.senderName}
                      </p>
                    </div>

                    <a
                      href={`/api/inbox/${inbox.id}/download/${item.transferId}`}
                      download
                      className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-teal-500 hover:text-slate-950 text-slate-200 text-xs font-bold border border-slate-700 transition shrink-0 flex items-center gap-1 cursor-pointer"
                    >
                      <ArrowDownToLine className="w-3.5 h-3.5" />
                      <span>{t.downloadSingle || 'Download'}</span>
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

      </div>

      {/* Review & Preview Modal (View មុននឹងទទួល) */}
      {pendingTransfer && showReviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
          <div 
            className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl p-6 sm:p-7 overflow-hidden space-y-4 max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-3 border-b border-slate-800 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/30 text-[11px] font-bold uppercase tracking-wider">
                    {t.incomingTransferAlert || 'Incoming Transfer Request'}
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-amber-500 text-slate-950 text-[10px] font-extrabold uppercase">
                    {t.needsReviewBadge || 'Needs Review'}
                  </span>
                </div>
                <h2 className="text-xl font-extrabold text-white mt-1">
                  {pendingTransfer.title}
                </h2>
                <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
                  <span>{t.fromSender}: <strong className="text-slate-200">{pendingTransfer.senderName}</strong></span>
                  <span>•</span>
                  <span>{pendingTransfer.files.length} {t.filesCount}</span>
                  <span>•</span>
                  <span>{formatFileSize(pendingTransfer.totalSize)}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowReviewModal(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
                title="Minimize / Close View"
              >
                <X className="w-5 h-5" />
              </button>
            </div>


            {/* Note / Message */}
            {pendingTransfer.note && (
              <p className="text-xs text-slate-300 bg-slate-950/70 p-3 rounded-2xl border border-slate-800 italic">
                "{pendingTransfer.note}"
              </p>
            )}

            {/* Content Preview Body (Scrollable) */}
            <div className="flex-1 overflow-y-auto space-y-4 pr-1">
              
              {/* Photo Previews */}
              {imageFiles.length > 0 && (
                <div className="space-y-2">
                  <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                    <ImageIcon className="w-4 h-4 text-teal-400" />
                    <span>{t.previewImage || 'Preview Photos'} ({imageFiles.length})</span>
                  </span>

                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
                    {imageFiles.map((img, idx) => (
                      <div
                        key={img.id}
                        onClick={() => setLightboxIndex(idx)}
                        className="group relative aspect-square rounded-2xl overflow-hidden bg-transparency-grid border border-slate-800 hover:border-teal-500 cursor-pointer transition"
                      >
                        <img
                          src={`/api/inbox/${inbox.id}/preview/${img.id}`}
                          alt={img.originalName}
                          className="w-full h-full object-cover group-hover:scale-105 transition duration-200"
                          onError={(e) => {
                            e.target.style.opacity = '0';
                          }}
                        />
                        <div className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-teal-300">
                          <Eye className="w-4 h-4" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* All Files List */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-teal-400" />
                  <span>{t.selectedFiles} ({pendingTransfer.files.length})</span>
                </span>

                <div className="bg-slate-950/80 border border-slate-800 rounded-2xl divide-y divide-slate-800/80 overflow-hidden">
                  {pendingTransfer.files.map((file) => (
                    <div key={file.id} className="p-3 flex items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="p-2 rounded-lg bg-slate-900 border border-slate-800 shrink-0">
                          {getFileIcon(file)}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-white truncate max-w-xs sm:max-w-md">
                            {file.originalName}
                          </p>
                          <p className="text-[10px] text-slate-400">{formatFileSize(file.size)}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>

            {/* Action Buttons: Confirm Auto-Save OR Reject */}
            <div className="pt-3 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => handleRejectTransfer(pendingTransfer)}
                disabled={actionLoading}
                className="w-full sm:w-auto px-5 py-3 rounded-2xl bg-slate-800 hover:bg-rose-500/20 hover:text-rose-300 text-slate-300 text-xs font-bold border border-slate-700 transition cursor-pointer"
              >
                {t.declineTransfer || 'Decline / Reject'}
              </button>

              <button
                type="button"
                onClick={() => handleConfirmTransfer(pendingTransfer)}
                disabled={actionLoading}
                className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-gradient-to-r from-teal-500 via-emerald-500 to-teal-400 hover:from-teal-400 hover:to-emerald-300 text-slate-950 text-xs font-black shadow-xl shadow-teal-500/20 flex items-center justify-center gap-2 transition disabled:opacity-50 cursor-pointer"
              >
                {actionLoading ? (
                  <span>{t.processing || 'Saving...'}</span>
                ) : (
                  <>
                    <ArrowDownToLine className="w-4 h-4" />
                    <span>{t.confirmAndSaveToDevice || 'Confirm & Save to Device'}</span>
                  </>
                )}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Lightbox Component for previewing photos */}
      {lightboxIndex >= 0 && (
        <ImageLightbox
          images={imageFiles}
          currentIndex={lightboxIndex}
          isOpen={lightboxIndex >= 0}
          onClose={() => setLightboxIndex(-1)}
          onNavigate={(newIdx) => setLightboxIndex(newIdx)}
          shareCode={inbox?.id}
          customPreviewUrl={(img) => `/api/inbox/${inbox.id}/preview/${img.id}`}
          t={t}
        />
      )}


    </div>
  );
}
