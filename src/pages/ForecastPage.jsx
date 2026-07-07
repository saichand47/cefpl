import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, CircleAlert, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';

const API_BASE = import.meta.env.VITE_EGGSIGHT_API_URL || 'http://localhost:8000';
const MotionDiv = motion.div;

function formatPrice(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '--';
  return Number(value).toFixed(1);
}

const SIGNALS = [
  { key: 'bearish', label: 'Bearish', dot: 'bg-negative' },
  { key: 'neutral', label: 'Neutral', dot: 'bg-text-muted' },
  { key: 'bullish', label: 'Bullish', dot: 'bg-positive' },
];

function signalMeta(signal) {
  if (signal === 'bullish') {
    return {
      label: 'Bullish',
      tint: 'border-emerald-200 bg-emerald-50/60',
      text: 'text-positive',
      explain: 'The model expects prices to rise — recent momentum and cross-zone strength point higher over the forecast window.',
    };
  }
  if (signal === 'bearish') {
    return {
      label: 'Bearish',
      tint: 'border-red-200 bg-red-50/60',
      text: 'text-negative',
      explain: 'The model expects prices to ease — recent weakness across the market points lower over the forecast window.',
    };
  }
  return {
    label: 'Neutral',
    tint: 'border-border bg-bg-alt',
    text: 'text-text-secondary',
    explain: 'No clear direction — recent volatility is high, so the model stays close to today\'s price.',
  };
}

const HISTORY_RANGES = [
  { k: '30D', days: 30 },
  { k: '90D', days: 90 },
  { k: '6M', days: 180 },
  { k: '1Y', days: 365 },
];

const _MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const _fmtAxisDate = (s) => {
  const [y, m, d] = s.split('-');
  return `${parseInt(d, 10)} ${_MONTHS[parseInt(m, 10) - 1]} '${y.slice(2)}`;
};

const CW = 720, CH = 300, CPAD = { l: 46, r: 14, t: 14, b: 26 };

