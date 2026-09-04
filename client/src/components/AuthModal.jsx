import React, { useState, useEffect } from 'react';
import { X, ShieldCheck, AlertCircle, Mail, User, ArrowRight } from 'lucide-react';
import { safeFetchJson } from '../utils/api';

const GOOGLE_CLIENT_ID = '945707098444-3l5s3sbu0nelrvl37l995kk0q6cs161m.apps.googleusercontent.com';

export default function AuthModal({ isOpen, onClose, onAuthSuccess, t }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Personal Google email state
  const [emailInput, setEmailInput] = useState(() => {
    return localStorage.getItem('qr_last_email') || '';
  });
  const [nameInput, setNameInput] = useState(() => {
    return localStorage.getItem('qr_last_name') || '';
  });

  // Handle direct login with Google / Gmail
  const handleDirectGoogleLogin = async (e, overrideEmail = null, overrideName = null) => {
    if (e) e.preventDefault();
    const rawEmail = (overrideEmail || emailInput || '').trim();
    if (!rawEmail) {
      setError('Please enter your Google / Gmail email address.');
      return;
    }

    const email = rawEmail.includes('@') ? rawEmail.toLowerCase() : `${rawEmail.toLowerCase()}@gmail.com`;
    const name = (overrideName || nameInput || email.split('@')[0]).trim();

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

  // Official Google OAuth Popup Window (bypasses blank gsi/transform screen)
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
            let userEmail = null;
            let userName = null;
            try {
              if (idToken) {
                const payloadBase64 = idToken.split('.')[1];
                const base64 = payloadBase64.replace(/-/g, '+').replace(/_/g, '/');
                const decoded = JSON.parse(atob(base64));
                userEmail = decoded.email;
                userName = decoded.name;
              }
            } catch (e) {}

            const res = await safeFetchJson('/api/auth/google', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                credential: idToken,
                accessToken: accessToken,
                email: userEmail,
                name: userName,
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
            setError('Google sign-in completed. Enter your Google email below if not auto-signed in.');
          }
        }
      } catch (e) {
        // Cross-origin exception while user interacts with accounts.google.com
      }
    }, 500);
  };

  // Check URL hash for OAuth redirect token
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
          <button
            type="button"
            disabled={loading}
            onClick={handleGoogleOAuthPopup}
            className="w-full py-3.5 px-4 rounded-2xl bg-white hover:bg-slate-100 text-slate-900 font-extrabold text-xs shadow-xl transition cursor-pointer flex items-center justify-center gap-3 active:scale-[0.99] disabled:opacity-50"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
            </svg>
            <span>{t.continueWithGoogle || 'Continue with Google Account'}</span>
          </button>
        </div>



        {/* Security Notice */}
        <div className="pt-2 border-t border-slate-800 flex items-center justify-center gap-1.5 text-[11px] text-slate-500">
          <ShieldCheck className="w-3.5 h-3.5 text-teal-400 shrink-0" />
          <span>{t.googleAuthOnlyNotice || 'Protected by Google Authentication & Secure Encryption'}</span>
        </div>

      </div>
    </div>
  );
}

