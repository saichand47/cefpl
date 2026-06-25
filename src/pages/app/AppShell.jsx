import React, { useEffect, useMemo, useState } from 'react';
import { NavLink, Outlet, Navigate, Link, useNavigate } from 'react-router-dom';
import { LogOut, Command } from 'lucide-react';
import { supabase } from '../../supabaseClient';

const API_BASE = import.meta.env.VITE_EGGSIGHT_API_URL || 'http://localhost:8000';

function useProfile(user) {
  const [profile, setProfile] = useState(null);
  useEffect(() => {
    if (!user) return undefined;
    let active = true;
    supabase.from('profiles').select('role, email').eq('id', user.id).single()
      .then(({ data }) => { if (active) setProfile(data || { role: 'supervisor', email: user.email }); });
    return () => { active = false; };
  }, [user]);
  return profile;
}

/* ── Market Pulse ribbon ─────────────────────────────────────────── */
function MarketPulse() {
  const [items, setItems] = useState(null);
  useEffect(() => {
    let active = true;
    Promise.all([
      fetch(`${API_BASE}/forecast/full`).then((r) => r.json()).catch(() => null),
      fetch(`${API_BASE}/latest`).then((r) => r.json()).catch(() => null),
      supabase.from('raw_material_prices').select('material, price_per_kg, recorded_on')
        .order('recorded_on', { ascending: false }).limit(20).then(({ data }) => data || []),
    ]).then(([fc, latest, mats]) => {
      if (!active) return;
      const out = [];
      const arrow = (v) => (v > 0 ? { a: '▲', c: 'text-emerald-400' } : v < 0 ? { a: '▼', c: 'text-red-400' } : { a: '—', c: 'text-neutral-500' });
      const hyd = latest?.zones?.find((z) => z.zone === 'Hyderabad');
      if (hyd) out.push({ label: 'NECC HYD', value: `₹${hyd.price.toFixed(0)}`, delta: hyd.change_1d, ...arrow(hyd.change_1d) });
      for (const zn of ['Barwala', 'Namakkal', 'Mumbai (CC)', 'Delhi (CC)']) {
        const z = latest?.zones?.find((x) => x.zone === zn);
        if (z) out.push({ label: zn.replace(' (CC)', ''), value: `₹${z.price.toFixed(0)}`, delta: z.change_1d, ...arrow(z.change_1d) });
      }
      const soy = mats.find((m) => m.material === 'soybean_meal');
      const mz = mats.find((m) => m.material === 'maize');
      if (soy) out.push({ label: 'SOYA DOC', value: `₹${Number(soy.price_per_kg).toFixed(1)}/kg`, a: '', c: 'text-neutral-400' });
      if (mz) out.push({ label: 'MAIZE', value: `₹${Number(mz.price_per_kg).toFixed(1)}/kg`, a: '', c: 'text-neutral-400' });
      if (fc?.signal) out.push({ label: '7D OUTLOOK', value: fc.signal.toUpperCase(), a: '', c: fc.signal === 'bullish' ? 'text-emerald-400' : fc.signal === 'bearish' ? 'text-red-400' : 'text-neutral-400' });
      setItems(out);
    });
    return () => { active = false; };
  }, []);

  return (
    <div className="sticky top-0 z-30 flex h-8 items-center gap-6 overflow-x-auto border-b border-neutral-800 bg-neutral-900 px-4 text-[11.5px] font-medium tracking-wide whitespace-nowrap">
      {items ? items.map((it) => (
        <span key={it.label} className="flex items-center gap-1.5 text-neutral-400">
          <span className="font-semibold text-neutral-500">{it.label}</span>
          <span className="text-neutral-100 tabular-nums">{it.value}</span>
          {it.delta != null && <span className={`tabular-nums ${it.c}`}>{it.a}{Math.abs(it.delta).toFixed(1)}</span>}
          {it.delta == null && it.a === '' && it.label === '7D OUTLOOK' && <span className={it.c}>●</span>}
        </span>
      )) : <span className="text-neutral-600">Loading market data…</span>}
    </div>
  );
}