function PriceHistoryChart({ apiBase }) {
  const [range, setRange] = useState(30);
  // Track which range the loaded rows belong to so `loading` can be derived
  // (avoids calling setState synchronously inside the effect).
  const [loaded, setLoaded] = useState({ range: null, rows: null });
  const [hover, setHover] = useState(null); // index into series

  useEffect(() => {
    let active = true;
    fetch(`${apiBase}/history/Hyderabad?days=${range}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (active) setLoaded({ range, rows: d?.data || [] }); })
      .catch(() => { if (active) setLoaded({ range, rows: [] }); });
    return () => { active = false; };
  }, [apiBase, range]);

  const loading = loaded.range !== range;
  const data = loaded.rows;

  const geo = useMemo(() => {
    const series = data || [];
    if (series.length < 2) return { series, ready: false };
    const prices = series.map((d) => Number(d.price));
    const minP = Math.min(...prices), maxP = Math.max(...prices);
    const pad = (maxP - minP) * 0.08 || 1;
    const lo = minP - pad, hi = maxP + pad;
    const x = (i) => CPAD.l + (i / (series.length - 1)) * (CW - CPAD.l - CPAD.r);
    const y = (v) => CPAD.t + (1 - (v - lo) / (hi - lo)) * (CH - CPAD.t - CPAD.b);
    const linePath = series.map((d, i) => `${i ? 'L' : 'M'}${x(i)},${y(d.price)}`).join('');
    const areaPath = `${linePath}L${x(series.length - 1)},${CH - CPAD.b}L${x(0)},${CH - CPAD.b}Z`;
    return { series, ready: true, lo, hi, x, y, linePath, areaPath };
  }, [data]);

  const onMove = (e) => {
    if (!geo.ready) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * CW;
    const i = Math.round(((px - CPAD.l) / (CW - CPAD.l - CPAD.r)) * (geo.series.length - 1));
    setHover(i >= 0 && i < geo.series.length ? i : null);
  };

  const gridN = 4;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-display text-xl font-bold text-text-main">Price History</h2>
          <p className="mt-1 text-sm text-text-muted">Hyderabad daily cleaned series · ₹ per 100 eggs</p>
        </div>
        <div className="flex rounded-card border border-border bg-white">
          {HISTORY_RANGES.map((r) => (
            <button
              key={r.k}
              onClick={() => { setRange(r.days); setHover(null); }}
              className={`num cursor-pointer px-3 py-1.5 text-[12px] font-semibold transition-colors first:rounded-l-[7px] last:rounded-r-[7px] ${range === r.days ? 'bg-accent text-white' : 'text-text-muted hover:text-text-main'}`}
            >
              {r.k}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="h-72 animate-pulse rounded-card bg-bg-alt" />
      ) : !geo.ready ? (
        <div className="flex h-72 items-center justify-center text-sm text-text-muted">Not enough data for this range.</div>
      ) : (
        <div className="relative">
          <svg viewBox={`0 0 ${CW} ${CH}`} className="w-full cursor-crosshair" onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
            {Array.from({ length: gridN + 1 }).map((_, i) => {
              const v = geo.lo + ((geo.hi - geo.lo) * i) / gridN;
              return (
                <g key={i}>
                  <line x1={CPAD.l} x2={CW - CPAD.r} y1={geo.y(v)} y2={geo.y(v)} stroke="#eceae4" strokeWidth="1" />
                  <text x={CPAD.l - 8} y={geo.y(v) + 3} textAnchor="end" fontSize="10.5" fill="#6f6a61" fontFamily="IBM Plex Mono, monospace">{v.toFixed(0)}</text>
                </g>
              );
            })}
            {[0, Math.floor((geo.series.length - 1) / 2), geo.series.length - 1].map((i) => (
              <text key={i} x={geo.x(i)} y={CH - 8} textAnchor="middle" fontSize="10.5" fill="#6f6a61" fontFamily="IBM Plex Mono, monospace">{_fmtAxisDate(geo.series[i].date)}</text>
            ))}
            <path d={geo.areaPath} fill="rgba(27,25,21,0.05)" />
            <path key={range} d={geo.linePath} pathLength="1" className="draw-on" fill="none" stroke="#1b1915" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />
            {hover != null && (
              <g>
                <line x1={geo.x(hover)} x2={geo.x(hover)} y1={CPAD.t} y2={CH - CPAD.b} stroke="#6f6a61" strokeWidth="1" strokeDasharray="3 3" />
                <circle cx={geo.x(hover)} cy={geo.y(geo.series[hover].price)} r="4" fill="#1b1915" stroke="#fff" strokeWidth="1.5" />
              </g>
            )}
          </svg>
          {hover != null && (
            <div className="num pointer-events-none absolute left-3 top-1 rounded-panel border border-border bg-white px-3 py-1.5 text-[12px] shadow-airtable">
              <span className="font-medium text-text-muted">{geo.series[hover].date}</span>
              <span className="ml-2 font-semibold text-text-main">₹{Number(geo.series[hover].price).toFixed(1)}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ForecastReasoning({ forecast, apiBase }) {
  const [context, setContext] = useState(null);

  useEffect(() => {
    let active = true;
    fetch(`${apiBase}/analyst/context`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (active) setContext(data); })
      .catch(() => {});
    return () => { active = false; };
  }, [apiBase]);

  if (!forecast || !context) return null;

  const { change, volatility, yoy, top_movers_7d, national_avg } = context;
  const price = forecast.current_price;

  // Build reasoning bullets from live data
  const bullets = [];

  // 1. Recent momentum
  if (change?.d7 != null) {
    const dir = change.d7 > 0 ? 'risen' : 'fallen';
    const pct = ((change.d7 / (price - change.d7)) * 100).toFixed(1);
    bullets.push(
      `Hyderabad prices have ${dir} ₹${Math.abs(change.d7)} over 7 days (${change.d7 > 0 ? '+' : ''}${pct}%). ` +
      (Math.abs(change.d7) > 30
        ? 'This rapid move often triggers a short-term correction in the model\'s 7- and 14-day outlook.'
        : 'The model weighs recent momentum heavily for the 1-day prediction.')
    );
  }

  // 2. Volatility regime
  if (volatility?.last30 != null && volatility?.prev30 != null) {
    const ratio = (volatility.last30 / volatility.prev30).toFixed(1);
    if (volatility.last30 > volatility.prev30 * 1.5) {
      bullets.push(
        `Market volatility has jumped ${ratio}x (₹${volatility.last30.toFixed(0)} vs ₹${volatility.prev30.toFixed(0)} prior month). ` +
        'Higher uncertainty widens the model\'s confidence bands and biases longer forecasts toward the mean.'
      );
    } else {
      bullets.push(
        `Volatility is stable at ₹${volatility.last30.toFixed(0)}, giving the model stronger confidence in its directional calls.`
      );
    }
  }

  // 3. Cross-zone signals (top movers)
  if (top_movers_7d?.length >= 2) {
    const topTwo = top_movers_7d.slice(0, 2);
    const allUp = topTwo.every((z) => z.change_7d > 0);
    const allDown = topTwo.every((z) => z.change_7d < 0);
    bullets.push(
      `Cross-zone leaders: ${topTwo.map((z) => `${z.zone} ${z.change_7d >= 0 ? '+' : ''}₹${z.change_7d}`).join(', ')}. ` +
      (allUp
        ? 'A broad national rally supports the model\'s near-term direction but also signals potential overextension.'
        : allDown
          ? 'Weakness across zones reinforces the model\'s bearish lean.'
          : 'Mixed signals across zones add uncertainty to the outlook.')
    );
  }

  // 4. National average comparison
  if (national_avg) {
    const diff = price - national_avg;
    const pct = ((diff / national_avg) * 100).toFixed(1);
    if (Math.abs(diff) > 10) {
      bullets.push(
        `Hyderabad at ₹${price} is ${diff > 0 ? `₹${diff.toFixed(0)} above` : `₹${Math.abs(diff).toFixed(0)} below`} the national average (₹${national_avg}), a ${Math.abs(pct)}% ${diff > 0 ? 'premium' : 'discount'}. ` +
        (diff > 20
          ? 'Historically, premiums this wide tend to narrow over 7–14 days.'
          : diff < -20
            ? 'Discounts this wide tend to close as arbitrage kicks in.'
            : '')
      );
    }
  }

  // 5. Year-over-year context
  if (yoy?.price_last_year && yoy?.premium_vs_last_year) {
    const pct = ((yoy.premium_vs_last_year / yoy.price_last_year) * 100).toFixed(0);
    bullets.push(
      `Compared to this date last year (₹${yoy.price_last_year}), current prices carry a ₹${yoy.premium_vs_last_year} premium (+${pct}%). ` +
      'The model factors in seasonal patterns from prior years when projecting the 14-day trend.'
    );
  }

  if (!bullets.length) return null;

  return (
    <div className="rounded-card border border-border bg-white px-6 py-5 shadow-airtable">
      <p className="micro-label text-[11px] text-text-muted">Model reasoning</p>
      <ol className="mt-4 space-y-3.5">
        {bullets.map((text, i) => (
          <li key={i} className="flex gap-4">
            <span className="num shrink-0 pt-0.5 text-[12px] font-medium text-accent">
              {String(i + 1).padStart(2, '0')}
            </span>
            <p className="text-sm leading-relaxed text-text-secondary">{text}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}

function KpiCard({ label, price, change, mae }) {
  return (
    <div className="rounded-card border border-border bg-white p-5 shadow-airtable">
      <p className="micro-label text-[10.5px] text-text-muted">{label}</p>
      <p className="num mt-3 text-3xl font-semibold text-text-main">₹{formatPrice(price)}</p>
      <div className="num mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-[13px]">
        {change != null ? (
          <span className={`font-semibold ${change > 0 ? 'text-positive' : change < 0 ? 'text-negative' : 'text-text-muted'}`}>
            {change >= 0 ? '+' : '−'}{formatPrice(Math.abs(change))}
          </span>
        ) : (
          <span className="text-text-muted">--</span>
        )}
        {mae != null && <span className="text-[11.5px] text-text-muted">±₹{Number(mae).toFixed(0)} typical</span>}
      </div>
    </div>
  );
}

export default function ForecastPage() {
  const [forecast, setForecast] = useState(null);
  const [accuracy, setAccuracy] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadForecast = async ({ showLoading = true } = {}) => {
    if (showLoading) {
      setLoading(true);
      setError('');
    }

    try {
      const response = await fetch(`${API_BASE}/forecast`);
      if (!response.ok) throw new Error(`Forecast service returned ${response.status}`);
      setForecast(await response.json());
    } catch (err) {
      setError(err.message || 'Forecast service is unavailable');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;

    fetch(`${API_BASE}/forecast`)
      .then((response) => {
        if (!response.ok) throw new Error(`Forecast service returned ${response.status}`);
        return response.json();
      })
      .then((data) => {
        if (active) setForecast(data);
      })
      .catch((err) => {
        if (active) setError(err.message || 'Forecast service is unavailable');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    fetch(`${API_BASE}/accuracy`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (active) setAccuracy(d); })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, []);

  const signal = signalMeta(forecast?.signal);

  return (
    <section className="min-h-[calc(100vh-80px)] bg-bg-alt px-6 pb-24 pt-12">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8">
          <Link to="/" className="group inline-flex items-center text-sm font-medium text-text-muted transition-colors hover:text-accent">
            <ArrowLeft size={16} className="mr-2 transition-transform group-hover:-translate-x-1" />
            Back to Platform
          </Link>
        </div>

        <MotionDiv
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="space-y-6"
        >
          <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div className="space-y-3">
              <div className="micro-label inline-flex items-center gap-2 rounded-chip border border-blue-200 bg-blue-50 px-2.5 py-1 text-[10.5px] text-badge-blue">
                Market Intelligence
              </div>
              <h1 className="text-display text-4xl font-bold text-text-main md:text-5xl">Hyderabad Egg Forecast</h1>
              <p className="text-body max-w-2xl text-[17px] leading-relaxed text-text-muted">
                Current NECC price, short-term model forecast, and recent Hyderabad market movement.
              </p>
            </div>
            <div className="flex flex-col items-start gap-2 md:items-end">
              <button
                onClick={loadForecast}
                disabled={loading}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-card border border-border bg-white px-4 text-sm font-semibold text-text-main shadow-airtable transition-colors hover:bg-bg-alt disabled:opacity-60"
              >
                <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                Refresh
              </button>
              <p className="num text-[10.5px] text-text-muted">
                SOURCE: NECC{forecast?.date ? ` · UPDATED ${forecast.date} 06:00/14:00 IST` : ' · UPDATED 2× DAILY'}
              </p>
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-3 rounded-card border border-amber-200 bg-amber-50 p-4 text-amber-800">
              <CircleAlert size={20} className="mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-semibold">Forecast service is not reachable</p>
                <p className="mt-1 text-sm leading-relaxed">
                  Start the API locally or set <span className="font-mono">VITE_EGGSIGHT_API_URL</span> to the deployed API URL. Current target: <span className="font-mono">{API_BASE}</span>.
                </p>
              </div>
            </div>
          )}

          {/* KPI row: forecasts with signed change AND honest ±₹ typical error */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard label="Current Price" price={forecast?.current_price} change={null} mae={null} />
            <KpiCard label="1-Day Forecast" price={forecast?.forecast?.['1_day']?.price} change={forecast?.forecast?.['1_day']?.change} mae={accuracy?.mae_1d} />
            <KpiCard label="7-Day Forecast" price={forecast?.forecast?.['7_day']?.price} change={forecast?.forecast?.['7_day']?.change} mae={accuracy?.mae_7d} />
            <KpiCard label="14-Day Forecast" price={forecast?.forecast?.['14_day']?.price} change={forecast?.forecast?.['14_day']?.change} mae={accuracy?.mae_14d} />
          </div>

          {/* Signal card explains itself */}
          <div className={`rounded-card border px-6 py-5 ${signal.tint}`}>
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="micro-label text-[10.5px] text-text-muted">Model Signal</p>
                <p className={`text-display mt-1 text-3xl font-bold ${forecast ? signal.text : 'text-text-muted'}`}>
                  {forecast ? signal.label : '--'}
                </p>
              </div>
              <div className="flex items-center gap-5">
                {SIGNALS.map((s) => {
                  const active = forecast?.signal === s.key || (!forecast?.signal && s.key === 'neutral' && forecast);
                  return (
                    <span key={s.key} className={`micro-label flex items-center gap-1.5 text-[10px] ${active ? 'text-text-main' : 'text-text-muted opacity-40'}`}>
                      <span className={`h-2 w-2 rounded-full ${s.dot} ${active ? '' : 'opacity-40'}`} />
                      {s.label}
                    </span>
                  );
                })}
              </div>
            </div>
            {forecast && <p className="mt-3 max-w-3xl text-sm leading-relaxed text-text-secondary">{signal.explain}</p>}
          </div>

          <ForecastReasoning forecast={forecast} apiBase={API_BASE} />

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_340px]">
            <div className="rounded-card border border-border bg-white p-5 shadow-airtable">
              <PriceHistoryChart apiBase={API_BASE} />
            </div>

            <div className="rounded-card border border-border bg-white p-5 shadow-airtable">
              <h2 className="text-display text-xl font-bold text-text-main">Latest Values</h2>
              <div className="mt-5 max-h-72 space-y-3 overflow-auto pr-1">
                {(forecast?.history || []).slice(-10).reverse().map((item) => (
                  <div key={item.date} className="num flex items-center justify-between rounded-panel bg-bg-alt px-3 py-2">
                    <span className="text-[13px] font-medium text-text-muted">{item.date}</span>
                    <span className="text-[13px] font-semibold text-text-main">₹{formatPrice(item.price)}</span>
                  </div>
                ))}
                {!forecast?.history?.length && (
                  <div className="rounded-panel bg-bg-alt px-3 py-4 text-sm text-text-muted">
                    No history loaded yet.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Honest-metrics disclaimer */}
          <div className="border-t border-border pt-5">
            <p className="max-w-4xl text-[12.5px] leading-relaxed text-text-muted">
              Forecasts are statistical estimates based on historical NECC price patterns — not trading
              advice. Typical error (±₹) is the trailing-30-day mean absolute error per horizon.
              {accuracy?.mape_1d != null && (
                <span className="num"> Model accuracy: MAPE {accuracy.mape_1d}% (1D){accuracy.mape_7d != null ? ` · ${accuracy.mape_7d}% (7D)` : ''} over {accuracy.total_forecasts_evaluated} evaluated forecasts.</span>
              )}
            </p>
          </div>
        </MotionDiv>
      </div>
    </section>
  );
}
