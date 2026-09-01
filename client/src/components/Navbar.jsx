import React, { useState } from 'react';
import { 
  QrCode, 
  Send, 
  ScanLine, 
  FolderArchive, 
  Globe, 
  User, 
  LogOut, 
  LogIn, 
  UserPlus, 
  ChevronDown,
  Shield,
  Check,
  X,
  Languages
} from 'lucide-react';

export default function Navbar({ 
  currentTab, 
  setCurrentTab, 
  lang, 
  setLang, 
  t, 
  user, 
  onOpenAuth, 
  onLogout,
  onOpenScanner 
}) {
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [langConfirmOpen, setLangConfirmOpen] = useState(false);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const [targetLang, setTargetLang] = useState('en');
  const [toastMessage, setToastMessage] = useState('');

  const isAdmin = user && (
    user.role === 'admin' ||
    user.isAdmin === true ||
    (user.email || '').toLowerCase() === 'samethxu@gmail.com' ||
    (user.email || '').toLowerCase() === 'korb.sameth@gmail.com'
  );

  const handleLanguageClick = () => {
    const nextLang = lang === 'km' ? 'en' : 'km';
    setTargetLang(nextLang);
    setLangConfirmOpen(true);
  };

  const handleConfirmLanguageSwitch = () => {
    setLang(targetLang);
    localStorage.setItem('qr_lang', targetLang);
    setLangConfirmOpen(false);

    const message = targetLang === 'km' 
      ? 'បានប្តូរភាសាទៅជា ភាសាខ្មែរ ដោយជោគជ័យ!' 
      : 'Language switched to English successfully!';
    setToastMessage(message);
    setTimeout(() => setToastMessage(''), 3000);
  };

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          
          {/* Logo */}
          <div 
            onClick={() => setCurrentTab('send')}
            className="flex items-center gap-2.5 cursor-pointer group"
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-teal-500 to-emerald-400 flex items-center justify-center shadow-lg shadow-teal-500/20 group-hover:scale-105 transition-transform">
              <QrCode className="w-6 h-6 text-slate-950 font-bold" />
            </div>
            <div>
              <span className="text-xl font-extrabold bg-gradient-to-r from-teal-400 via-emerald-300 to-cyan-400 bg-clip-text text-transparent">
                {t.appName}
              </span>
              <span className="hidden sm:block text-[11px] text-slate-400 font-medium -mt-1">
                {lang === 'km' ? 'ផ្ញើឯកសារតាម QR' : 'Fast QR File Drop'}
              </span>
            </div>
          </div>

          {/* Navigation Tabs (Desktop) */}
          <nav className="hidden md:flex items-center gap-1.5 p-1 bg-slate-900/90 border border-slate-800/80 rounded-xl">
            <button
              onClick={() => setCurrentTab('send')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all ${
                currentTab === 'send'
                  ? 'bg-gradient-to-r from-teal-600 to-emerald-600 text-white shadow-md shadow-teal-900/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Send className="w-4 h-4" />
              {t.sendTab}
            </button>

            <button
              onClick={() => setCurrentTab('personal-receive')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all ${
                currentTab === 'personal-receive'
                  ? 'bg-gradient-to-r from-teal-600 to-emerald-600 text-white shadow-md shadow-teal-900/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <QrCode className="w-4 h-4" />
              {t.receiveQRTab || 'Receive QR'}
            </button>

            <button
              onClick={onOpenScanner}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all ${
                currentTab === 'scan'
                  ? 'bg-gradient-to-r from-teal-600 to-emerald-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <ScanLine className="w-4 h-4" />
              {t.scanTab}
            </button>

            <button
              onClick={() => setCurrentTab('my-transfers')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all ${
                currentTab === 'my-transfers'
                  ? 'bg-gradient-to-r from-teal-600 to-emerald-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <FolderArchive className="w-4 h-4" />
              {t.myTransfersTab}
            </button>

            {/* Admin Dashboard Tab */}
            {isAdmin && (
              <button
                onClick={() => setCurrentTab('admin')}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all ${
                  currentTab === 'admin'
                    ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md'
                    : 'text-purple-400 hover:text-purple-300 hover:bg-purple-950/40'
                }`}
              >
                <Shield className="w-4 h-4" />
                <span>Admin</span>
              </button>
            )}
          </nav>

          {/* Right Actions: Lang + User */}
          <div className="flex items-center gap-2.5">
            {/* Founder Facebook Link */}
            <a
              href="https://www.facebook.com/korb.sameth/"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#1877F2]/10 hover:bg-[#1877F2]/20 text-blue-400 border border-[#1877F2]/30 text-xs font-bold transition shadow-sm"
              title="Founder Facebook: Korb Sameth"
            >
              <span className="w-4 h-4 rounded-full bg-[#1877F2] flex items-center justify-center text-white shrink-0">
                <svg className="w-2.5 h-2.5 fill-current" viewBox="0 0 24 24">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                </svg>
              </span>
              <span>Korb Sameth</span>
            </a>

            {/* Quick Scan for Mobile */}
            <button
              onClick={onOpenScanner}
              className="md:hidden p-2 rounded-lg bg-teal-500/10 text-teal-400 border border-teal-500/30 hover:bg-teal-500/20"
              title={t.scanTab}
            >
              <ScanLine className="w-5 h-5" />
            </button>

            {/* Language Switcher Button (Opens Confirmation Modal) */}
            <button
              onClick={handleLanguageClick}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs font-semibold text-slate-300 hover:text-white hover:border-teal-500/40 transition cursor-pointer"
              title="Change language"
            >
              <Globe className="w-3.5 h-3.5 text-teal-400" />
              <span>{lang === 'km' ? 'ភាសាខ្មែរ' : 'EN'}</span>
            </button>

            {/* User Auth state */}
            {user ? (
              <div className="relative">
                <button
                  onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                  className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-teal-500/40 transition text-slate-200"
                >
                  <div className="w-7 h-7 rounded-lg bg-teal-500/20 border border-teal-500/40 text-teal-300 flex items-center justify-center font-bold text-xs uppercase">
                    {user.name ? user.name.charAt(0) : 'U'}
                  </div>
                  <span className="hidden sm:inline text-xs font-semibold max-w-[100px] truncate">
                    {user.name}
                  </span>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                </button>

                {userDropdownOpen && (
                  <div 
                    className="absolute right-0 mt-2 w-52 rounded-xl bg-slate-900 border border-slate-800 shadow-2xl p-1.5 z-50 animate-in fade-in zoom-in-95 duration-100"
                    onClick={() => setUserDropdownOpen(false)}
                  >
                    <div className="px-3 py-2 border-b border-slate-800/80 mb-1">
                      <p className="text-xs font-bold text-white truncate">{user.name}</p>
                      <p className="text-[11px] text-slate-400 truncate">{user.email}</p>
                    </div>

                    {isAdmin && (
                      <button
                        onClick={() => {
                          setCurrentTab('admin');
                          setUserDropdownOpen(false);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold text-purple-300 hover:bg-purple-950/40 transition"
                      >
                        <Shield className="w-3.5 h-3.5" />
                        <span>Admin Dashboard</span>
                      </button>
                    )}

                    <button
                      onClick={() => {
                        setCurrentTab('my-transfers');
                        setUserDropdownOpen(false);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition"
                    >
                      <FolderArchive className="w-3.5 h-3.5 text-teal-400" />
                      {t.myTransfersTab}
                    </button>

                    <button
                      onClick={() => {
                        setUserDropdownOpen(false);
                        setLogoutConfirmOpen(true);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-rose-400 hover:bg-rose-500/10 transition mt-1 cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      {t.logout}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <button
                onClick={() => onOpenAuth()}
                className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-white hover:bg-slate-100 text-slate-900 text-xs font-bold shadow-md transition cursor-pointer"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
                <span>{t.googleSignInBtn || 'Sign in with Google'}</span>
              </button>
            )}
          </div>

        </div>
      </header>

      {/* Floating Success Toast */}
      {toastMessage && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl bg-emerald-500/90 text-slate-950 font-bold text-xs shadow-2xl flex items-center gap-2 animate-in fade-in slide-in-from-top-3 duration-200">
          <Check className="w-4 h-4" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Language Switch Confirmation Modal */}
      {langConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
          <div 
            className="relative w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl p-6 text-center space-y-4 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header Icon */}
            <div className="w-12 h-12 mx-auto rounded-2xl bg-teal-500/10 border border-teal-500/20 text-teal-400 flex items-center justify-center shadow-lg">
              <Languages className="w-6 h-6" />
            </div>

            {/* Title & Message */}
            <div className="space-y-1.5">
              <h3 className="text-lg font-bold text-white">
                {lang === 'km' ? 'តើអ្នកចង់ប្តូរភាសាគេហទំព័រមែនទេ?' : 'Switch Website Language?'}
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                {targetLang === 'en' ? (
                  <>
                    តើអ្នកពិតជាចង់ប្តូរភាសាបង្ហាញទៅជា <strong>English (ភាសាអង់គ្លេស)</strong> មែនទេ?
                  </>
                ) : (
                  <>
                    Do you want to change the display language to <strong>ភាសាខ្មែរ (Khmer)</strong>?
                  </>
                )}
              </p>
            </div>

            {/* Action Buttons */}
            <div className="pt-2 flex items-center justify-center gap-2.5">
              <button
                type="button"
                onClick={() => setLangConfirmOpen(false)}
                className="flex-1 py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 text-xs font-semibold transition cursor-pointer"
              >
                {lang === 'km' ? 'បោះបង់' : 'Cancel'}
              </button>

              <button
                type="button"
                onClick={handleConfirmLanguageSwitch}
                className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-slate-950 font-bold text-xs shadow-lg transition cursor-pointer"
              >
                {lang === 'km' ? 'យល់ព្រមប្តូរ' : 'Confirm Switch'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Logout Confirmation Modal */}
      {logoutConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
          <div 
            className="relative w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl p-6 text-center space-y-4 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header Icon */}
            <div className="w-12 h-12 mx-auto rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center shadow-lg">
              <LogOut className="w-6 h-6" />
            </div>

            {/* Title & Message */}
            <div className="space-y-1.5">
              <h3 className="text-lg font-bold text-white">
                {lang === 'km' ? 'តើអ្នកពិតជាចង់ចាកចេញមែនទេ?' : 'Confirm Log Out?'}
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                {lang === 'km' 
                  ? 'អ្នកនឹងត្រូវចាកចេញពីគណនីរបស់អ្នក។ អ្នកអាចចូលប្រើប្រាស់វិញបានគ្រប់ពេលវេលា។' 
                  : 'You will be signed out of your account. You can sign back in at any time.'}
              </p>
            </div>

            {/* Action Buttons */}
            <div className="pt-2 flex items-center justify-center gap-2.5">
              <button
                type="button"
                onClick={() => setLogoutConfirmOpen(false)}
                className="flex-1 py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 text-xs font-semibold transition cursor-pointer"
              >
                {lang === 'km' ? 'បោះបង់' : 'Cancel'}
              </button>

              <button
                type="button"
                onClick={() => {
                  onLogout();
                  setLogoutConfirmOpen(false);
                  const msg = lang === 'km' ? 'បានចាកចេញពីគណនីដោយជោគជ័យ!' : 'Logged out successfully!';
                  setToastMessage(msg);
                  setTimeout(() => setToastMessage(''), 3000);
                }}
                className="flex-1 py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-lg transition cursor-pointer"
              >
                {lang === 'km' ? 'ចាកចេញ' : 'Log Out'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Bottom Navigation Bar */}
      <div className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-slate-950/95 border-t border-slate-800/90 backdrop-blur-lg px-2 py-1.5 flex items-center justify-around">
        <button
          onClick={() => setCurrentTab('send')}
          className={`flex flex-col items-center gap-0.5 p-2 rounded-xl text-[10px] font-bold transition ${
            currentTab === 'send' ? 'text-teal-400 bg-teal-500/10' : 'text-slate-400'
          }`}
        >
          <Send className="w-4 h-4" />
          <span>{t.sendTab}</span>
        </button>

        <button
          onClick={() => setCurrentTab('personal-receive')}
          className={`flex flex-col items-center gap-0.5 p-2 rounded-xl text-[10px] font-bold transition ${
            currentTab === 'personal-receive' ? 'text-teal-400 bg-teal-500/10' : 'text-slate-400'
          }`}
        >
          <QrCode className="w-4 h-4" />
          <span>{t.receiveQRTab || 'Receive'}</span>
        </button>

        <button
          onClick={onOpenScanner}
          className={`flex flex-col items-center gap-0.5 p-2 rounded-xl text-[10px] font-bold transition ${
            currentTab === 'scan' ? 'text-teal-400 bg-teal-500/10' : 'text-slate-400'
          }`}
        >
          <ScanLine className="w-4 h-4" />
          <span>{t.scanTab}</span>
        </button>

        <button
          onClick={() => setCurrentTab('my-transfers')}
          className={`flex flex-col items-center gap-0.5 p-2 rounded-xl text-[10px] font-bold transition ${
            currentTab === 'my-transfers' ? 'text-teal-400 bg-teal-500/10' : 'text-slate-400'
          }`}
        >
          <FolderArchive className="w-4 h-4" />
          <span>{t.myTransfersTab}</span>
        </button>

        {isAdmin && (
          <button
            onClick={() => setCurrentTab('admin')}
            className={`flex flex-col items-center gap-0.5 p-2 rounded-xl text-[10px] font-bold transition ${
              currentTab === 'admin' ? 'text-purple-400 bg-purple-500/10' : 'text-purple-400/70'
            }`}
          >
            <Shield className="w-4 h-4" />
            <span>Admin</span>
          </button>
        )}
      </div>
    </>
  );
}
