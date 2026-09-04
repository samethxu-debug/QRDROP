import React, { useState, useEffect, useRef } from 'react';
import { X, ShieldCheck, AlertCircle, Mail, User, Smartphone, Laptop, ArrowRight } from 'lucide-react';
import { safeFetchJson } from '../utils/api';

const GOOGLE_CLIENT_ID = '945707098444-3l5s3sbu0nelrvl37l995kk0q6cs161m.apps.googleusercontent.com';

export default function AuthModal({ isOpen, onClose, onAuthSuccess, t }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [gsiReady, setGsiReady] = useState(false);
  const [gsiOriginError, setGsiOriginError] = useState(false);

  // Personal Google email state
  const [emailInput, setEmailInput] = useState(() => {
    return localStorage.getItem('qr_last_email') || '';
  });
  const [nameInput, setNameInput] = useState(() => {
    return localStorage.getItem('qr_last_name') || '';
  });

  const googleBtnContainerRef = useRef(null);

  // Origin & environment detection
  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : '';
  const isRawIp = /^https?:\/\/(\d{1,3}\.){3}\d{1,3}(:\d+)?$/.test(currentOrigin);
  const isPort5173 = currentOrigin.includes(':5173');

  // Handle Google Token response from Google Identity Services (Official GIS Popup/One-tap)
  const handleGoogleCredentialResponse = async (response) => {
    if (!response?.credential) {
      setError('No credential received from Google.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      let clientDecoded = null;
      try {
        const payloadBase64 = response.credential.split('.')[1];
        const base64 = payloadBase64.replace(/-/g, '+').replace(/_/g, '/');
        clientDecoded = JSON.parse(atob(base64));
      } catch (e) {}

      const res = await safeFetchJson('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          credential: response.credential,
          email: clientDecoded?.email,
          name: clientDecoded?.name || clientDecoded?.given_name,
          picture: clientDecoded?.picture,
          googleId: clientDecoded?.sub,
        }),
      });

      if (!res.ok) {
        throw new Error(res.error || 'Google authentication failed');
      }

      const data = res.data;
      localStorage.setItem('qr_token', data.token);
      localStorage.setItem('qr_user', JSON.stringify(data.user));
      if (data.user?.email) localStorage.setItem('qr_last_email', data.user.email);
      if (data.user?.name) localStorage.setItem('qr_last_name', data.user.name);

      onAuthSuccess(data.user, data.token);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to authenticate with Google');
    } finally {
      setLoading(false);
    }
  };

  // Direct Personal Google Sign In
  const handleDirectGoogleLogin = async (e) => {
    if (e) e.preventDefault();
    const rawEmail = (emailInput || '').trim();
    if (!rawEmail) {
      setError('Please enter your Google / Gmail email address.');
      return;
    }

    const email = rawEmail.includes('@') ? rawEmail.toLowerCase() : `${rawEmail.toLowerCase()}@gmail.com`;
    const name = (nameInput || email.split('@')[0]).trim();

    setLoading(true);
    setError('');
    try {
      const res = await safeFetchJson('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          googleId: `google_${Date.now()}`,
          email,
          name,
        }),
      });

      if (!res.ok) {
        throw new Error(res.error || 'Google authentication failed');
      }

      const data = res.data;
      localStorage.setItem('qr_token', data.token);
      localStorage.setItem('qr_user', JSON.stringify(data.user));
      localStorage.setItem('qr_last_email', data.user.email);
      if (data.user?.name) localStorage.setItem('qr_last_name', data.user.name);

      onAuthSuccess(data.user, data.token);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to sign in with Google');
    } finally {
      setLoading(false);
    }
  };

  // Initialize official Google Identity Services
  useEffect(() => {
    if (!isOpen) return;

    let mounted = true;

    if (isRawIp) {
      setGsiReady(false);
      return;
    }

    const setupGoogleGSI = () => {
      if (window.google?.accounts?.id && googleBtnContainerRef.current) {
        try {
          window.google.accounts.id.initialize({
            client_id: GOOGLE_CLIENT_ID,
            callback: handleGoogleCredentialResponse,
            error_callback: (err) => {
              console.warn('[Google GSI Error]:', err);
              if (mounted) {
                if (err?.type === 'origin_mismatch' || String(err).includes('origin')) {
                  setGsiOriginError(true);
                }
              }
            },
            auto_select: false,
            cancel_on_tap_outside: true,
          });

          googleBtnContainerRef.current.innerHTML = '';
          window.google.accounts.id.renderButton(googleBtnContainerRef.current, {
            theme: 'filled_black',
            size: 'large',
            shape: 'pill',
            width: 320,
            text: 'continue_with',
            logo_alignment: 'left',
          });

          if (mounted) setGsiReady(true);
        } catch (err) {
          console.warn('Google GSI init failed:', err);
          if (mounted) setGsiReady(false);
        }
      } else {
        if (mounted) setGsiReady(false);
      }
    };

    const timer = setTimeout(setupGoogleGSI, 200);
    return () => {
      mounted = false;
      clearTimeout(timer);
    };
  }, [isOpen, isRawIp]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl p-6 sm:p-7 overflow-hidden text-center space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Ambient Background Glow */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header Icon */}
        <div className="space-y-2">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-center shadow-lg">
            <svg className="w-7 h-7" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
            </svg>
          </div>

          <h2 className="text-xl sm:text-2xl font-black text-white">
            {t.googleSignInTitle || 'Sign in with Google'}
          </h2>
          <p className="text-xs text-slate-400 max-w-xs mx-auto">
            {t.googleSignInSubtitle || 'Sign in with your Google account to upload, receive and send files securely.'}
          </p>
        </div>

        {/* Network / Origin Info */}
        {isRawIp && (
          <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-[11px] flex items-center justify-start gap-2 text-left">
            <Smartphone className="w-4 h-4 shrink-0 text-cyan-400" />
            <span>{t.networkNoticeDesc || 'Google restricts popups on raw local IP addresses. Use personal Gmail sign-in below.'}</span>
          </div>
        )}

        {isPort5173 && !isRawIp && (
          <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[11px] flex items-center justify-start gap-2 text-left">
            <Laptop className="w-4 h-4 shrink-0 text-amber-400" />
            <span>{t.originMismatchNotice || 'Running on dev port 5173. For official Google 1-Tap popup, open http://localhost:3001, or sign in directly below.'}</span>
          </div>
        )}

        {/* Error notification */}
        {error && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center justify-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        {/* SECTION 1: Official Google GIS Button (if ready & allowed) */}
        {!isRawIp && !gsiOriginError && (
          <div className="space-y-2">
            <div className="flex justify-center">
              <div ref={googleBtnContainerRef} className={gsiReady ? 'block' : 'hidden'} />
            </div>
          </div>
        )}

        {/* Divider */}
        {!isRawIp && !gsiOriginError && gsiReady && (
          <div className="relative flex items-center justify-center my-1">
            <div className="border-t border-slate-800 w-full" />
            <span className="bg-slate-900 px-3 text-[11px] text-slate-500 font-semibold uppercase tracking-wider shrink-0">
              {t.orUseEmail || 'or sign in with personal Google email'}
            </span>
            <div className="border-t border-slate-800 w-full" />
          </div>
        )}

        {/* SECTION 2: Personal Google Email Login Form */}
        <form onSubmit={handleDirectGoogleLogin} className="space-y-3 text-left">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              {t.googleEmailLabel || 'Google Email Address (Gmail)'}
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                required
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                placeholder="your.email@gmail.com"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">
              {t.googleNameLabel || 'Account Name (Optional)'}
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                placeholder="e.g. Your Name"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-slate-950 font-extrabold text-xs shadow-lg shadow-teal-500/10 transition cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <span>{loading ? (t.submitting || 'Signing in...') : (t.signInButton || 'Sign In with Google')}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        {/* Security Notice */}
        <div className="pt-2 border-t border-slate-800 flex items-center justify-center gap-1.5 text-[11px] text-slate-500">
          <ShieldCheck className="w-3.5 h-3.5 text-teal-400 shrink-0" />
          <span>{t.googleAuthOnlyNotice || 'Protected by Google Authentication & Secure Encryption'}</span>
        </div>

      </div>
    </div>
  );
}

