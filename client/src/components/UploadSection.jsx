import React, { useState, useRef } from 'react';
import { 
  UploadCloud, 
  Image as ImageIcon, 
  FileText, 
  Film, 
  Music, 
  Archive, 
  File, 
  X, 
  Clock, 
  Lock, 
  Sparkles, 
  Send,
  AlertCircle
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { safeFetchJson } from '../utils/api';

// Security: Restricted executable & dangerous file extensions
const RESTRICTED_EXTENSIONS = [
  '.exe', '.scr', '.com', '.bat', '.cmd', '.ps1', '.psm1', '.psd1',
  '.vbs', '.vbe', '.js', '.jse', '.wsf', '.wsh', '.msi', '.msp',
  '.dll', '.sys', '.cpl', '.reg', '.hta', '.lnk', '.url', '.jar',
  '.rar', '.7z', '.iso', '.img', '.tar', '.gz', '.tgz', '.bz2', '.xz'
];

export function getFileRestrictedExtension(filename) {
  if (!filename) return null;
  const lower = filename.toLowerCase().trim();
  for (const ext of RESTRICTED_EXTENSIONS) {
    if (lower === ext || lower.endsWith(ext)) {
      return ext;
    }
  }
  return null;
}

export default function UploadSection({ user, t, onShareCreated, onOpenAuth }) {
  const [files, setFiles] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [title, setTitle] = useState('');
  const [detectedFolderName, setDetectedFolderName] = useState('');
  const [blockedFilesList, setBlockedFilesList] = useState([]);
  const [note, setNote] = useState('');
  const [expiryHours, setExpiryHours] = useState('24');
  const [enablePassword, setEnablePassword] = useState(false);
  const [password, setPassword] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState('');

  const fileInputRef = useRef(null);
  const folderInputRef = useRef(null);

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

    if (!user) {
      setError(t.loginRequiredToSend || 'Please sign in with Google to send files.');
      if (onOpenAuth) onOpenAuth();
      return;
    }

    const incomingFiles = Array.from(selectedFiles);
    if (incomingFiles.length === 0) return;

    // Check for folder name from webkitRelativePath
    if (incomingFiles[0].webkitRelativePath) {
      const topFolder = incomingFiles[0].webkitRelativePath.split('/')[0];
      if (topFolder) {
        setDetectedFolderName(topFolder);
      }
    }

    // Filter restricted files
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

    // Generate previews for images
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

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);

    if (!user) {
      setError(t.loginRequiredToSend || 'Please sign in with Google to send files.');
      if (onOpenAuth) onOpenAuth();
      return;
    }

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files);
    }
  };

  const removeFile = (index) => {
    const fileToRemove = files[index];
    setFiles((prev) => prev.filter((_, i) => i !== index));
    setPreviews((prev) => prev.filter((p) => p.name !== fileToRemove.name));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!user) {
      setError(t.loginRequiredToSend || 'Please sign in with Google to send files.');
      if (onOpenAuth) onOpenAuth();
      return;
    }

    if (files.length === 0) {
      setError('Please select at least one photo or file to send.');
      return;
    }

    setUploading(true);
    setUploadProgress(10);
    setError('');

    try {
      const formData = new FormData();
      files.forEach((f) => formData.append('files', f));
      
      const autoTitle = title.trim() || detectedFolderName || (files.length === 1 ? files[0].name : `${files.length} Shared Files`);
      formData.append('title', autoTitle);
      if (detectedFolderName) {
        formData.append('folderName', detectedFolderName);
      }
      formData.append('note', note);
      formData.append('expiryHours', expiryHours);
      if (enablePassword && password.trim()) {
        formData.append('password', password.trim());
      }
      formData.append('senderName', user.name || 'Google User');

      const token = localStorage.getItem('qr_token');
      const headers = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      } else {
        throw new Error(t.loginRequiredToSend || 'Please sign in with Google to send files.');
      }

      setUploadProgress(40);

      const res = await safeFetchJson('/api/shares/upload', {
        method: 'POST',
        headers,
        body: formData,
      });

      setUploadProgress(85);

      if (!res.ok) {
        throw new Error(res.error || 'Failed to upload files.');
      }

      const data = res.data;
      setUploadProgress(100);

      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 }
        });
      } catch (e) {}

      onShareCreated(data.share);

      setFiles([]);
      setPreviews([]);
      setTitle('');
      setDetectedFolderName('');
      setBlockedFilesList([]);
      setNote('');
      setPassword('');
      setEnablePassword(false);
    } catch (err) {
      setError(err.message || 'Upload failed');
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const totalSize = files.reduce((acc, f) => acc + f.size, 0);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      
      {/* Hero Welcome banner */}
      <div className="text-center space-y-2 py-4">
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
          {t.uploadTitle}
        </h1>
        <p className="text-sm text-slate-400 max-w-lg mx-auto">
          {t.uploadSubtitle}
        </p>
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

      {detectedFolderName && files.length > 0 && (
        <div className="p-3 rounded-xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-between text-xs text-teal-300">
          <span className="flex items-center gap-2">
            <Archive className="w-4 h-4 text-teal-400" />
            <span>Folder: <strong>{detectedFolderName}</strong> ({files.length} valid files ready)</span>
          </span>
          <span className="text-[11px] text-teal-400/80">Auto Approved</span>
        </div>
      )}

      {/* If NOT logged in: Hide upload box completely and show Google Login Required screen */}
      {!user ? (
        <div className="max-w-xl mx-auto my-6 p-8 sm:p-10 rounded-3xl bg-slate-900 border border-slate-800 text-center space-y-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
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
              {t.loginRequiredTitle || 'Google Login Required to Send Files'}
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 max-w-md mx-auto">
              {t.loginRequiredSubtitle || 'Please sign in with your Google account to upload photos, files, or folders and generate QR codes.'}
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
      ) : (
        /* If logged in: Show the full upload section */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left: Dropzone & File List (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          
          {/* Dropzone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`group relative border-2 border-dashed rounded-3xl p-8 text-center cursor-pointer transition-all ${
              isDragging
                ? 'border-teal-400 bg-teal-500/10 scale-[1.01]'
                : 'border-slate-800 bg-slate-900/60 hover:border-teal-500/50 hover:bg-slate-900'
            }`}
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
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-tr from-teal-500/20 to-emerald-500/20 border border-teal-500/30 flex items-center justify-center text-teal-400 group-hover:scale-110 group-hover:text-teal-300 transition-all">
              <UploadCloud className="w-8 h-8" />
            </div>

            <h3 className="text-base font-bold text-white mb-1">
              {isDragging ? t.dragActive : t.uploadTitle}
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

          {/* Selected Files List & Previews */}
          {files.length > 0 && (
            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="text-xs font-bold text-slate-300 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-teal-400" />
                  {t.selectedFiles} ({files.length})
                </span>
                <span className="text-xs text-slate-400 font-medium">
                  {formatFileSize(totalSize)}
                </span>
              </div>

              {/* Photo grid if photos exist */}
              {previews.length > 0 && (
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 pt-1">
                  {previews.map((p, idx) => (
                    <div key={idx} className="relative aspect-square rounded-xl overflow-hidden border border-slate-800 group bg-slate-950">
                      <img src={p.url} alt={p.name} className="w-full h-full object-cover" />
                    </div>
                  ))}
                </div>
              )}

              {/* File items list */}
              <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
                {files.map((file, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950/70 border border-slate-800/80 hover:border-slate-700 transition"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="p-2 rounded-lg bg-slate-900 border border-slate-800 shrink-0">
                        {getFileIcon(file)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-white truncate max-w-[200px] sm:max-w-xs">
                          {file.name}
                        </p>
                        <p className="text-[10px] text-slate-400">
                          {formatFileSize(file.size)}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => removeFile(index)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* Right: Transfer Settings & Submit (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 space-y-4">
            
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-teal-400" />
              {t.transferDetails}
            </h2>

            {/* Transfer Title */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">
                {t.transferTitlePlaceholder}
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. My Photo Album 2026"
                className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-teal-500 transition"
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
                className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-teal-500 transition resize-none"
              />
            </div>

            {/* Expiry Selector */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-teal-400" />
                {t.expiryOption}
              </label>
              <select
                value={expiryHours}
                onChange={(e) => setExpiryHours(e.target.value)}
                className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-teal-500 transition"
              >
                <option value="1">{t.expiry1h}</option>
                <option value="24">{t.expiry24h}</option>
                <option value="72">{t.expiry3d}</option>
                <option value="168">{t.expiry7d}</option>
                <option value="0">{t.expiryNever}</option>
              </select>
            </div>

            {/* Password Protection */}
            <div className="pt-2 border-t border-slate-800">
              <label className="flex items-center gap-2 cursor-pointer mb-2">
                <input
                  type="checkbox"
                  checked={enablePassword}
                  onChange={(e) => setEnablePassword(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-950 text-teal-500 focus:ring-teal-500/20"
                />
                <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-amber-400" />
                  {t.optionalPassword}
                </span>
              </label>

              {enablePassword && (
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t.passwordProtectPlaceholder}
                  className="w-full bg-slate-950/80 border border-amber-500/40 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 transition"
                />
              )}
            </div>

            {/* Progress bar during upload */}
            {uploading && (
              <div className="space-y-1.5 pt-2">
                <div className="flex justify-between text-[11px] font-semibold text-slate-300">
                  <span>{t.uploading}</span>
                  <span>{uploadProgress}%</span>
                </div>
                <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                  <div
                    className="h-full bg-gradient-to-r from-teal-500 to-emerald-400 transition-all duration-300 rounded-full"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="button"
              onClick={handleSubmit}
              disabled={uploading || files.length === 0}
              className="w-full mt-3 py-3.5 px-4 rounded-2xl bg-gradient-to-r from-teal-500 via-emerald-500 to-teal-400 hover:from-teal-400 hover:to-emerald-300 text-slate-950 font-extrabold text-sm shadow-xl shadow-teal-500/20 flex items-center justify-center gap-2.5 transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              {uploading ? (
                <span>{t.uploading}</span>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>{t.sendButton}</span>
                </>
              )}
            </button>

          </div>
        </div>

      </div>
      )}

    </div>
  );
}
