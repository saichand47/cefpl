import React, { useEffect, useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Link, useOutletContext } from 'react-router-dom';
import { ChevronRight, ArrowRight } from 'lucide-react';
import { modulesData } from '../data/modules';

const MotionDiv = motion.div;
const API_BASE = import.meta.env.VITE_EGGSIGHT_API_URL || 'http://localhost:8000';

const fmt = (n) => (n == null ? '--' : Number(n).toLocaleString('en-IN', { maximumFractionDigits: 1 }));
const sign = (n) => (n == null ? '--' : `${n >= 0 ? '+' : '−'}${Math.abs(Number(n)).toFixed(1)}`);
const deltaColor = (n) => (n > 0 ? 'text-positive-strong' : n < 0 ? 'text-negative' : 'text-text-muted');

const SIGNAL_PILL = {
  bullish: { label: 'Bullish', cls: 'bg-accent/10 text-positive-strong' },
  bearish: { label: 'Bearish', cls: 'bg-negative/10 text-negative' },
  neutral: { label: 'Neutral', cls: 'bg-neutral-100 text-text-muted' },
};

/* ── Live instrument card: ink history + dashed green forecast continuation ── */
function InstrumentCard() {
  const [data, setData] = useState(null);
  const [accuracy, setAccuracy] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE}/forecast`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => (d ? setData(d) : setFailed(true)))
      .catch(() => setFailed(true));
    fetch(`${API_BASE}/accuracy`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setAccuracy)
      .catch(() => {});
  }, []);

  const chart = useMemo(() => {
    const hist = data?.history;
    if (!hist || hist.length < 2) return null;
    const histPrices = hist.slice(-30).map((d) => Number(d.price));
    const fc = [
      data.forecast?.['1_day']?.price,
      data.forecast?.['7_day']?.price,
      data.forecast?.['14_day']?.price,
    ].filter((v) => v != null).map(Number);
    const all = [...histPrices, ...fc];
    const min = Math.min(...all), max = Math.max(...all), span = max - min || 1;
    const W = 100, H = 100;
    const n = all.length;
    const pt = (v, i) => [
      (i / (n - 1)) * W,
      H - 6 - ((v - min) / span) * (H - 12),
    ];
    const seg = (vals, offset) =>
      vals.map((v, i) => {
        const [x, y] = pt(v, offset + i);
        return `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`;
      }).join('');
    const histLine = seg(histPrices, 0);
    const lastHistX = pt(histPrices[histPrices.length - 1], histPrices.length - 1);
    const fcLine = fc.length
      ? seg([histPrices[histPrices.length - 1], ...fc], histPrices.length - 1)
      : null;
    const area = `${histLine}L${lastHistX[0].toFixed(1)},${H}L0,${H}Z`;
    const end = fc.length ? pt(fc[fc.length - 1], n - 1) : lastHistX;
    return { histLine, fcLine, area, end };
  }, [data]);

  // Delta vs previous session, falling back to the model's 1-day change.
  const delta = useMemo(() => {
    if (!data) return null;
    const hist = data.history;
    if (hist?.length >= 2) return Number(data.current_price) - Number(hist[hist.length - 2].price);
    return data.forecast?.['1_day']?.change ?? null;
  }, [data]);

  if (failed) return null;

  if (!data) {
    return (
      <div className="rounded-modal border border-border bg-white p-6 shadow-airtable">
        <div className="h-4 w-40 animate-pulse rounded bg-neutral-100" />
        <div className="mt-4 h-10 w-32 animate-pulse rounded bg-neutral-100" />
        <div className="mt-4 h-24 animate-pulse rounded bg-neutral-100" />
        <div className="mt-4 h-10 animate-pulse rounded bg-neutral-100" />
      </div>
    );
  }

  const deltaPct = delta != null && data.current_price ? (delta / (Number(data.current_price) - delta)) * 100 : null;
  const pill = SIGNAL_PILL[data.signal] || SIGNAL_PILL.neutral;
  const horizons = [
    { k: '1-day', d: data.forecast?.['1_day'] },
    { k: '7-day', d: data.forecast?.['7_day'] },
    { k: '14-day', d: data.forecast?.['14_day'] },
  ];

  return (
    <div className="overflow-hidden rounded-modal border border-border bg-white shadow-airtable">
      <div className="flex items-center justify-between border-b border-border px-6 py-3.5">
        <div className="flex items-baseline gap-2.5">
          <span className="text-[15px] font-bold text-text-main">Hyderabad</span>
          <span className="num text-[11px] text-text-muted">NECC · ₹/100 eggs</span>
        </div>
        <span className="micro-label flex items-center gap-1.5 rounded-pill bg-accent/10 px-2.5 py-1 text-[9.5px] text-positive-strong">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60"></span>
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
          </span>
          Live
        </span>
      </div>

      <div className="px-6 pt-5">
        <p className="micro-label text-[10px] text-text-muted">Current rate</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-3">
          <span className="num text-[34px] font-semibold leading-none text-text-main">₹{fmt(data.current_price)}</span>
          {delta != null && (
            <span className={`num text-[14px] font-semibold ${deltaColor(delta)}`}>
              {delta > 0 ? '▲' : delta < 0 ? '▼' : '—'} {Math.abs(delta).toFixed(1)}
              {deltaPct != null && ` (${Math.abs(deltaPct).toFixed(1)}%)`}
            </span>
          )}
          <span className={`micro-label rounded-pill px-2.5 py-1 text-[9.5px] ${pill.cls}`}>{pill.label}</span>
        </div>

        {chart && (
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="mt-4 h-24 w-full">
            <path d={chart.area} fill="rgba(27,25,21,0.05)" />
            <path
              d={chart.histLine} pathLength="1" className="draw-on"
              fill="none" stroke="#1b1915" strokeWidth="1.6" vectorEffect="non-scaling-stroke"
            />
            {chart.fcLine && (
              <path
                d={chart.fcLine} fill="none" stroke="#059669" strokeWidth="1.6"
                strokeDasharray="4 3" vectorEffect="non-scaling-stroke"
              />
            )}
            <circle cx={chart.end[0]} cy={chart.end[1]} r="2.2" fill="#059669" />
          </svg>
        )}

        <div className="mt-4 grid grid-cols-3 divide-x divide-border border-t border-border">
          {horizons.map(({ k, d }) => (
            <div key={k} className="px-3 py-2.5 first:pl-0 last:pr-0">
              <p className="micro-label text-[10px] text-text-muted">{k}</p>
              <p className="num mt-0.5 text-[15px] font-semibold text-text-main">₹{fmt(d?.price)}</p>
              <p className={`num text-[11.5px] font-medium ${deltaColor(d?.change)}`}>{sign(d?.change)}</p>
            </div>
          ))}
        </div>

        <div className="num flex flex-wrap justify-between gap-x-4 gap-y-1 border-t border-border py-3 text-[10px] text-text-muted">
          <span>SOURCE: NECC · UPD 06:00 / 14:00 IST</span>
          {accuracy?.mape_1d != null && <span>MODEL MAPE {accuracy.mape_1d}% (1D)</span>}
        </div>
      </div>

      <Link
        to="/forecast"
        className="group flex items-center justify-between border-t border-border bg-bg-alt px-6 py-3 text-[13.5px] font-semibold text-accent transition-colors hover:bg-accent/[0.06]"
      >
        Open full forecast &amp; model reasoning
        <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
      </Link>
    </div>
  );
}

/* ── Trust strip: source, cadence, accuracy, access ─────────────────── */
function TrustStrip({ mape }) {
  const items = [
    { label: 'Data source', value: 'Official NECC rates', desc: 'All 37 zones, straight from NECC declarations — no scraped estimates.' },
    { label: 'Update cadence', value: 'Twice daily', desc: '06:00 and 14:00 IST, minutes after rates are declared.' },
    { label: 'Model accuracy', value: mape != null ? `MAPE ${mape}% (30d)` : 'Tracked daily', desc: 'Every forecast shows its typical error in ₹ — nothing is hidden.' },
    { label: 'Access', value: 'Built for CEFPL operations', desc: 'Portal access is restricted to authorized CEFPL team members.' },
  ];
  return (
    <section className="border-b border-border bg-bg-alt px-6">
      <div className="mx-auto grid max-w-7xl divide-y divide-border sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-4 lg:divide-x">
        {items.map((it) => (
          <div key={it.label} className="py-6 sm:px-6 first:lg:pl-0 last:lg:pr-0">
            <p className="micro-label text-[10px] text-text-muted">{it.label}</p>
            <p className="mt-1.5 text-[15px] font-bold text-text-main">{it.value}</p>
            <p className="mt-1 text-[13px] leading-relaxed text-text-muted">{it.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ── Platform modules: hairline-divided grid, honest LIVE / COMING SOON ── */
function ModuleRow({ mod }) {
  const inner = (
    <>
      <span className="num w-7 shrink-0 pt-0.5 text-[12px] font-medium text-text-muted">{mod.num}</span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <h3 className="text-[16px] font-semibold text-text-main">{mod.title}</h3>
          <span className="micro-label rounded-chip bg-neutral-100 px-1.5 py-0.5 text-[9.5px] text-text-muted">
            {mod.tag}
          </span>
        </div>
        <p className="mt-1 text-[13.5px] leading-relaxed text-text-muted">{mod.desc}</p>
        <p className="micro-label mt-2.5 flex items-center gap-1.5 text-[10px]">
          {mod.live ? (
            <>
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              <span className="text-positive-strong">Live</span>
            </>
          ) : (
            <span className="text-text-muted">Coming soon</span>
          )}
        </p>
      </div>
      {mod.live && (
        <ChevronRight size={16} className="mt-1 shrink-0 text-border transition-colors group-hover:text-accent" />
      )}
    </>
  );

  if (mod.live) {
    return (
      <Link to={mod.href} className="group flex items-start gap-4 bg-white p-6 transition-colors hover:bg-accent/[0.04]">
        {inner}
      </Link>
    );
  }
  return <div className="flex items-start gap-4 bg-bg-alt p-6">{inner}</div>;
}

export default function LandingPage() {
  useOutletContext(); // layout owns auth state
  const reduceMotion = useReducedMotion();
  const [mape, setMape] = useState(null);

  useEffect(() => {
    fetch(`${API_BASE}/accuracy`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setMape(d?.mape_1d ?? null))
      .catch(() => {});
  }, []);

  const slideUp = {
    hidden: { opacity: reduceMotion ? 1 : 0, y: reduceMotion ? 0 : 12 },
    visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 30 } },
  };

  // Hero is above the fold: keep content fully opaque and only slide it, so a
  // slow first paint never shows a blank/greyed-out headline before the
  // animation runs.
  const heroContainer = {
    hidden: {},
    visible: { transition: { staggerChildren: reduceMotion ? 0 : 0.06 } },
  };
  const heroItem = {
    hidden: { opacity: 1, y: reduceMotion ? 0 : 12 },
    visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 30 } },
  };

  const liveCount = modulesData.filter((m) => m.live).length;

  return (
    <>
      {/* HERO */}
      <section className="relative border-b border-border bg-white px-6 pb-16 pt-14 md:pt-16">
        <div className="mx-auto grid max-w-7xl items-center gap-14 lg:grid-cols-[1.05fr_0.95fr]">
          <MotionDiv initial="hidden" animate="visible" variants={heroContainer} className="space-y-6">
            <MotionDiv variants={heroItem}>
              <p className="micro-label flex items-center gap-2.5 text-[11px] text-accent">
                <span className="h-px w-5 bg-accent" />
                EggSight · Market Intelligence
              </p>
            </MotionDiv>
            <MotionDiv variants={heroItem}>
              <h1 className="text-display text-[38px] font-bold leading-[1.06] md:text-[47px]">
                Sell smarter with a 14-day egg price outlook.
              </h1>
            </MotionDiv>
            <MotionDiv variants={heroItem}>
              <p className="text-body max-w-[470px] text-[17px] leading-relaxed text-text-muted">
                EggSight pairs live NECC rates across 37 zones with machine-learning forecasts
                and feed-cost tracking — so Chatrapati Egg Farms decides on data, not instinct.
              </p>
            </MotionDiv>
            <MotionDiv variants={heroItem}>
              <div className="flex flex-wrap items-center gap-3">
                <Link
                  to="/forecast"
                  className="inline-block rounded-card bg-accent px-7 py-3.5 text-[15.5px] font-semibold text-white shadow-airtable transition-all duration-150 hover:-translate-y-0.5 hover:bg-accent-hover active:scale-[0.97]"
                >
                  View live forecast
                </Link>
                <Link
                  to="/app"
                  className="inline-block rounded-card border border-border bg-white px-7 py-3.5 text-[15.5px] font-semibold text-text-main transition-all duration-150 hover:-translate-y-0.5 hover:shadow-airtable active:scale-[0.97]"
                >
                  Open Portal
                </Link>
              </div>
            </MotionDiv>
            <MotionDiv variants={heroItem}>
              <p className="num flex flex-wrap items-center gap-x-2 gap-y-1 text-[11.5px] text-text-muted">
                <span>37 NECC zones</span>
                <span className="text-border">·</span>
                <span>Updated 06:00 &amp; 14:00 IST</span>
                <span className="text-border">·</span>
                <span>Price history since 2009</span>
              </p>
            </MotionDiv>
          </MotionDiv>

          <MotionDiv
            initial={{ opacity: reduceMotion ? 1 : 0, y: reduceMotion ? 0 : 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30, delay: 0.15 }}
          >
            <InstrumentCard />
          </MotionDiv>
        </div>
      </section>

      {/* TRUST STRIP */}
      <TrustStrip mape={mape} />

      {/* PLATFORM MODULES */}
      <section id="platform" className="relative flex-1 scroll-mt-24 bg-white px-6 py-20">
        <div className="mx-auto max-w-5xl">
          <MotionDiv
            initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-50px' }} variants={slideUp}
            className="mb-10 flex flex-wrap items-end justify-between gap-4"
          >
            <div className="space-y-3">
              <p className="micro-label text-[11px] text-accent">The platform</p>
              <h2 className="text-display text-[32px] font-bold md:text-[38px]">Six modules, one operating picture</h2>
              <p className="text-body text-[16px] text-text-muted">
                Operations, health, feed, and markets — captured once and connected end to end.
              </p>
            </div>
            <p className="micro-label text-[11px] text-text-muted">
              {String(liveCount).padStart(2, '0')} live · {String(modulesData.length - liveCount).padStart(2, '0')} in build
            </p>
          </MotionDiv>

          <MotionDiv
            initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-50px' }} variants={slideUp}
            className="grid overflow-hidden border border-border sm:grid-cols-2"
          >
            {modulesData.map((mod) => (
              <div key={mod.id} className="-mb-px -mr-px border-b border-r border-border">
                <ModuleRow mod={mod} />
              </div>
            ))}
          </MotionDiv>
        </div>
      </section>
    </>
  );
}
