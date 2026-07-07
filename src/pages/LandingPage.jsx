import React, { useEffect, useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Link, useOutletContext } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { modulesData } from '../data/modules';

const MotionDiv = motion.div;
const API_BASE = import.meta.env.VITE_EGGSIGHT_API_URL || 'http://localhost:8000';

const fmt = (n) => (n == null ? '--' : Number(n).toLocaleString('en-IN', { maximumFractionDigits: 1 }));
const sign = (n) => (n == null ? '--' : `${n >= 0 ? '+' : '−'}${Math.abs(Number(n)).toFixed(1)}`);
const deltaColor = (n) => (n > 0 ? 'text-positive' : n < 0 ? 'text-negative' : 'text-text-muted');

/* ── Live forecast instrument card: the product working IS the hero image ── */
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

  const spark = useMemo(() => {
    const hist = data?.history;
    if (!hist || hist.length < 2) return null;
    const prices = hist.slice(-30).map((d) => Number(d.price));
    const min = Math.min(...prices), max = Math.max(...prices), span = max - min || 1;
    const W = 100, H = 100;
    const pts = prices.map((p, i) => [
      (i / (prices.length - 1)) * W,
      H - 6 - ((p - min) / span) * (H - 12),
    ]);
    const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join('');
    const area = `${line}L${W},${H}L0,${H}Z`;
    return { line, area };
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
      <div className="rounded-feature border border-border bg-white p-6 shadow-airtable">
        <div className="h-4 w-40 animate-pulse rounded bg-neutral-100" />
        <div className="mt-4 h-10 w-32 animate-pulse rounded bg-neutral-100" />
        <div className="mt-4 h-24 animate-pulse rounded bg-neutral-100" />
        <div className="mt-4 h-10 animate-pulse rounded bg-neutral-100" />
      </div>
    );
  }

  const horizons = [
    { k: '1D', d: data.forecast?.['1_day'] },
    { k: '7D', d: data.forecast?.['7_day'] },
    { k: '14D', d: data.forecast?.['14_day'] },
  ];

  return (
    <Link
      to="/forecast"
      className="block rounded-feature border border-border bg-white p-6 shadow-airtable transition-all duration-150 hover:-translate-y-0.5"
    >
      <div className="flex items-center justify-between">
        <span className="micro-label flex items-center gap-2 text-[11px] text-text-muted">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60"></span>
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
          </span>
          NECC Hyderabad · Live
        </span>
        <span className="num text-[11px] text-text-muted">{data.date || ''}</span>
      </div>

      <div className="mt-3 flex items-baseline gap-3">
        <span className="num text-4xl font-semibold text-text-main">₹{fmt(data.current_price)}</span>
        {delta != null && (
          <span className={`num text-[15px] font-semibold ${deltaColor(delta)}`}>{sign(delta)}</span>
        )}
        <span className="text-[13px] text-text-muted">per 100 eggs</span>
      </div>

      {spark && (
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="mt-4 h-24 w-full">
          <path d={spark.area} fill="rgba(27,25,21,0.05)" />
          <path
            d={spark.line} pathLength="1" className="draw-on"
            fill="none" stroke="#1b1915" strokeWidth="1.6" vectorEffect="non-scaling-stroke"
          />
        </svg>
      )}

      <div className="mt-4 grid grid-cols-3 divide-x divide-border border-y border-border">
        {horizons.map(({ k, d }) => (
          <div key={k} className="px-3 py-2.5 first:pl-0 last:pr-0">
            <p className="micro-label text-[10px] text-text-muted">{k} Forecast</p>
            <p className="num mt-0.5 text-[15px] font-semibold text-text-main">₹{fmt(d?.price)}</p>
            <p className={`num text-[11.5px] font-medium ${deltaColor(d?.change)}`}>{sign(d?.change)}</p>
          </div>
        ))}
      </div>

      <div className="num mt-4 flex flex-wrap justify-between gap-x-4 gap-y-1 text-[10.5px] text-text-muted">
        <span>SOURCE: NECC · UPD 06:00 / 14:00 IST</span>
        {accuracy?.mape_1d != null && <span>MODEL MAPE {accuracy.mape_1d}% (1D)</span>}
      </div>
    </Link>
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
              <span className="text-positive">Live</span>
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
  useOutletContext(); // layout owns auth state; CTA band lives in Layout
  const reduceMotion = useReducedMotion();

  const slideUp = {
    hidden: { opacity: reduceMotion ? 1 : 0, y: reduceMotion ? 0 : 12 },
    visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 30 } },
  };

  // Hero is above the fold: keep content fully opaque and only slide it, so a
  // slow first paint never shows a blank/greyed-out headline before the
  // animation runs.
  const heroContainer = {
    hidden: {},
    visible: { transition: { staggerChildren: reduceMotion ? 0 : 0.05 } },
  };
  const heroItem = {
    hidden: { opacity: 1, y: reduceMotion ? 0 : 12 },
    visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 30 } },
  };

  const liveCount = modulesData.filter((m) => m.live).length;

  return (
    <>
      {/* HERO */}
      <section className="relative border-b border-border bg-bg-alt px-6 pb-20 pt-16 md:pt-24">
        <div className="mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-[1.1fr_0.9fr]">
          <MotionDiv initial="hidden" animate="visible" variants={heroContainer} className="space-y-6">
            <MotionDiv variants={heroItem}>
              <p className="micro-label text-[12px] text-accent">Market intelligence for layer farming</p>
            </MotionDiv>
            <MotionDiv variants={heroItem}>
              <h1 className="text-display text-5xl font-bold leading-[1.05] md:text-6xl">
                Chatrapati Egg Farms
              </h1>
            </MotionDiv>
            <MotionDiv variants={heroItem}>
              <p className="text-body max-w-xl text-[17px] leading-relaxed text-text-muted">
                EggSight tracks live NECC rates across 37 zones and forecasts the Hyderabad egg
                price 1, 7, and 14 days out — so selling decisions run on data, not gut feel.
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

      {/* PLATFORM MODULES */}
      <section id="platform" className="relative flex-1 scroll-mt-16 bg-white px-6 pb-24 pt-24">
        <div className="mx-auto max-w-5xl">
          <MotionDiv
            initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-50px' }} variants={slideUp}
            className="mb-10 flex flex-wrap items-end justify-between gap-4"
          >
            <div className="space-y-3">
              <h2 className="text-display text-4xl font-bold">The EggSight Platform</h2>
              <p className="text-body text-[16px] text-text-muted">
                Operations, health, feed, and markets — one system.
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
