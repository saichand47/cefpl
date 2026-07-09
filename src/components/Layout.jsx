import React, { useEffect, useState } from 'react';
import { Link, Outlet, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../supabaseClient';

const MotionDiv = motion.div;
const API_BASE = import.meta.env.VITE_EGGSIGHT_API_URL || 'http://localhost:8000';

/* ── Utility bar: navy strip with live NECC ticker crawl ──────────── */
function UtilityBar() {
  const [items, setItems] = useState(null);

  useEffect(() => {
    let active = true;
    fetch(`${API_BASE}/latest`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!active || !d?.zones?.length) return;
        const preferred = ['Hyderabad', 'Barwala', 'Namakkal', 'Mumbai (CC)', 'Delhi (CC)', 'Kolkata (WB)', 'Pune', 'Vijayawada'];
        const zones = preferred
          .map((name) => d.zones.find((z) => z.zone === name))
          .filter(Boolean);
        setItems(zones.length ? zones : d.zones.slice(0, 8));
      })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  const entry = (z) => (
    <span key={z.zone} className="mx-5 inline-flex items-center gap-1.5">
      <span className="text-white/55">{z.zone.replace(' (CC)', '').replace(' (WB)', '').toUpperCase()}</span>
      <span className="text-white">₹{Number(z.price).toFixed(0)}</span>
      {z.change_1d != null && z.change_1d !== 0 && (
        <span className={z.change_1d > 0 ? 'text-emerald-300' : 'text-red-300'}>
          {z.change_1d > 0 ? '▲' : '▼'}{Math.abs(z.change_1d).toFixed(1)}
        </span>
      )}
    </span>
  );

  return (
    <div className="ticker-viewport sticky top-0 z-[60] flex h-9 items-center overflow-hidden bg-navy text-[11.5px] num">
      <span className="micro-label z-10 flex h-9 shrink-0 items-center gap-2 bg-navy pl-5 pr-4 text-[10px] text-white/70">
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60"></span>
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400"></span>
        </span>
        NECC Zone Rates · Live
      </span>
      {items ? (
        <div className="ticker-track h-9 items-center whitespace-nowrap">
          {items.map(entry)}
          {items.map((z) => entry({ ...z, zone: `${z.zone} ` }))}
        </div>
      ) : (
        <div className="flex h-9 flex-1 items-center px-2 text-white/60">
          UPDATED 2× DAILY · 06:00 / 14:00 IST
        </div>
      )}
      <Link to="/forecast" className="micro-label z-10 hidden h-9 shrink-0 items-center bg-navy pl-4 pr-5 text-[10px] text-white/70 hover:text-white sm:flex">
        Full forecast →
      </Link>
    </div>
  );
}

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
        className="w-full rounded-panel border border-border bg-white px-4 py-3 text-[15px] outline-none focus:border-accent"
      />
      <input
        type="password" required minLength={8}
        placeholder={mode === 'signup' ? 'Choose a password (min 8 chars)' : 'Password'}
        autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
        value={password} onChange={(e) => setPassword(e.target.value)}
        className="w-full rounded-panel border border-border bg-white px-4 py-3 text-[15px] outline-none focus:border-accent"
      />
      {error && <p className="text-[13.5px] font-medium text-negative">{error}</p>}
      {notice && <p className="text-[13.5px] font-medium text-positive">{notice}</p>}
      <button
        type="submit" disabled={busy}
        className="w-full cursor-pointer rounded-card bg-accent px-6 py-3.5 text-[16px] font-semibold text-white transition-all duration-150 hover:bg-accent-hover active:scale-[0.97] disabled:opacity-50"
      >
        {busy ? 'Please wait…' : mode === 'signin' ? 'Sign In' : 'Create Account'}
      </button>
      <button
        type="button"
        onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(''); setNotice(''); }}
        className="w-full cursor-pointer text-center text-[13.5px] font-medium text-accent hover:underline"
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

  const navLink = 'hidden sm:inline-flex h-10 items-center rounded-full px-4 text-sm font-semibold text-text-muted transition-colors hover:bg-neutral-100 hover:text-text-main';

  return (
    <div className="flex min-h-screen flex-col overflow-hidden bg-bg font-sans text-text-main">
      {/* UTILITY BAR — frames the site as a market instrument */}
      <UtilityBar />

      {/* NAVIGATION */}
      <nav className="sticky top-9 z-50 border-b border-border bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3.5">
          <Link to="/" className="flex items-center gap-2.5">
            <img src="/logo.png" alt="CEFPL Logo" className="h-11 w-auto" />
            <span className="hidden text-[15px] font-bold tracking-tight md:inline">Chatrapati Egg Farms</span>
          </Link>
          <div className="flex items-center gap-1.5">
            <a href="/#platform" className={navLink}>Platform</a>
            <Link to="/forecast" className={`${navLink} mr-1.5`}>Live Forecast</Link>
            {loading ? (
              <div className="h-10 w-28 animate-pulse rounded-card bg-neutral-100"></div>
            ) : user ? (
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-3">
                  {user.user_metadata?.avatar_url || user.user_metadata?.picture ? (
                    <img
                      src={user.user_metadata?.avatar_url || user.user_metadata?.picture}
                      alt={user.user_metadata?.full_name || 'User'}
                      className="h-9 w-9 rounded-full border-2 border-accent/20"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent text-sm font-bold text-white">
                      {(user.email || '?')[0].toUpperCase()}
                    </div>
                  )}
                  <span className="hidden text-sm font-semibold text-text-main sm:inline">
                    {user.user_metadata?.full_name || user.email}
                  </span>
                  <Link to="/app" className="text-sm font-semibold text-accent hover:underline">
                    Open Portal
                  </Link>
                </div>
                <button
                  onClick={handleLogout}
                  className="rounded-full px-3 py-2 text-sm font-medium text-text-muted transition-colors hover:bg-neutral-100 hover:text-text-main"
                >
                  Sign Out
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowLoginModal(true)}
                className="cursor-pointer rounded-card bg-accent px-5 py-2.5 text-[15px] font-semibold text-white shadow-airtable transition-all duration-150 hover:-translate-y-0.5 hover:bg-accent-hover active:scale-[0.97]"
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
              className="inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-card text-text-muted hover:bg-neutral-100 hover:text-text-main sm:hidden"
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
          <div className="border-t border-border bg-white px-6 py-3 sm:hidden">
            <a
              href="/#platform"
              onClick={() => setMobileMenuOpen(false)}
              className="block rounded-card px-3 py-2.5 text-sm font-semibold text-text-muted hover:bg-neutral-100 hover:text-text-main"
            >
              Platform
            </a>
            <Link
              to="/forecast"
              onClick={() => setMobileMenuOpen(false)}
              className="block rounded-card px-3 py-2.5 text-sm font-semibold text-text-muted hover:bg-neutral-100 hover:text-text-main"
            >
              Live Forecast
            </Link>
            {user && (
              <Link
                to="/app"
                onClick={() => setMobileMenuOpen(false)}
                className="block rounded-card px-3 py-2.5 text-sm font-semibold text-accent hover:bg-neutral-100"
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
            <div className="absolute inset-0 bg-ink/40 backdrop-blur-sm"></div>

            {/* Modal */}
            <MotionDiv
              initial={{ opacity: 0, scale: 0.97, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 12 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              onClick={(e) => e.stopPropagation()}
              className="relative mx-4 w-full max-w-md overflow-hidden rounded-modal bg-white shadow-[var(--shadow-modal)]"
            >
              {/* Close Button */}
              <button
                onClick={() => setShowLoginModal(false)}
                className="absolute right-5 top-5 z-10 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-text-muted transition-colors hover:bg-neutral-100 hover:text-text-main"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M12 4L4 12M4 4L12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </button>

              {/* Header */}
              <div className="px-8 pb-6 pt-10 text-center">
                <img src="/logo.png" alt="CEFPL" className="mx-auto mb-6 h-16 w-auto" />
                <h3 className="text-display mb-2 text-2xl font-bold text-text-main">
                  Welcome to EggSight
                </h3>
                <p className="text-body text-[15px] text-text-muted">
                  Sign in with your authorized CEFPL account to access the platform.
                </p>
              </div>

              {/* Divider */}
              <div className="mx-8 border-t border-border"></div>

              {/* Login Form */}
              <div className="p-8">
                <EmailAuthForm onSuccess={() => { setShowLoginModal(false); navigate('/app'); }} />

                <p className="mt-6 text-center text-[13px] leading-relaxed text-text-muted">
                  Access is restricted to authorized CEFPL team members only.
                  <br />Contact your administrator if you need access.
                </p>
              </div>
            </MotionDiv>
          </MotionDiv>
        )}
      </AnimatePresence>

      <main className="flex flex-1 flex-col">
        {/* Pass down user and setShowLoginModal to child routes */}
        <Outlet context={{ user, setShowLoginModal }} />
      </main>

      {/* FOOTER */}
      <footer className="mt-auto bg-ink px-6 text-white">
        <div className="mx-auto grid max-w-7xl gap-10 py-14 md:grid-cols-4">
          <div className="space-y-4">
            <span className="text-body font-bold">Chatrapati Egg Farms Pvt Ltd</span>
            <p className="max-w-xs text-[14px] leading-relaxed text-white/55">
              Layer farming and market intelligence, run from Solapur, Maharashtra. EggSight is CEFPL's daily business cockpit.
            </p>
            <p className="micro-label flex items-center gap-2 text-[10px] text-white/55">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60"></span>
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
              </span>
              Market data live
            </p>
          </div>
          <div>
            <p className="micro-label mb-3 text-[11px] text-white/45">Platform</p>
            <ul className="space-y-2 text-[14px] font-medium">
              <li><Link to="/forecast" className="text-white/65 hover:text-white">Live Forecast</Link></li>
              <li><Link to="/app" className="text-white/65 hover:text-white">EggSight Terminal</Link></li>
              <li><Link to="/app/analyst" className="text-white/65 hover:text-white">AI Market Analyst</Link></li>
            </ul>
          </div>
          <div>
            <p className="micro-label mb-3 text-[11px] text-white/45">Data</p>
            <ul className="space-y-2 text-[14px] font-medium text-white/65">
              <li>NECC zone rates · 37 zones</li>
              <li>Feed spot prices · Solapur mandi</li>
              <li>Weather · Open-Meteo</li>
            </ul>
          </div>
          <div>
            <p className="micro-label mb-3 text-[11px] text-white/45">Company</p>
            <ul className="space-y-2 text-[14px] font-medium text-white/65">
              <li>Solapur, Maharashtra</li>
              <li><a href="mailto:contact@cefpl.in" className="hover:text-white">contact@cefpl.in</a></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-white/10">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 py-5 text-[13px] font-medium text-white/45">
            <span>© 2026 Chatrapati Egg Farms Pvt Ltd</span>
            <span className="text-[12.5px]">
              Forecasts are statistical estimates — not trading advice. Portal access restricted to authorized CEFPL team members.
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
