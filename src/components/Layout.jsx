import React, { useState } from 'react';
import { Link, Outlet, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../supabaseClient';

const MotionDiv = motion.div;

function EmailAuthForm({ onSuccess }) {
  const [mode, setMode] = useState('signin'); // 'signin' | 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setError(''); setNotice(''); setBusy(true);
    try {
      if (mode === 'signin') {
        const { error: err } = await supabase.auth.signInWithPassword({ email, password });
        if (err) throw err;
        onSuccess();
      } else {
        const { data, error: err } = await supabase.auth.signUp({ email, password });
        if (err) throw err;
        if (data.session) { onSuccess(); }
        else setNotice('Account created — check your email for a confirmation link, then sign in.');
      }
    } catch (err) {
      const msg = err.message || 'Something went wrong.';
      setError(msg.includes('not authorized') ? 'This email is not authorized. Ask an administrator to add you.' : msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <input
        type="email" required placeholder="you@company.com" autoComplete="email"
        value={email} onChange={(e) => setEmail(e.target.value)}
        className="w-full rounded-[12px] border border-gray-300 px-4 py-3 text-[15px] outline-none focus:border-[var(--color-accent)]"
      />
      <input
        type="password" required minLength={8}
        placeholder={mode === 'signup' ? 'Choose a password (min 8 chars)' : 'Password'}
        autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
        value={password} onChange={(e) => setPassword(e.target.value)}
        className="w-full rounded-[12px] border border-gray-300 px-4 py-3 text-[15px] outline-none focus:border-[var(--color-accent)]"
      />
      {error && <p className="text-[13.5px] font-medium text-red-600">{error}</p>}
      {notice && <p className="text-[13.5px] font-medium text-emerald-700">{notice}</p>}
      <button
        type="submit" disabled={busy}
        className="w-full rounded-[14px] bg-[var(--color-accent)] px-6 py-3.5 text-[16px] font-semibold text-white transition-colors hover:bg-[var(--color-accent-hover)] disabled:opacity-50 cursor-pointer"
      >
        {busy ? 'Please wait…' : mode === 'signin' ? 'Sign In' : 'Create Account'}
      </button>
      <button
        type="button"
        onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(''); setNotice(''); }}
        className="w-full text-center text-[13.5px] font-medium text-[var(--color-accent)] hover:underline cursor-pointer"
      >
        {mode === 'signin' ? 'First time? Create your account' : 'Already have an account? Sign in'}
      </button>
    </form>
  );
}

