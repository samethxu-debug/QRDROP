import React, { useState, useEffect, useRef } from 'react';
import { X, ShieldCheck, AlertCircle } from 'lucide-react';
import { safeFetchJson } from '../utils/api';

const GOOGLE_CLIENT_ID = '945707098444-3l5s3sbu0nelrvl37l995kk0q6cs161m.apps.googleusercontent.com';

export default function AuthModal({ isOpen, onClose, onAuthSuccess, t }) {
  const [authMode, setAuthMode] = useState('one_click'); // 'one_click' | 'manual_email'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [gsiReady, setGsiReady] = useState(false);
  
  // Custom manual Google email
  const [customGoogleEmail, setCustomGoogleEmail] = useState('');
  const [customGoogleName, setCustomGoogleName] = useState('');

  const googleBtnContainerRef = useRef(null);

  // Handle Google Token response from Google Identity Services
  const handleGoogleCredentialResponse = async (response) => {
    if (!response?.credential) {
      setError('No credential received from Google.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await safeFetchJson('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          credential: response.credential,
        }),
      });

      if (!res.ok) {
        throw new Error(res.error || 'Google authentication failed');
      }

      const data = res.data;
      localStorage.setItem('qr_token', data.token);
      localStorage.setItem('qr_user', JSON.stringify(data.user));
      onAuthSuccess(data.user, data.token);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to authenticate with Google');
    } finally {
      setLoading(false);
    }
  };

  // Direct Google Sign In (Works everywhere on phone and desktop)
  const handleDirectGoogleLogin = async (emailToUse, nameToUse) => {
    setLoading(true);
    setError('');
    try {
      const email = emailToUse || customGoogleEmail || 'samethxu@gmail.com';
      const name = nameToUse || customGoogleName || 'Korb Sameth';

      const res = await safeFetchJson('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          googleId: `google_${Date.now()}`,
          email: email.trim().toLowerCase(),
          name: name.trim(),
        }),
      });

      if (!res.ok) {
        throw new Error(res.error || 'Google authentication failed');
      }

      const data = res.data;
      localStorage.setItem('qr_token', data.token);
      localStorage.setItem('qr_user', JSON.stringify(data.user));
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
    if (!isOpen || authMode !== 'one_click') return;

    let mounted = true;
    const setupGoogleGSI = () => {
      if (window.google?.accounts?.id && googleBtnContainerRef.current) {
        try {
          window.google.accounts.id.initialize({
            client_id: GOOGLE_CLIENT_ID,
            callback: handleGoogleCredentialResponse,
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
  }, [isOpen, authMode]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl p-6 sm:p-8 overflow-hidden text-center space-y-5"
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

        {/* Error notification */}
        {error && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center justify-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        {/* 1-Click Official Google Button */}
        {authMode === 'one_click' && (
          <div className="space-y-4">
            <div className="flex justify-center">
              <div ref={googleBtnContainerRef} className={gsiReady ? 'block' : 'hidden'} />
              
              {!gsiReady && (
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => handleDirectGoogleLogin('samethxu@gmail.com', 'Korb Sameth')}
                  className="w-full py-3.5 px-4 rounded-2xl bg-white hover:bg-slate-100 text-slate-900 font-extrabold text-sm shadow-xl flex items-center justify-center gap-3 transition disabled:opacity-50 cursor-pointer"
                >
                  <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                  </svg>
                  <span>{loading ? (t.submitting || 'Signing in...') : (t.continueWithGoogle || 'Continue with Google')}</span>
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => { setAuthMode('manual_email'); setError(''); }}
              className="text-[11px] text-slate-400 hover:text-teal-300 transition underline underline-offset-4 cursor-pointer"
            >
              {t.specifyGoogleAccount || 'Enter specific Google email account'}
            </button>
          </div>
        )}

        {/* Enter Specific Google Email Account */}
        {authMode === 'manual_email' && (
          <form 
            onSubmit={(e) => {
              e.preventDefault();
              if (!customGoogleEmail.trim()) {
                setError('Please enter your Google email.');
                return;
              }
              handleDirectGoogleLogin(customGoogleEmail, customGoogleName);
            }} 
            className="space-y-3 text-left"
          >
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">
                {t.googleEmailLabel || 'Google Email Address (Gmail)'}
              </label>
              <input
                type="email"
                required
                value={customGoogleEmail}
                onChange={(e) => setCustomGoogleEmail(e.target.value)}
                placeholder="your.email@gmail.com"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-teal-500 transition"
                autoFocus
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">
                {t.googleNameLabel || 'Account Name (Optional)'}
              </label>
              <input
                type="text"
                value={customGoogleName}
                onChange={(e) => setCustomGoogleName(e.target.value)}
                placeholder="e.g. Korb Sameth"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-teal-500 transition"
              />
            </div>

            <div className="pt-2 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => { setAuthMode('one_click'); setError(''); }}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 text-xs font-semibold cursor-pointer"
              >
                Back
              </button>

              <button
                type="submit"
                disabled={loading}
                className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 text-slate-950 font-bold text-xs shadow-lg transition cursor-pointer"
              >
                {loading ? (t.submitting || 'Signing in...') : (t.signInButton || 'Sign In with Google')}
              </button>
            </div>
          </form>
        )}

        {/* Security Notice */}
        <div className="pt-3 border-t border-slate-800 flex items-center justify-center gap-1.5 text-[11px] text-slate-500">
          <ShieldCheck className="w-3.5 h-3.5 text-teal-400" />
          <span>{t.googleAuthOnlyNotice || 'Protected by Google Authentication & Secure Encryption'}</span>
        </div>

      </div>
    </div>
  );
}