/* ── Command palette (Cmd/Ctrl+K) ────────────────────────────────── */
function CommandPalette({ open, setOpen }) {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [zones, setZones] = useState([]);
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (open && !zones.length) {
      fetch(`${API_BASE}/zones`).then((r) => r.json()).then((d) => setZones(d.zones || [])).catch(() => {});
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const actions = useMemo(() => {
    const base = [
      { label: 'Go to Dashboard', hint: 'Market Intelligence', run: () => navigate('/app') },
      { label: 'Go to Feed Costs', hint: 'Operations', run: () => navigate('/app/raw-materials') },
      { label: 'Open AI Market Analyst', hint: 'Analysis', run: () => navigate('/app/analyst') },
      { label: 'Open public forecast page', hint: 'cefpl.in/forecast', run: () => navigate('/forecast') },
      { label: 'Open API documentation', hint: 'api.cefpl.in', run: () => window.open('https://api.cefpl.in/docs', '_blank') },
      ...zones.map((z) => ({ label: `Zone: ${z}`, hint: 'filter dashboard table', run: () => navigate(`/app?q=${encodeURIComponent(z)}`) })),
    ];
    const needle = q.toLowerCase();
    return needle ? base.filter((a) => a.label.toLowerCase().includes(needle)) : base.slice(0, 8);
  }, [q, zones, navigate]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[200] flex items-start justify-center bg-black/40 pt-[18vh]" onClick={() => setOpen(false)}>
      <div className="w-full max-w-lg overflow-hidden rounded-[10px] border border-neutral-700 bg-neutral-900 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <input
          autoFocus value={q} onChange={(e) => { setQ(e.target.value); setIdx(0); }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setIdx((i) => Math.min(i + 1, actions.length - 1)); }
            if (e.key === 'ArrowUp') { e.preventDefault(); setIdx((i) => Math.max(i - 1, 0)); }
            if (e.key === 'Enter' && actions[idx]) { actions[idx].run(); setOpen(false); }
            if (e.key === 'Escape') setOpen(false);
          }}
          placeholder="Search pages, zones, actions…"
          className="w-full border-b border-neutral-800 bg-transparent px-4 py-3 text-[14px] text-neutral-100 placeholder-neutral-500 outline-none"
        />
        <div className="max-h-72 overflow-y-auto py-1">
          {actions.map((a, i) => (
            <button
              key={a.label} onMouseEnter={() => setIdx(i)}
              onClick={() => { a.run(); setOpen(false); }}
              className={`flex w-full items-center justify-between px-4 py-2 text-left text-[13px] ${i === idx ? 'bg-neutral-800 text-white' : 'text-neutral-300'}`}
            >
              <span>{a.label}</span>
              <span className="text-[11px] text-neutral-500">{a.hint}</span>
            </button>
          ))}
          {!actions.length && <p className="px-4 py-6 text-center text-[13px] text-neutral-500">No matches</p>}
        </div>
      </div>
    </div>
  );
}

/* ── Shell ───────────────────────────────────────────────────────── */
const NAV_GROUPS = [
  { heading: 'Market Intelligence', items: [{ to: '/app', end: true, label: 'Dashboard' }] },
  { heading: 'Commodities', items: [{ to: '/app/feedsight', end: true, label: 'Mandi Forecast (FeedSight)' }, { to: '/app/feedsight/accuracy', label: 'Forecast Accuracy' }] },
  { heading: 'Operations', items: [{ to: '/app/raw-materials', label: 'Feed Costs' }] },
  { heading: 'Analysis', items: [{ to: '/app/analyst', label: 'AI Market Analyst' }] },
];

export default function AppShell({ user, loading, handleLogout }) {
  const profile = useProfile(user);
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPaletteOpen((o) => !o); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center bg-white text-sm text-neutral-400">Loading…</div>;
  }
  if (!user) return <Navigate to="/" replace />;

  return (
    <div className="portal flex min-h-screen flex-col bg-[#fafafa] font-sans text-neutral-900">
      <MarketPulse />
      <CommandPalette key={paletteOpen ? 'open' : 'closed'} open={paletteOpen} setOpen={setPaletteOpen} />
      <div className="flex flex-1">
        <aside className="fixed bottom-0 left-0 top-8 z-20 flex w-52 flex-col border-r border-neutral-200 bg-white">
          <Link to="/" className="flex items-center gap-2 border-b border-neutral-200 px-4 py-3">
            <span className="text-[14px] font-bold tracking-tight">EggSight</span>
            <span className="rounded-sm bg-neutral-100 px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wider text-neutral-500">Terminal</span>
          </Link>

          <button
            onClick={() => setPaletteOpen(true)}
            className="mx-3 mt-3 flex cursor-pointer items-center gap-2 rounded-[6px] border border-neutral-200 px-2.5 py-1.5 text-[12px] text-neutral-400 hover:border-neutral-300 hover:text-neutral-600"
          >
            <Command size={12} /> Search… <kbd className="ml-auto rounded border border-neutral-200 px-1 text-[10px]">⌘K</kbd>
          </button>

          <nav className="flex-1 px-3 py-3">
            {NAV_GROUPS.map((g) => (
              <div key={g.heading} className="mb-4">
                <p className="px-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-neutral-400">{g.heading}</p>
                {g.items.map((item) => (
                  <NavLink
                    key={item.to} to={item.to} end={item.end}
                    className={({ isActive }) =>
                      `block rounded-[6px] px-2.5 py-1.5 text-[13px] font-medium ${
                        isActive ? 'bg-emerald-700/10 text-emerald-800' : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900'
                      }`
                    }
                  >
                    {item.label}
                  </NavLink>
                ))}
              </div>
            ))}
          </nav>

          <div className="border-t border-neutral-200 px-4 py-2.5">
            <p className="truncate text-[12px] font-semibold">{user.email}</p>
            <div className="mt-1 flex items-center justify-between">
              <span className={`rounded-sm px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wider ${
                profile?.role === 'admin' ? 'bg-emerald-700/10 text-emerald-800' : 'bg-neutral-100 text-neutral-500'
              }`}>
                {profile?.role || '…'}
              </span>
              <button onClick={handleLogout} className="flex cursor-pointer items-center gap-1 text-[11.5px] font-medium text-neutral-400 hover:text-red-600">
                <LogOut size={12} /> Sign out
              </button>
            </div>
          </div>
        </aside>

        <main className="ml-52 flex-1 px-6 py-5">
          <Outlet context={{ user, profile }} />
        </main>
      </div>
    </div>
  );
}