export default function Layout({
  user,
  loading,
  showLoginModal,
  setShowLoginModal,
  handleLogout
}) {
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  return (
    <div className="min-h-screen bg-[var(--color-bg)] font-sans text-[var(--color-text-main)] overflow-hidden flex flex-col">
      {/* NAVIGATION */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-md border-b border-[var(--color-border)]">
        <div className="flex items-center justify-between px-6 py-4 max-w-7xl mx-auto">
          <Link to="/" className="flex items-center gap-2.5">
            <img src="/logo.png" alt="CEFPL Logo" className="h-11 w-auto" />
            <span className="hidden md:inline text-[15px] font-bold tracking-tight">Chatrapati Egg Farms</span>
          </Link>
          <div className="flex items-center gap-1.5">
            <a
              href="/#platform"
              className="hidden sm:inline-flex h-10 items-center rounded-[8px] px-3 text-sm font-semibold text-[var(--color-text-muted)] transition-colors hover:bg-gray-50 hover:text-[var(--color-text-main)]"
            >
              Platform
            </a>
            <Link
              to="/forecast"
              className="hidden sm:inline-flex h-10 items-center rounded-[8px] px-3 mr-1.5 text-sm font-semibold text-[var(--color-text-muted)] transition-colors hover:bg-gray-50 hover:text-[var(--color-text-main)]"
            >
              Live Forecast
            </Link>
            {loading ? (
              <div className="w-28 h-10 bg-gray-100 rounded-[12px] animate-pulse"></div>
            ) : user ? (
              <div className="flex items-center gap-4">
              <div className="flex items-center gap-3">
                {user.user_metadata?.avatar_url || user.user_metadata?.picture ? (
                  <img
                    src={user.user_metadata?.avatar_url || user.user_metadata?.picture}
                    alt={user.user_metadata?.full_name || 'User'}
                    className="w-9 h-9 rounded-full border-2 border-[var(--color-accent)]/20"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--color-accent)] text-sm font-bold text-white">
                    {(user.email || '?')[0].toUpperCase()}
                  </div>
                )}
                <span className="text-sm font-semibold text-[var(--color-text-main)] hidden sm:inline">
                  {user.user_metadata?.full_name || user.email}
                </span>
                <Link to="/app" className="text-sm font-semibold text-[var(--color-accent)] hover:underline">
                  Open Portal
                </Link>
              </div>
              <button
                onClick={handleLogout}
                className="text-sm font-medium text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] transition-colors px-3 py-2 rounded-[10px] hover:bg-gray-50"
              >
                Sign Out
              </button>
            </div>
            ) : (
              <button
                onClick={() => setShowLoginModal(true)}
                className="bg-[var(--color-accent)] text-white px-5 py-2.5 rounded-[12px] text-[15px] font-semibold hover:bg-[var(--color-accent-hover)] transition-colors shadow-sm text-button cursor-pointer"
              >
                Portal Login
              </button>
            )}
            {/* Mobile menu toggle — gives small screens access to the nav links
                that are hidden below the sm breakpoint. */}
            <button
              onClick={() => setMobileMenuOpen((o) => !o)}
              aria-label="Toggle navigation menu"
              aria-expanded={mobileMenuOpen}
              className="sm:hidden inline-flex h-10 w-10 items-center justify-center rounded-[8px] text-[var(--color-text-muted)] hover:bg-gray-50 hover:text-[var(--color-text-main)] cursor-pointer"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                {mobileMenuOpen
                  ? <path d="M18 6L6 18M6 6l12 12" />
                  : <><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></>}
              </svg>
            </button>
          </div>
        </div>

        {/* MOBILE MENU */}
        {mobileMenuOpen && (
          <div className="sm:hidden border-t border-[var(--color-border)] bg-white px-6 py-3">
            <a
              href="/#platform"
              onClick={() => setMobileMenuOpen(false)}
              className="block rounded-[8px] px-3 py-2.5 text-sm font-semibold text-[var(--color-text-muted)] hover:bg-gray-50 hover:text-[var(--color-text-main)]"
            >
              Platform
            </a>
            <Link
              to="/forecast"
              onClick={() => setMobileMenuOpen(false)}
              className="block rounded-[8px] px-3 py-2.5 text-sm font-semibold text-[var(--color-text-muted)] hover:bg-gray-50 hover:text-[var(--color-text-main)]"
            >
              Live Forecast
            </Link>
            {user && (
              <Link
                to="/app"
                onClick={() => setMobileMenuOpen(false)}
                className="block rounded-[8px] px-3 py-2.5 text-sm font-semibold text-[var(--color-accent)] hover:bg-gray-50"
              >
                Open Portal
              </Link>
            )}
          </div>
        )}
      </nav>

      {/* LOGIN MODAL */}
      <AnimatePresence>
        {showLoginModal && (
          <MotionDiv
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[100] flex items-center justify-center"
            onClick={() => setShowLoginModal(false)}
          >
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm"></div>
            
            {/* Modal */}
            <MotionDiv
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              onClick={(e) => e.stopPropagation()}
              className="relative bg-white rounded-[24px] shadow-2xl w-full max-w-md mx-4 overflow-hidden"
            >
              {/* Close Button */}
              <button
                onClick={() => setShowLoginModal(false)}
                className="absolute top-5 right-5 w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] cursor-pointer z-10"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M12 4L4 12M4 4L12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </button>

              {/* Header */}
              <div className="pt-10 pb-6 px-8 text-center">
                <img src="/logo.png" alt="CEFPL" className="h-16 w-auto mx-auto mb-6" />
                <h3 className="font-bold text-2xl text-[var(--color-text-main)] text-display mb-2">
                  Welcome to EggSight
                </h3>
                <p className="text-[15px] text-[var(--color-text-muted)] text-body">
                  Sign in with your authorized CEFPL account to access the platform.
                </p>
              </div>

              {/* Divider */}
              <div className="mx-8 border-t border-[var(--color-border)]"></div>

              {/* Login Form */}
              <div className="p-8">
                <EmailAuthForm onSuccess={() => { setShowLoginModal(false); navigate('/app'); }} />

                <p className="text-center text-[13px] text-[var(--color-text-muted)] mt-6 leading-relaxed">
                  Access is restricted to authorized CEFPL team members only.
                  <br />Contact your administrator if you need access.
                </p>
              </div>
            </MotionDiv>
          </MotionDiv>
        )}
      </AnimatePresence>

      <main className="flex-1 flex flex-col">
        {/* Pass down user and setShowLoginModal to child routes */}
        <Outlet context={{ user, setShowLoginModal }} />
      </main>

      {/* FOOTER */}
      <footer className="px-6 bg-white border-t border-[var(--color-border)] mt-auto">
        <div className="max-w-7xl mx-auto grid gap-10 py-14 md:grid-cols-3">
          <div className="space-y-3">
            <span className="font-bold text-[var(--color-text-main)] text-body">Chatrapati Egg Farms Pvt Ltd</span>
            <p className="text-[14px] leading-relaxed text-[var(--color-text-muted)] max-w-xs">
              Solapur, Maharashtra
            </p>
          </div>
          <div>
            <p className="mb-3 text-[12px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">Explore</p>
            <ul className="space-y-2 text-[14px] font-medium">
              <li><a href="/#platform" className="text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]">Platform modules</a></li>
              <li><Link to="/forecast" className="text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]">Live egg price forecast</Link></li>
              <li><Link to="/app" className="text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]">Team portal</Link></li>
            </ul>
          </div>
          <div>
            <p className="mb-3 text-[12px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">Data</p>
            <ul className="space-y-2 text-[14px] font-medium text-[var(--color-text-muted)]">
              <li>NECC rates, 37 zones, 2x daily</li>
              <li>1 / 7 / 14-day AI forecasts</li>
              <li>Price history since 2009</li>
            </ul>
          </div>
        </div>
        <div className="border-t border-[var(--color-border)]">
          <div className="max-w-7xl mx-auto py-5 text-[13px] font-medium text-[var(--color-text-muted)]">
            © 2026 Chatrapati Egg Farms Pvt Ltd. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
