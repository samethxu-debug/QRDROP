import React, { useState, useEffect, useRef } from 'react';
import {
  UploadCloud,
  Image as ImageIcon,
  FileText,
  Film,
  Music,
  Archive,
  File,
  X,
  Send,
  CheckCircle2,
  AlertCircle,
  Clock,
  User,
  ShieldCheck,
  Layers,
  Sparkles,
  ArrowLeft
} from 'lucide-react';
import { getFileRestrictedExtension } from './UploadSection';

export default function SendToInboxSection({ inboxId, t, onGoHome }) {
  const [inboxInfo, setInboxInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [files, setFiles] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [title, setTitle] = useState('');
  const [detectedFolderName, setDetectedFolderName] = useState('');
  const [blockedFilesList, setBlockedFilesList] = useState([]);
  const [senderName, setSenderName] = useState('');
  const [note, setNote] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState('');
  const [sentTransferId, setSentTransferId] = useState(null);
  const [transferStatus, setTransferStatus] = useState(null); // 'pending_approval' | 'accepted' | 'rejected'
  
  const fileInputRef = useRef(null);
  const folderInputRef = useRef(null);
  const statusPollRef = useRef(null);

  // Fetch inbox details on load
  useEffect(() => {
    const fetchInbox = async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/inbox/${inboxId}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Receiver inbox not found.');
        setInboxInfo(data.inbox);
      } catch (err) {
        setError(err.message || 'Failed to load inbox');
      } finally {
        setLoading(false);
      }
    };

    if (inboxId) fetchInbox();
  }, [inboxId]);

  // Poll status of sent transfer until accepted or rejected
  useEffect(() => {
    if (!sentTransferId || !inboxId) return;

    const checkStatus = async () => {
      try {
        const res = await fetch(`/api/inbox/${inboxId}/status?transferId=${sentTransferId}`);
        const data = await res.json();
        if (data.status) {
          setTransferStatus(data.status);
          if (data.status === 'accepted' || data.status === 'rejected') {
            if (statusPollRef.current) clearInterval(statusPollRef.current);
          }
        }
      } catch (err) {
        // quiet polling error
      }
    };

    statusPollRef.current = setInterval(checkStatus, 1500);

    return () => {
      if (statusPollRef.current) clearInterval(statusPollRef.current);
    };
  }, [sentTransferId, inboxId]);

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (file) => {
    if (file.type.startsWith('image/')) return <ImageIcon className="w-5 h-5 text-teal-400" />;
    if (file.type.startsWith('video/')) return <Film className="w-5 h-5 text-purple-400" />;
    if (file.type.startsWith('audio/')) return <Music className="w-5 h-5 text-pink-400" />;
    if (file.type.includes('pdf') || file.type.includes('word') || file.type.includes('document')) 
      return <FileText className="w-5 h-5 text-blue-400" />;
    if (file.type.includes('zip') || file.type.includes('rar') || file.type.includes('tar')) 
      return <Archive className="w-5 h-5 text-amber-400" />;
    return <File className="w-5 h-5 text-slate-400" />;
  };

  const handleFileSelect = (selectedFiles) => {
    setError('');
    setBlockedFilesList([]);
    const incomingFiles = Array.from(selectedFiles);
    if (incomingFiles.length === 0) return;

    // Check for folder name from webkitRelativePath
    if (incomingFiles[0].webkitRelativePath) {
      const topFolder = incomingFiles[0].webkitRelativePath.split('/')[0];
      if (topFolder) setDetectedFolderName(topFolder);
    }

    const allowed = [];
    const blocked = [];

    incomingFiles.forEach((file) => {
      const restrictedExt = getFileRestrictedExtension(file.name);
      if (restrictedExt) {
        blocked.push({ name: file.name, ext: restrictedExt });
      } else {
        allowed.push(file);
      }
    });

    if (blocked.length > 0) {
      setBlockedFilesList(blocked);
      setError(`${t.securityRestrictedWarning} (${blocked.map((b) => b.name).slice(0, 3).join(', ')}${blocked.length > 3 ? '...' : ''})`);
    }

    if (allowed.length === 0) return;

    setFiles((prev) => [...prev, ...allowed]);

    // Generate image previews
    allowed.forEach((file) => {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onloadend = () => {
          setPreviews((prev) => [...prev, { name: file.name, url: reader.result }]);
        };
        reader.readAsDataURL(file);
      }
    });
  };

  const removeFile = (index) => {
    const fileToRemove = files[index];
    setFiles((prev) => prev.filter((_, i) => i !== index));
    setPreviews((prev) => prev.filter((p) => p.name !== fileToRemove.name));
  };

  const handleSendToHost = async (e) => {
    e.preventDefault();
    if (files.length === 0) {
      setError('Please select at least one photo or file to send.');
      return;
    }

    setUploading(true);
    setUploadProgress(15);
    setError('');

    try {
      const formData = new FormData();
      files.forEach((f) => formData.append('files', f));

      const autoTitle = title.trim() || detectedFolderName || (files.length === 1 ? files[0].name : `${files.length} Shared Files`);
      formData.append('title', autoTitle);
      if (detectedFolderName) formData.append('folderName', detectedFolderName);
      formData.append('senderName', senderName.trim() || 'Guest Phone');
      formData.append('note', note.trim());

      setUploadProgress(45);

      const res = await fetch(`/api/inbox/${inboxId}/upload`, {
        method: 'POST',
        body: formData,
      });

      setUploadProgress(85);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to send files.');
      }

      setUploadProgress(100);
      setSentTransferId(data.transferId);
      setTransferStatus('pending_approval');
    } catch (err) {
      setError(err.message || 'Send failed');
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  if (loading) {
    return (
      <div className="max-w-md mx-auto py-20 text-center space-y-4">
        <div className="w-12 h-12 mx-auto rounded-full border-4 border-teal-500/20 border-t-teal-400 animate-spin" />
        <p className="text-sm font-semibold text-slate-300">Connecting to receiver...</p>
      </div>
    );
  }

  if (error && !inboxInfo) {
    return (
      <div className="max-w-md mx-auto py-16 text-center space-y-4">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-white">{error}</h2>
        <button
          onClick={onGoHome}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Home</span>
        </button>
      </div>
    );
  }

  // Waiting / Accepted Screen after sending
  if (sentTransferId) {
    return (
      <div className="max-w-md mx-auto py-12 px-4 text-center space-y-6">
        <div className="p-7 rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl space-y-5">
          
          {transferStatus === 'pending_approval' && (
            <>
              <div className="relative w-20 h-20 mx-auto flex items-center justify-center">
                <div className="absolute inset-0 rounded-full bg-amber-500/20 animate-ping" />
                <div className="relative w-16 h-16 rounded-full bg-gradient-to-tr from-amber-500 to-teal-500 flex items-center justify-center text-slate-950 font-black shadow-lg shadow-amber-500/20">
                  <Clock className="w-8 h-8 animate-spin" style={{ animationDuration: '6s' }} />
                </div>
              </div>

              <div className="space-y-2">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-bold uppercase tracking-wider">
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                  <span>{t.waitingConfirmationBadge || 'Waiting for Confirmation'}</span>
                </div>

                <h2 className="text-xl font-extrabold text-white">
                  {t.filesSentWaitingTitle || 'Files Sent to Recipient!'}
                </h2>
                <p className="text-xs text-slate-400 max-w-xs mx-auto">
                  {t.waitingRecipientToReview || 'Waiting for the recipient to preview and accept the transfer on their screen...'}
                </p>
              </div>

              {/* Sent Files Preview Strip */}
              {previews.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-center gap-2 overflow-x-auto py-1">
                    {previews.slice(0, 4).map((p, idx) => (
                      <div
                        key={idx}
                        className="w-12 h-12 rounded-xl overflow-hidden bg-slate-950 border border-slate-800 shrink-0"
                      >
                        {p.previewUrl ? (
                          <img src={p.previewUrl} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-teal-400">
                            <Layers className="w-4 h-4" />
                          </div>
                        )}
                      </div>
                    ))}
                    {previews.length > 4 && (
                      <div className="w-12 h-12 rounded-xl bg-slate-950 border border-slate-800 text-xs font-bold text-teal-400 flex items-center justify-center shrink-0">
                        +{previews.length - 4}
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 text-xs text-slate-300 flex items-center justify-between">
                <span>Sending to: <strong className="text-teal-400">{inboxInfo?.hostName}</strong></span>
                <span className="text-slate-400 font-mono text-[11px]">{files.length} {t.filesCount} • {formatFileSize(totalSize)}</span>
              </div>

            </>
          )}

          {transferStatus === 'accepted' && (
            <>
              <div className="w-16 h-16 mx-auto rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div>
                <h2 className="text-xl font-extrabold text-white">
                  {t.transferAcceptedTitle || 'Transfer Accepted!'}
                </h2>
                <p className="text-xs text-slate-300 mt-1">
                  {t.transferAcceptedSubtitle || 'The recipient has confirmed and saved your files directly to their device.'}
                </p>
              </div>
              <button
                onClick={() => {
                  setSentTransferId(null);
                  setTransferStatus(null);
                  setFiles([]);
                  setPreviews([]);
                }}
                className="w-full py-3 rounded-2xl bg-gradient-to-r from-teal-500 to-emerald-500 text-slate-950 font-extrabold text-xs shadow-lg transition"
              >
                {t.sendMoreFiles || 'Send More Files'}
              </button>
            </>
          )}

          {transferStatus === 'rejected' && (
            <>
              <div className="w-16 h-16 mx-auto rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
                <X className="w-8 h-8" />
              </div>
              <div>
                <h2 className="text-xl font-extrabold text-white">
                  {t.transferDeclinedTitle || 'Transfer Declined'}
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  {t.transferDeclinedSubtitle || 'The recipient declined this transfer request.'}
                </p>
              </div>
              <button
                onClick={() => {
                  setSentTransferId(null);
                  setTransferStatus(null);
                }}
                className="w-full py-3 rounded-2xl bg-slate-800 text-white font-bold text-xs"
              >
                {t.tryAgain || 'Try Again'}
              </button>
            </>
          )}

        </div>
      </div>
    );
  }

  const totalSize = files.reduce((acc, f) => acc + f.size, 0);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      
      {/* Target Recipient Banner */}
      <div className="p-4 rounded-3xl bg-slate-900 border border-slate-800 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-teal-500/20 border border-teal-500/30 text-teal-400 flex items-center justify-center font-bold">
            <User className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              {t.sendToRecipient || 'Send Directly to Recipient'}
            </span>
            <p className="text-base font-extrabold text-white">
              {inboxInfo?.hostName}
            </p>
          </div>
        </div>

        <span className="px-3 py-1 rounded-xl bg-teal-500/10 border border-teal-500/30 text-teal-400 text-xs font-mono font-bold">
          {inboxInfo?.id}
        </span>
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm space-y-2">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
            <span className="font-semibold">{error}</span>
          </div>
          {blockedFilesList.length > 0 && (
            <div className="pt-2 border-t border-rose-500/20 text-xs text-rose-200">
              <span className="font-bold">{t.securityBlockedFiles}</span>
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {blockedFilesList.map((item, i) => (
                  <span key={i} className="px-2 py-0.5 rounded-md bg-rose-950/80 border border-rose-800 font-mono text-[11px] text-rose-300">
                    {item.name} ({item.ext})
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left: Dropzone & Selected Files (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-slate-800 bg-slate-900/60 hover:border-teal-500/50 hover:bg-slate-900 rounded-3xl p-8 text-center cursor-pointer transition group"
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={(e) => handleFileSelect(e.target.files)}
              className="hidden"
            />
            <input
              ref={folderInputRef}
              type="file"
              webkitdirectory=""
              directory=""
              multiple
              onChange={(e) => handleFileSelect(e.target.files)}
              className="hidden"
            />

            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400 group-hover:scale-110 transition">
              <UploadCloud className="w-8 h-8" />
            </div>

            <h3 className="text-base font-bold text-white mb-1">
              {t.uploadTitle}
            </h3>
            <p className="text-xs text-slate-400 mb-4 max-w-xs mx-auto">
              {t.uploadSubtitle}
            </p>

            <div className="flex items-center justify-center gap-2.5">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  fileInputRef.current?.click();
                }}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-teal-500/10 border border-teal-500/30 text-teal-300 text-xs font-bold hover:bg-teal-500/20 transition"
              >
                <Sparkles className="w-4 h-4 text-teal-400" />
                <span>{t.browseFiles}</span>
              </button>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  folderInputRef.current?.click();
                }}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 text-xs font-bold hover:bg-slate-700 hover:text-white transition"
              >
                <Archive className="w-4 h-4 text-emerald-400" />
                <span>{t.browseFolder}</span>
              </button>
            </div>
          </div>

          {/* Files List */}
          {files.length > 0 && (
            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="text-xs font-bold text-slate-300">
                  {t.selectedFiles} ({files.length})
                </span>
                <span className="text-xs text-slate-400 font-medium">
                  {formatFileSize(totalSize)}
                </span>
              </div>

              {/* Photo Previews */}
              {previews.length > 0 && (
                <div className="grid grid-cols-4 gap-2 pt-1">
                  {previews.map((p, idx) => (
                    <div key={idx} className="relative aspect-square rounded-xl overflow-hidden border border-slate-800 bg-slate-950">
                      <img src={p.url} alt={p.name} className="w-full h-full object-cover" />
                    </div>
                  ))}
                </div>
              )}

              <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
                {files.map((file, index) => (
                  <div key={index} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="p-2 rounded-lg bg-slate-900 border border-slate-800 shrink-0">
                        {getFileIcon(file)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-white truncate max-w-xs">{file.name}</p>
                        <p className="text-[10px] text-slate-400">{formatFileSize(file.size)}</p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => removeFile(index)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 transition"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* Right: Sender Info & Submit (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 space-y-4">
            
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-teal-400" />
              <span>{t.transferDetails}</span>
            </h2>

            {/* Sender Name */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">
                {t.yourNamePlaceholder || 'Your Name (e.g. Phone 1)'}
              </label>
              <input
                type="text"
                value={senderName}
                onChange={(e) => setSenderName(e.target.value)}
                placeholder="e.g. Sokha"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:border-teal-500 transition"
              />
            </div>

            {/* Note / Message */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">
                {t.transferNotePlaceholder}
              </label>
              <textarea
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Message for recipient..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:border-teal-500 transition resize-none"
              />
            </div>

            {/* Send Button */}
            <button
              type="button"
              onClick={handleSendToHost}
              disabled={uploading || files.length === 0}
              className="w-full mt-3 py-3.5 px-4 rounded-2xl bg-gradient-to-r from-teal-500 via-emerald-500 to-teal-400 hover:from-teal-400 hover:to-emerald-300 text-slate-950 font-extrabold text-sm shadow-xl shadow-teal-500/20 flex items-center justify-center gap-2 transition disabled:opacity-40"
            >
              {uploading ? (
                <span>{t.uploading}</span>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>{t.sendToHostButton || 'Send to Recipient'}</span>
                </>
              )}
            </button>

          </div>
        </div>

      </div>

    </div>
  );
}
