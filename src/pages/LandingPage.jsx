import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Link, useOutletContext } from 'react-router-dom';
import { TrendingUp, TrendingDown, Minus, ArrowRight } from 'lucide-react';
import { modulesData } from '../data/modules';

const MotionDiv = motion.div;
const API_BASE = import.meta.env.VITE_EGGSIGHT_API_URL || 'http://localhost:8000';

function LiveMarketStrip() {
  const [data, setData] = useState(null);

  useEffect(() => {
    fetch(`${API_BASE}/forecast`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setData)
      .catch(() => setData(null));
  }, []);

  if (!data) return null;

  const fmt = (n) => (n == null ? '--' : Number(n).toLocaleString('en-IN', { maximumFractionDigits: 1 }));
  const d14 = data.forecast?.['14_day'];
  const d7 = data.forecast?.['7_day'];
  const SignalIcon = data.signal === 'bullish' ? TrendingUp : data.signal === 'bearish' ? TrendingDown : Minus;
  const signalColor = data.signal === 'bullish' ? 'text-emerald-600' : data.signal === 'bearish' ? 'text-red-600' : 'text-[var(--color-text-muted)]';

  return (
    <Link
      to="/forecast"
      className="inline-flex flex-wrap items-center justify-center gap-x-5 gap-y-2 rounded-full border border-[var(--color-border)] bg-white px-6 py-3 shadow-sm hover:shadow-airtable transition-shadow text-[15px]"
    >
      <span className="flex items-center gap-2 font-semibold text-[var(--color-text-main)]">
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500"></span>
        </span>
        NECC Hyderabad today: ₹{fmt(data.current_price)}
      </span>
      {d7 && (
        <span className="text-[var(--color-text-muted)]">
          7-day <span className="font-semibold text-[var(--color-text-main)]">₹{fmt(d7.price)}</span>
        </span>
      )}
      {d14 && (
        <span className="text-[var(--color-text-muted)]">
          14-day <span className="font-semibold text-[var(--color-text-main)]">₹{fmt(d14.price)}</span>
        </span>
      )}
      <span className={`flex items-center gap-1.5 font-semibold capitalize ${signalColor}`}>
        <SignalIcon size={16} /> {data.signal}
      </span>
      <span className="flex items-center gap-1 font-semibold text-[var(--color-accent)]">
        Full forecast <ArrowRight size={15} />
      </span>
    </Link>
  );
}

export default function LandingPage() {
  const { user, setShowLoginModal } = useOutletContext();

  const slideUp = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 30 } },
  };

  const staggerContainer = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1 },
    },
  };

  return (
    <>
      {/* HERO */}
      <section className="pt-44 pb-20 px-6 relative z-10 bg-[var(--color-bg-alt)] border-b border-[var(--color-border)] overflow-hidden">
        <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-[700px] h-[700px] bg-white rounded-full opacity-60 blur-3xl pointer-events-none"></div>
        <MotionDiv
          initial="hidden" animate="visible" variants={staggerContainer}
          className="max-w-4xl mx-auto text-center space-y-7 relative z-10"
        >
          <MotionDiv variants={slideUp}>
            <h1 className="font-bold text-5xl md:text-6xl text-display leading-tight">
              Chatrapati Egg Farms
            </h1>
          </MotionDiv>
          <MotionDiv variants={slideUp}>
            <LiveMarketStrip />
          </MotionDiv>
          <MotionDiv variants={slideUp}>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Link
                to="/forecast"
                className="inline-block rounded-[12px] bg-[var(--color-accent)] px-7 py-3.5 text-[15.5px] font-semibold text-white shadow-airtable transition-all duration-150 hover:-translate-y-0.5 hover:bg-[var(--color-accent-hover)] hover:shadow-lg"
              >
                View Live Forecast
              </Link>
              <a
                href="#platform"
                className="inline-block rounded-[12px] border border-[var(--color-border)] bg-white px-7 py-3.5 text-[15.5px] font-semibold text-[var(--color-text-main)] transition-all duration-150 hover:-translate-y-0.5 hover:shadow-airtable"
              >
                Explore the Platform
              </a>
            </div>
          </MotionDiv>
        </MotionDiv>
      </section>

      {/* PLATFORM MODULES */}
      <section id="platform" className="pt-24 pb-24 px-6 relative z-10 bg-white flex-1 scroll-mt-20">
        <div className="max-w-7xl mx-auto">
          <MotionDiv 
            initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-50px" }} variants={slideUp}
            className="text-center mb-14 space-y-4 max-w-3xl mx-auto"
          >
            <h2 className="font-bold text-4xl md:text-5xl text-display">The EggSight Platform</h2>
            <p className="text-[17px] text-[var(--color-text-muted)] text-body">
              Six modules. Operations, health, feed, and markets — one system.
            </p>
          </MotionDiv>

          <MotionDiv
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-50px" }}
            variants={staggerContainer}
            className="mx-auto max-w-3xl border-y border-[var(--color-border)] divide-y divide-[var(--color-border)]"
          >
            {modulesData.map((mod) => (
              <MotionDiv key={mod.id} variants={slideUp}>
                <Link
                  to={`/module/${mod.id}`}
                  className="group flex items-center gap-5 px-3 py-5 transition-colors hover:bg-[var(--color-bg-alt)]"
                >
                  <span className="w-6 shrink-0 text-[13px] font-semibold tabular-nums text-[var(--color-text-muted)]">
                    {mod.num}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-3">
                      <h3 className="text-[16px] font-semibold text-[var(--color-text-main)]">{mod.title}</h3>
                      <span className="hidden sm:inline text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                        {mod.tag}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-[14px] text-[var(--color-text-muted)]">{mod.desc}</p>
                  </div>
                  <svg
                    width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                    className="shrink-0 text-[var(--color-border)] transition-colors group-hover:text-[var(--color-accent)]"
                  >
                    <polyline points="9 18 15 12 9 6"></polyline>
                  </svg>
                </Link>
              </MotionDiv>
            ))}
          </MotionDiv>
        </div>
      </section>

      {/* CALL TO ACTION */}
      <section className="py-24 px-6 bg-[var(--color-bg-alt)] border-t border-[var(--color-border)] relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-white rounded-full opacity-50 blur-3xl pointer-events-none"></div>
        <MotionDiv 
          initial="hidden" whileInView="visible" viewport={{ once: true }} variants={slideUp}
          className="max-w-3xl mx-auto text-center space-y-8 relative z-10"
        >
          <h2 className="font-bold text-4xl md:text-5xl text-display">Team Access</h2>
          <p className="text-[17px] text-[var(--color-text-muted)] text-body max-w-2xl mx-auto">
            For authorized CEFPL managers and supervisors.
          </p>
          {user ? (
            <a
              href="/app"
              className="inline-block bg-[var(--color-accent)] text-white px-8 py-4 rounded-[12px] font-semibold text-lg hover:bg-[var(--color-accent-hover)] transition-all duration-150 shadow-airtable hover:shadow-lg transform hover:-translate-y-1 text-button"
            >
              Open EggSight Portal
            </a>
          ) : (
            <button
              onClick={() => setShowLoginModal(true)}
              className="inline-block bg-[var(--color-accent)] text-white px-8 py-4 rounded-[12px] font-semibold text-lg hover:bg-[var(--color-accent-hover)] transition-all duration-150 shadow-airtable hover:shadow-lg transform hover:-translate-y-1 text-button cursor-pointer"
            >
              Sign In to Access
            </button>
          )}
        </MotionDiv>
      </section>
    </>
  );
}
