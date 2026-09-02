import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import AuthModal from './components/AuthModal';
import UploadSection from './components/UploadSection';
import QRCodeModal from './components/QRCodeModal';
import ScannerModal from './components/ScannerModal';
import ReceiveSection from './components/ReceiveSection';
import MyTransfersSection from './components/MyTransfersSection';
import PersonalReceiveSection from './components/PersonalReceiveSection';
import SendToInboxSection from './components/SendToInboxSection';
import AdminDashboardSection from './components/AdminDashboardSection';
import { translations } from './translations';
import { safeFetchJson } from './utils/api';
import { QrCode, Shield, Zap, Sparkles, Send, ScanLine } from 'lucide-react';

export default function App() {
  const [lang, setLang] = useState(() => {
    return localStorage.getItem('qr_lang') || 'km';
  }); // Default to Khmer
  const [currentTab, setCurrentTab] = useState('send'); // 'send' | 'personal-receive' | 'my-transfers' | 'receive' | 'send-to' | 'admin'
  const [receiveCode, setReceiveCode] = useState(null);
  const [inboxId, setInboxId] = useState(null);

  // User state
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('qr_user');
    return saved ? JSON.parse(saved) : null;
  });

  // Modals state
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState('login');
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [activeShare, setActiveShare] = useState(null);
  const [scannerOpen, setScannerOpen] = useState(false);

  const t = translations[lang] || translations.en;

  // Check URL path on load (e.g. /receive/ABC123 or /send-to/INB-XYZ789 or /admin)
  useEffect(() => {
    const path = window.location.pathname;
    if (path.startsWith('/receive/')) {
      const code = path.replace('/receive/', '').split('/')[0];
      if (code) {
        setReceiveCode(code);
        setCurrentTab('receive');
      }
    } else if (path.startsWith('/send-to/')) {
      const id = path.replace('/send-to/', '').split('/')[0];
      if (id) {
        setInboxId(id);
        setCurrentTab('send-to');
      }
    } else if (path === '/admin') {
      setCurrentTab('admin');
    }
  }, []);

  // Verify auth token on initial mount
  useEffect(() => {
    const checkUser = async () => {
      const token = localStorage.getItem('qr_token');
      if (token) {
        const res = await safeFetchJson('/api/auth/me', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok && res.data.user) {
          setUser(res.data.user);
          localStorage.setItem('qr_user', JSON.stringify(res.data.user));
        } else {
          handleLogout();
        }
      }
    };
    checkUser();
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('qr_token');
    localStorage.removeItem('qr_user');
    setUser(null);
    if (currentTab === 'my-transfers') {
      setCurrentTab('send');
    }
  };

  const handleOpenAuth = (mode = 'login') => {
    setAuthMode(mode);
    setAuthModalOpen(true);
  };

  const handleAuthSuccess = (userData) => {
    setUser(userData);
    setAuthModalOpen(false);
  };


  const handleShareCreated = (shareData) => {
    setActiveShare(shareData);
    setQrModalOpen(true);
  };

  const handleScanSuccess = (code) => {
    setReceiveCode(code);
    setCurrentTab('receive');
    window.history.pushState({}, '', `/receive/${code}`);
  };

  const handleOpenReceive = (code) => {
    setReceiveCode(code);
    setCurrentTab('receive');
    window.history.pushState({}, '', `/receive/${code}`);
  };

  const handleGoBack = () => {
    setCurrentTab('send');
    setReceiveCode(null);
    window.history.pushState({}, '', '/');
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100 font-sans selection:bg-teal-500 selection:text-slate-950">
      
      {/* Background glow effects */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-teal-500/10 rounded-full blur-[120px]" />
        <div className="absolute top-1/3 -right-40 w-[400px] h-[400px] bg-emerald-500/10 rounded-full blur-[100px]" />
        <div className="absolute bottom-10 -left-40 w-[400px] h-[400px] bg-cyan-500/10 rounded-full blur-[100px]" />
      </div>

      {/* Main Navigation */}
      <Navbar
        currentTab={currentTab}
        setCurrentTab={(tab) => {
          setCurrentTab(tab);
          if (tab !== 'receive') {
            window.history.pushState({}, '', '/');
          }
        }}
        lang={lang}
        setLang={setLang}
        t={t}
        user={user}
        onOpenAuth={handleOpenAuth}
        onLogout={handleLogout}
        onOpenScanner={() => setScannerOpen(true)}
      />

      {/* Main Content Body */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 pb-24 md:pb-8 z-10">
        
        {currentTab === 'send' && (
          <UploadSection
            user={user}
            t={t}
            onShareCreated={handleShareCreated}
            onOpenAuth={handleOpenAuth}
          />
        )}

        {currentTab === 'personal-receive' && (
          <PersonalReceiveSection
            user={user}
            t={t}
            onOpenAuth={handleOpenAuth}
          />
        )}

        {currentTab === 'my-transfers' && (
          <MyTransfersSection
            user={user}
            t={t}
            onOpenAuth={handleOpenAuth}
            onShowQR={(share) => {
              setActiveShare(share);
              setQrModalOpen(true);
            }}
            onOpenReceive={handleOpenReceive}
          />
        )}

        {currentTab === 'admin' && (
          <AdminDashboardSection
            user={user}
            t={t}
          />
        )}

        {currentTab === 'receive' && receiveCode && (
          <ReceiveSection
            code={receiveCode}
            t={t}
            onGoBack={handleGoBack}
            onShowQR={(share) => {
              setActiveShare(share);
              setQrModalOpen(true);
            }}
          />
        )}

        {currentTab === 'send-to' && inboxId && (
          <SendToInboxSection
            inboxId={inboxId}
            t={t}
            onGoHome={handleGoBack}
          />
        )}

      </main>

      {/* Feature Highlights Footer */}
      <footer className="border-t border-slate-900 bg-slate-950/60 backdrop-blur-md py-8 z-10 mt-auto">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 text-center space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl mx-auto py-2">
            <div className="flex items-center justify-center gap-2 text-xs font-semibold text-slate-400">
              <Zap className="w-4 h-4 text-teal-400" />
              <span>{lang === 'km' ? 'ផ្ញើលឿនតាម QR កូដ' : 'Instant QR Generation'}</span>
            </div>
            <div className="flex items-center justify-center gap-2 text-xs font-semibold text-slate-400">
              <Shield className="w-4 h-4 text-emerald-400" />
              <span>{lang === 'km' ? 'មានសុវត្ថិភាព និងលេខកូដការពារ' : 'Encrypted & Password Protected'}</span>
            </div>
            <div className="flex items-center justify-center gap-2 text-xs font-semibold text-slate-400">
              <ScanLine className="w-4 h-4 text-cyan-400" />
              <span>{lang === 'km' ? 'ស្កេនតាមទូរស័ព្ទ ឬកាមេរ៉ា' : 'Scan on Any Phone Camera'}</span>
            </div>
          </div>

          {/* Founder Attribution & Facebook Link */}
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3 text-xs text-slate-400">
            <span className="text-slate-400">
              {t.founderLabel}: <strong className="text-slate-200">{t.founderName}</strong>
            </span>
            <span className="hidden sm:inline text-slate-600">•</span>
            <a
              href="https://www.facebook.com/korb.sameth/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#1877F2]/10 hover:bg-[#1877F2]/20 text-blue-400 border border-[#1877F2]/30 transition text-xs font-bold shadow-sm"
            >
              <span className="w-4 h-4 rounded-full bg-[#1877F2] flex items-center justify-center text-white shrink-0">
                <svg className="w-2.5 h-2.5 fill-current" viewBox="0 0 24 24">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                </svg>
              </span>
              <span>Facebook: Korb Sameth</span>
            </a>
          </div>

          <p className="text-xs text-slate-500">
            © {new Date().getFullYear()} QR Drop. Built for fast photo & file transfer.
          </p>
        </div>
      </footer>

      {/* Auth Modal */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        initialMode={authMode}
        onAuthSuccess={handleAuthSuccess}
        t={t}
      />

      {/* QR Code Presentation Modal */}
      <QRCodeModal
        isOpen={qrModalOpen}
        onClose={() => setQrModalOpen(false)}
        share={activeShare}
        t={t}
        onOpenReceive={handleOpenReceive}
      />

      {/* QR Scanner Modal */}
      <ScannerModal
        isOpen={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScanSuccess={handleScanSuccess}
        t={t}
      />

    </div>
  );
}
