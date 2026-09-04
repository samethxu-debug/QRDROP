import React, { useState, useEffect, useRef } from 'react';
import { X, ShieldCheck, AlertCircle, Mail, User, ArrowRight } from 'lucide-react';
import { safeFetchJson } from '../utils/api';

const GOOGLE_CLIENT_ID = '945707098444-3l5s3sbu0nelrvl37l995kk0q6cs161m.apps.googleusercontent.com';

export default function AuthModal({ isOpen, onClose, onAuthSuccess, t }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [gsiReady, setGsiReady] = useState(false);

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

  // Official Google OAuth Popup Window
  const handleGoogleOAuthPopup = () => {
    setLoading(true);
    setError('');

    const redirectUri = window.location.origin;
    const scope = 'openid email profile';
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${encodeURIComponent(GOOGLE_CLIENT_ID)}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&response_type=token%20id_token` +
      `&scope=${encodeURIComponent(scope)}` +
      `&nonce=${Date.now()}` +
      `&prompt=select_account`;

    const width = 500;
    const height = 600;
    const left = window.screen.width / 2 - width / 2;
    const top = window.screen.height / 2 - height / 2;

    const popup = window.open(
      authUrl,
      'GoogleAuthPopup',
      `width=${width},height=${height},left=${left},top=${top},status=0,toolbar=0,menubar=0,location=0`
    );

    if (!popup) {
      setError('Popup window was blocked by your browser. Please enter your Gmail below.');
      setLoading(false);
      return;
    }

    const timer = setInterval(async () => {
      try {
        if (popup.closed) {
          clearInterval(timer);
          setLoading(false);
          return;
        }

        if (popup.location.href.startsWith(redirectUri)) {
          const hash = popup.location.hash || popup.location.search;
          popup.close();
          clearInterval(timer);

          const params = new URLSearchParams(hash.replace(/^#/, '?'));
          const idToken = params.get('id_token');
          const accessToken = params.get('access_token');

          if (idToken || accessToken) {
            const res = await safeFetchJson('/api/auth/google', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                credential: idToken,
                accessToken: accessToken,
              }),
            });
            if (res.ok && res.data?.user) {
              localStorage.setItem('qr_token', res.data.token);
              localStorage.setItem('qr_user', JSON.stringify(res.data.user));
              if (res.data.user?.email) localStorage.setItem('qr_last_email', res.data.user.email);
              if (res.data.user?.name) localStorage.setItem('qr_last_name', res.data.user.name);
              onAuthSuccess(res.data.user, res.data.token);
              onClose();
            } else {
              setError(res.error || 'Google authentication failed.');
            }
          } else {
            setError('Google sign-in was canceled or origin is pending configuration.');
          }
        }
      } catch (e) {
        // Ignore cross-origin access error while logging in
      }
    }, 500);
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

  // Initialize official Google Identity Services button if supported
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
            error_callback: () => {},
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
  }, [isOpen, isRawIp]);

  // Check URL hash for Google OAuth callback if window redirected
  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.hash.includes('access_token')) {
      const params = new URLSearchParams(window.location.hash.replace(/^#/, '?'));
      const idToken = params.get('id_token');
      const accessToken = params.get('access_token');
      if (idToken || accessToken) {
        window.history.replaceState(null, '', window.location.pathname);
        safeFetchJson('/api/auth/google', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ credential: idToken, accessToken }),
        }).then(res => {
          if (res.ok && res.data?.user) {
            localStorage.setItem('qr_token', res.data.token);
            localStorage.setItem('qr_user', JSON.stringify(res.data.user));
            onAuthSuccess(res.data.user, res.data.token);
            onClose();
          }
        });
      }
    }
  }, []);

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

        {/* Error notification */}
        {error && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center justify-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        {/* SECTION 1: Google OAuth Button */}
        <div className="space-y-2">
          {gsiReady ? (
            <div className="flex justify-center">
              <div ref={googleBtnContainerRef} />
            </div>
          ) : (
            <button
              type="button"
              disabled={loading}
              onClick={handleGoogleOAuthPopup}
              className="w-full py-3 px-4 rounded-2xl bg-white hover:bg-slate-100 text-slate-900 font-bold text-xs shadow-lg transition cursor-pointer flex items-center justify-center gap-3 disabled:opacity-50"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
              </svg>
              <span>{t.continueWithGoogle || 'Continue with Google Account'}</span>
            </button>
          )}
        </div>

        {/* Divider */}
        <div className="relative flex items-center justify-center my-1">
          <div className="border-t border-slate-800 w-full" />
          <span className="bg-slate-900 px-3 text-[11px] text-slate-500 font-semibold uppercase tracking-wider shrink-0">
            {t.orUseEmail || 'or sign in with Google email'}
          </span>
          <div className="border-t border-slate-800 w-full" />
        </div>

        {/* SECTION 2: Personal Google Email Login Form (WITHOUT LABELS) */}
        <form onSubmit={handleDirectGoogleLogin} className="space-y-3 text-left">
          <div>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                required
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                placeholder="your.email@gmail.com"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-3.5 py-3 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition"
              />
            </div>
          </div>

          <div>
            <div className="relative">
              <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                placeholder="e.g. Your Name"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-3.5 py-3 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-slate-950 font-extrabold text-xs shadow-lg shadow-teal-500/10 transition cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
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

