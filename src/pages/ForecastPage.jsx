import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, ArrowUpRight, CalendarDays, CircleAlert, Info, RefreshCw, TrendingDown, TrendingUp } from 'lucide-react';
import { Link } from 'react-router-dom';

const API_BASE = import.meta.env.VITE_EGGSIGHT_API_URL || 'http://localhost:8000';
const MotionDiv = motion.div;

function formatPrice(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '--';
  return Number(value).toFixed(1);
}

function getSignalStyles(signal) {
  if (signal === 'bullish') {
    return {
      label: 'Bullish',
      icon: TrendingUp,
      className: 'bg-green-50 text-green-700 border-green-200',
    };
  }

  if (signal === 'bearish') {
    return {
      label: 'Bearish',
      icon: TrendingDown,
      className: 'bg-red-50 text-red-700 border-red-200',
    };
  }

  return {
    label: 'Neutral',
    icon: ArrowUpRight,
    className: 'bg-blue-50 text-blue-700 border-blue-200',
  };
}

function ForecastChart({ history }) {
  const points = useMemo(() => {
    if (!history?.length) return [];

    const prices = history.map((item) => Number(item.price));
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const range = max - min || 1;

    return history.map((item, index) => {
      const x = history.length === 1 ? 0 : (index / (history.length - 1)) * 100;
      const y = 100 - ((Number(item.price) - min) / range) * 78 - 10;
      return { ...item, x, y };
    });
  }, [history]);

  const line = points.map((point) => `${point.x},${point.y}`).join(' ');

  return (
    <div className="h-72 rounded-[8px] border border-[var(--color-border)] bg-white p-4">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full overflow-visible">
        <defs>
          <linearGradient id="forecastFill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#1b61c9" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#1b61c9" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[20, 40, 60, 80].map((y) => (
          <line key={y} x1="0" x2="100" y1={y} y2={y} stroke="#e0e2e6" strokeWidth="0.35" />
        ))}
        {points.length > 1 && (
          <>
            <polygon points={`0,100 ${line} 100,100`} fill="url(#forecastFill)" />
            <polyline points={line} fill="none" stroke="#1b61c9" strokeWidth="2.2" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />
          </>
        )}
        {points.map((point) => (
          <circle key={point.date} cx={point.x} cy={point.y} r="1.4" fill="#1b61c9" vectorEffect="non-scaling-stroke" />
        ))}
      </svg>
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
    <div className="rounded-[8px] border border-blue-100 bg-blue-50/50 px-5 py-4">
      <div className="flex items-start gap-3">
        <Info size={18} className="mt-1 flex-shrink-0 text-blue-600" />
        <div className="space-y-2">
          <p className="text-sm font-semibold text-blue-900">Model reasoning</p>
          <ul className="space-y-1.5">
            {bullets.map((text, i) => (
              <li key={i} className="text-sm leading-relaxed text-blue-800">
                <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-blue-400 align-middle" />
                {text}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

export default function ForecastPage() {
  const [forecast, setForecast] = useState(null);
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

    return () => {
      active = false;
    };
  }, []);

  const signal = getSignalStyles(forecast?.signal);
  const SignalIcon = signal.icon;

  return (
    <section className="pt-32 pb-24 px-6 bg-[var(--color-bg-alt)] min-h-[calc(100vh-80px)]">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <Link to="/" className="inline-flex items-center text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition-colors font-medium text-sm group">
            <ArrowLeft size={16} className="mr-2 group-hover:-translate-x-1 transition-transform" />
            Back to Platform
          </Link>
        </div>

        <MotionDiv
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="space-y-6"
        >
          <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 rounded-[8px] border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-bold uppercase tracking-wider text-blue-700">
                Market Intelligence
              </div>
              <h1 className="text-display text-4xl md:text-5xl font-bold text-[var(--color-text-main)]">Hyderabad Egg Forecast</h1>
              <p className="max-w-2xl text-[17px] leading-relaxed text-[var(--color-text-muted)] text-body">
                Current NECC price, short-term model forecast, and recent Hyderabad market movement.
              </p>
            </div>
            <button
              onClick={loadForecast}
              disabled={loading}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-[8px] border border-[var(--color-border)] bg-white px-4 text-sm font-semibold text-[var(--color-text-main)] shadow-sm transition-colors hover:bg-gray-50 disabled:opacity-60"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>

          {error && (
            <div className="flex items-start gap-3 rounded-[8px] border border-amber-200 bg-amber-50 p-4 text-amber-800">
              <CircleAlert size={20} className="mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-semibold">Forecast service is not reachable</p>
                <p className="mt-1 text-sm leading-relaxed">
                  Start the API locally or set <span className="font-mono">VITE_EGGSIGHT_API_URL</span> to the deployed API URL. Current target: <span className="font-mono">{API_BASE}</span>.
                </p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
            <div className="rounded-[8px] border border-[var(--color-border)] bg-white p-5 shadow-sm">
              <p className="text-sm font-semibold text-[var(--color-text-muted)]">Current Price</p>
              <p className="mt-3 text-3xl font-bold text-[var(--color-text-main)]">₹{formatPrice(forecast?.current_price)}</p>
              <p className="mt-2 flex items-center gap-2 text-sm text-[var(--color-text-muted)]">
                <CalendarDays size={15} />
                {forecast?.date || 'Waiting for data'}
              </p>
            </div>

            <div className="rounded-[8px] border border-[var(--color-border)] bg-white p-5 shadow-sm">
              <p className="text-sm font-semibold text-[var(--color-text-muted)]">1-Day Forecast</p>
              <p className="mt-3 text-3xl font-bold text-[var(--color-text-main)]">₹{formatPrice(forecast?.forecast?.['1_day']?.price)}</p>
              <p className="mt-2 text-sm font-semibold text-[var(--color-text-muted)]">
                {forecast ? `${forecast.forecast['1_day'].change >= 0 ? '+' : ''}${formatPrice(forecast.forecast['1_day'].change)}` : '--'} change
              </p>
            </div>

            <div className="rounded-[8px] border border-[var(--color-border)] bg-white p-5 shadow-sm">
              <p className="text-sm font-semibold text-[var(--color-text-muted)]">7-Day Forecast</p>
              <p className="mt-3 text-3xl font-bold text-[var(--color-text-main)]">₹{formatPrice(forecast?.forecast?.['7_day']?.price)}</p>
              <p className="mt-2 text-sm font-semibold text-[var(--color-text-muted)]">
                {forecast ? `${forecast.forecast['7_day'].change >= 0 ? '+' : ''}${formatPrice(forecast.forecast['7_day'].change)}` : '--'} change
              </p>
            </div>

            <div className="rounded-[8px] border border-[var(--color-border)] bg-white p-5 shadow-sm">
              <p className="text-sm font-semibold text-[var(--color-text-muted)]">14-Day Forecast</p>
              <p className="mt-3 text-3xl font-bold text-[var(--color-text-main)]">₹{formatPrice(forecast?.forecast?.['14_day']?.price)}</p>
              <p className="mt-2 text-sm font-semibold text-[var(--color-text-muted)]">
                {forecast?.forecast?.['14_day'] ? `${forecast.forecast['14_day'].change >= 0 ? '+' : ''}${formatPrice(forecast.forecast['14_day'].change)} change` : 'Model warming up'}
              </p>
            </div>

            <div className={`rounded-[8px] border p-5 shadow-sm ${signal.className}`}>
              <p className="text-sm font-semibold opacity-80">Model Signal</p>
              <div className="mt-4 flex items-center gap-3">
                <SignalIcon size={28} />
                <p className="text-3xl font-bold">{forecast ? signal.label : '--'}</p>
              </div>
            </div>
          </div>

          <ForecastReasoning forecast={forecast} apiBase={API_BASE} />

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_340px]">
            <div className="rounded-[8px] border border-[var(--color-border)] bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-display text-xl font-bold text-[var(--color-text-main)]">30-Day Price History</h2>
                  <p className="mt-1 text-sm text-[var(--color-text-muted)]">Hyderabad daily cleaned price series</p>
                </div>
              </div>
              <ForecastChart history={forecast?.history || []} />
            </div>

            <div className="rounded-[8px] border border-[var(--color-border)] bg-white p-5 shadow-sm">
              <h2 className="text-display text-xl font-bold text-[var(--color-text-main)]">Latest Values</h2>
              <div className="mt-5 max-h-72 space-y-3 overflow-auto pr-1">
                {(forecast?.history || []).slice(-10).reverse().map((item) => (
                  <div key={item.date} className="flex items-center justify-between rounded-[8px] bg-[var(--color-bg-alt)] px-3 py-2">
                    <span className="text-sm font-medium text-[var(--color-text-muted)]">{item.date}</span>
                    <span className="text-sm font-bold text-[var(--color-text-main)]">₹{formatPrice(item.price)}</span>
                  </div>
                ))}
                {!forecast?.history?.length && (
                  <div className="rounded-[8px] bg-[var(--color-bg-alt)] px-3 py-4 text-sm text-[var(--color-text-muted)]">
                    No history loaded yet.
                  </div>
                )}
              </div>
            </div>
          </div>
        </MotionDiv>
      </div>
    </section>
  );
}
