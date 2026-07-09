import React, { useEffect, useMemo, useRef, useState } from 'react';
import { NavLink, useSearchParams } from 'react-router-dom';
import { supabase } from '../../supabaseClient';

const API_BASE = import.meta.env.VITE_EGGSIGHT_API_URL || 'http://localhost:8000';
const fmt = (n, d = 1) => (n == null ? '--' : Number(n).toLocaleString('en-IN', { maximumFractionDigits: d }));

/* Smooth count-up when a numeric value changes */
function useCountUp(target, dur = 500) {
  const [val, setVal] = useState(target);
  const prev = useRef(target);
  useEffect(() => {
    if (target == null || prev.current == null) { prev.current = target; setVal(target); return undefined; }
    const from = prev.current, t0 = performance.now();
    let raf;
    const tick = (t) => {
      const p = Math.min((t - t0) / dur, 1);
      setVal(from + (target - from) * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    prev.current = target;
    return () => cancelAnimationFrame(raf);
  }, [target, dur]);
  return val;
}

function Spark({ data, w = 72, h = 22 }) {
  if (!data || data.length < 2) return null;
  const min = Math.min(...data), max = Math.max(...data), span = max - min || 1;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - 2 - ((v - min) / span) * (h - 4)}`).join(' ');
  const up = data[data.length - 1] >= data[0];
  return (
    <svg width={w} height={h} className="shrink-0">
      <polyline points={pts} fill="none" stroke={up ? '#059669' : '#dc2626'} strokeWidth="1.5" />
    </svg>
  );
}

/* Flash the cell green/red when a live value changes */
function useFlash(value) {
  const prev = useRef(value);
  const [flash, setFlash] = useState('');
  useEffect(() => {
    if (value != null && prev.current != null && value !== prev.current) {
      setFlash(value > prev.current ? 'flash-up' : 'flash-down');
      const t = setTimeout(() => setFlash(''), 1000);
      prev.current = value;
      return () => clearTimeout(t);
    }
    prev.current = value;
    return undefined;
  }, [value]);
  return flash;
}

function Kpi({ label, value, suffix, delta, spark, animate }) {
  const display = useCountUp(animate ? value : null);
  const shown = animate && display != null ? display : value;
  const flash = useFlash(value);
  return (
    <div className={`flex min-w-0 flex-1 items-center justify-between gap-2 border-r border-line px-4 py-2.5 last:border-r-0 ${flash}`}>
      <div className="min-w-0">
        <p className="micro-label truncate text-[9.5px] text-text-muted">{label}</p>
        <div className="flex items-baseline gap-1.5">
          <span className="num text-[19px] font-semibold leading-tight">{value == null ? '--' : `₹${fmt(shown, 1)}`}</span>
          {suffix && <span className="text-[11px] text-text-muted">{suffix}</span>}
          {delta != null && (
            <span className={`num text-[11.5px] font-semibold ${delta > 0 ? 'text-positive' : delta < 0 ? 'text-negative' : 'text-text-muted'}`}>
              {delta > 0 ? '▲' : delta < 0 ? '▼' : '—'}{Math.abs(delta).toFixed(1)}
            </span>
          )}
        </div>
      </div>
      {spark && <Spark data={spark} />}
    </div>
  );
}

/* ── Institutional chart: history + forecast + confidence band ──── */
function ForecastChart({ history, full, range }) {
  const [hover, setHover] = useState(null);
  const W = 920, H = 320, PAD = { l: 46, r: 14, t: 14, b: 24 };

  const series = useMemo(() => {
    if (!history?.length) return null;
    const hist = history.slice(-range).map((d) => ({ date: d.date, price: d.price, type: 'hist' }));
    const last = hist[hist.length - 1];
    const fc = [];
    if (full?.forecast_1d) fc.push({ date: full.forecast_1d.target_date, price: full.forecast_1d.predicted_price, lo: full.forecast_1d.confidence_80?.low, hi: full.forecast_1d.confidence_80?.high, type: 'fc' });
    if (full?.forecast_7d) fc.push({ date: full.forecast_7d.target_date, price: full.forecast_7d.predicted_price, lo: full.forecast_7d.confidence_80?.low, hi: full.forecast_7d.confidence_80?.high, type: 'fc' });
    if (full?.forecast_14d) fc.push({ date: full.forecast_14d.target_date, price: full.forecast_14d.predicted_price, lo: full.forecast_14d.confidence_80?.low, hi: full.forecast_14d.confidence_80?.high, type: 'fc' });
    return { hist, fc, last };
  }, [history, full, range]);

  if (!series) {
    return <div className="h-[320px] animate-pulse rounded-panel bg-neutral-100" />;
  }

  const all = [...series.hist, ...series.fc];
  const ys = all.flatMap((p) => [p.price, p.lo, p.hi]).filter((v) => v != null);
  const yMin = Math.min(...ys) - 8, yMax = Math.max(...ys) + 8;
  const x = (i) => PAD.l + (i / (all.length - 1)) * (W - PAD.l - PAD.r);
  const y = (v) => PAD.t + (1 - (v - yMin) / (yMax - yMin)) * (H - PAD.t - PAD.b);

  const histPath = series.hist.map((p, i) => `${i ? 'L' : 'M'}${x(i)},${y(p.price)}`).join('');
  const fcStart = series.hist.length - 1;
  const fcPath = [series.last, ...series.fc].map((p, i) => `${i ? 'L' : 'M'}${x(fcStart + i)},${y(p.price)}`).join('');
  const bandPts = [series.last, ...series.fc];
  const bandPath = bandPts.map((p, i) => `${i ? 'L' : 'M'}${x(fcStart + i)},${y(p.hi ?? p.price)}`).join('')
    + bandPts.slice().reverse().map((p, i) => `L${x(fcStart + bandPts.length - 1 - i)},${y(p.lo ?? p.price)}`).join('') + 'Z';

  const gridLines = 5;
  const onMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    const i = Math.round(((px - PAD.l) / (W - PAD.l - PAD.r)) * (all.length - 1));
    if (i >= 0 && i < all.length) setHover(i);
  };

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
        {Array.from({ length: gridLines + 1 }).map((_, i) => {
          const v = yMin + ((yMax - yMin) * i) / gridLines;
          return (
            <g key={i}>
              <line x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} stroke="#eceae4" strokeWidth="1" />
              <text x={PAD.l - 6} y={y(v) + 3} textAnchor="end" fontSize="10" fill="#6f6a61" fontFamily="IBM Plex Mono, monospace">{v.toFixed(0)}</text>
            </g>
          );
        })}
        <path d={bandPath} fill="#05966914" className="confidence-band" />
        <path d={histPath} fill="none" stroke="#1b1915" strokeWidth="1.6" />
        <path d={fcPath} fill="none" stroke="#059669" strokeWidth="1.6" strokeDasharray="5 3" />
        {series.fc.map((p, i) => <circle key={i} cx={x(fcStart + 1 + i)} cy={y(p.price)} r="3" fill="#059669" />)}
        <line x1={x(fcStart)} x2={x(fcStart)} y1={PAD.t} y2={H - PAD.b} stroke="#d8d5cd" strokeWidth="1" strokeDasharray="2 3" />
        <text x={x(fcStart) + 4} y={PAD.t + 9} fontSize="9" fill="#6f6a61" fontFamily="IBM Plex Mono, monospace">TODAY</text>
        {hover != null && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={PAD.t} y2={H - PAD.b} stroke="#6f6a61" strokeWidth="1" />
            <circle cx={x(hover)} cy={y(all[hover].price)} r="3.5" fill="#1b1915" />
          </g>
        )}
      </svg>
      {hover != null && (
        <div className="pointer-events-none absolute left-2 top-2 num rounded-panel border border-line bg-white px-2.5 py-1.5 text-[11.5px] shadow-airtable">
          <span className="font-medium">{all[hover].date}</span>
          <span className="ml-2 font-semibold">₹{fmt(all[hover].price)}</span>
          {all[hover].type === 'fc' && all[hover].lo != null && (
            <span className="ml-2 text-text-muted">[{fmt(all[hover].lo, 0)}–{fmt(all[hover].hi, 0)}]</span>
          )}
          {all[hover].type === 'fc' && <span className="ml-1.5 text-positive">forecast</span>}
        </div>
      )}
    </div>
  );
}

/* ── Right column: feed costs / volatility / analyst insight ─────── */
function FeedCostsPanel() {
  const [mats, setMats] = useState(null);
  useEffect(() => {
    let active = true;
    supabase.from('raw_material_prices').select('material, price_per_kg, recorded_on')
      .order('recorded_on', { ascending: false }).limit(40)
      .then(({ data }) => { if (active) setMats(data || []); });
    return () => { active = false; };
  }, []);

  const rows = useMemo(() => {
    if (!mats) return null;
    return [
      { id: 'soybean_meal', label: 'Soybean meal (DOC)' },
      { id: 'maize', label: 'Maize' },
    ].map(({ id, label }) => {
      const entries = mats.filter((m) => m.material === id);
      const latest = entries[0], prev = entries[1];
      const delta = latest && prev ? Number(latest.price_per_kg) - Number(prev.price_per_kg) : null;
      return { label, price: latest ? Number(latest.price_per_kg) : null, delta };
    }).filter((r) => r.price != null);
  }, [mats]);

  return (
    <div className="rounded-panel border border-line bg-white">
      <div className="flex items-baseline justify-between border-b border-line px-4 py-2">
        <h3 className="text-[13px] font-bold">Feed costs</h3>
        <span className="micro-label text-[9px] text-text-muted">Solapur mandi</span>
      </div>
      <div className="px-4 py-1">
        {rows == null ? (
          <div className="my-2 h-10 animate-pulse rounded bg-neutral-100" />
        ) : rows.length ? rows.map((r) => (
          <div key={r.label} className="flex items-center justify-between border-b border-line/60 py-2 last:border-0">
            <span className="text-[12.5px] text-text-secondary">{r.label}</span>
            <span className="num text-[12.5px] font-semibold">
              ₹{r.price.toFixed(1)}/kg
              {r.delta != null && r.delta !== 0 && (
                <span className={`ml-1.5 ${r.delta > 0 ? 'text-negative' : 'text-positive'}`}>
                  {r.delta > 0 ? '▲' : '▼'}{Math.abs(r.delta).toFixed(1)}
                </span>
              )}
            </span>
          </div>
        )) : (
          <p className="py-3 text-[12px] text-text-muted">No quotes yet — add them under Feed Costs.</p>
        )}
      </div>
      <NavLink to="/app/raw-materials" className="block border-t border-line px-4 py-2 text-[12px] font-semibold text-accent hover:text-accent-hover">
        Open Feed Costs →
      </NavLink>
    </div>
  );
}

function VolatilityPanel({ context }) {
  const vol = context?.volatility;
  if (!vol?.last30) return null;
  const ratio = vol.prev30 ? vol.last30 / vol.prev30 : null;
  const elevated = ratio != null && ratio >= 1.3;
  return (
    <div className="rounded-panel border border-line bg-white">
      <div className="flex items-baseline justify-between border-b border-line px-4 py-2">
        <h3 className="text-[13px] font-bold">Volatility</h3>
        <span className="micro-label text-[9px] text-text-muted">30-day σ</span>
      </div>
      <div className="px-4 py-3">
        <div className="flex items-baseline gap-2.5">
          <span className="num text-[22px] font-semibold leading-none">₹{vol.last30.toFixed(1)}</span>
          {ratio != null && (
            <span className={`micro-label rounded-chip px-1.5 py-0.5 text-[9px] ${elevated ? 'bg-amber-50 text-amber-800' : 'bg-neutral-100 text-text-muted'}`}>
              {ratio.toFixed(1)}× prior month
            </span>
          )}
        </div>
        <p className="mt-2 text-[11.5px] leading-relaxed text-text-muted">
          Daily swings averaged ₹{vol.last30.toFixed(1)}{vol.prev30 ? ` vs ₹${vol.prev30.toFixed(1)} last month` : ''}.
          {elevated ? ' Wider swings widen the 7- and 14-day confidence bands.' : ' Stable swings keep the confidence bands tight.'}
        </p>
      </div>
    </div>
  );
}

function AnalystInsightPanel({ context, signal }) {
  const insight = useMemo(() => {
    if (!context?.change) return null;
    const d7 = context.change.d7;
    if (d7 == null) return null;
    const dir = d7 > 0 ? 'gain' : 'decline';
    const sig = signal ? `The model holds a ${signal} 7-day view.` : '';
    return `Hyderabad's ₹${Math.abs(d7)} weekly ${dir} comes with ${context.national_avg ? `the zone trading near the national average (₹${context.national_avg})` : 'mixed cross-zone signals'}. ${sig}`;
  }, [context, signal]);

  if (!insight) return null;
  return (
    <div className="rounded-panel border border-line bg-white">
      <div className="flex items-baseline justify-between border-b border-line px-4 py-2">
        <h3 className="text-[13px] font-bold">Analyst insight</h3>
        <span className="num text-[9.5px] text-text-muted">LIVE CONTEXT</span>
      </div>
      <p className="px-4 py-3 text-[12.5px] leading-relaxed text-text-secondary">{insight}</p>
      <NavLink to="/app/analyst" className="block border-t border-line px-4 py-2 text-[12px] font-semibold text-accent hover:text-accent-hover">
        Ask the analyst →
      </NavLink>
    </div>
  );
}

/* ── Dashboard ───────────────────────────────────────────────────── */
const RANGES = [{ k: '30D', v: 30 }, { k: '60D', v: 60 }, { k: '90D', v: 90 }];

export default function MarketDashboard() {
  const [params] = useSearchParams();
  const [full, setFull] = useState(null);
  const [latest, setLatest] = useState(null);
  const [accuracy, setAccuracy] = useState(null);
  const [history, setHistory] = useState(null);
  const [context, setContext] = useState(null);
  const [zoneList, setZoneList] = useState([]);
  const [zone, setZone] = useState('Hyderabad');
  const [zoneHistory, setZoneHistory] = useState(null);
  const [range, setRange] = useState(90);
  const [query, setQuery] = useState(params.get('q') || '');
  const [sort, setSort] = useState({ key: 'change_1d', dir: -1 });

  useEffect(() => { setQuery(params.get('q') || ''); }, [params]);


  useEffect(() => {
    fetch(`${API_BASE}/forecast/full`).then((r) => r.json()).then(setFull).catch(() => {});
    fetch(`${API_BASE}/latest`).then((r) => r.json()).then(setLatest).catch(() => {});
    fetch(`${API_BASE}/accuracy`).then((r) => r.json()).then(setAccuracy).catch(() => {});
    fetch(`${API_BASE}/history/Hyderabad?days=400`).then((r) => r.json()).then((d) => setHistory(d.data)).catch(() => {});
    fetch(`${API_BASE}/analyst/context`).then((r) => r.json()).then(setContext).catch(() => {});
    fetch(`${API_BASE}/zones`).then((r) => r.json()).then((d) => setZoneList(d.zones || [])).catch(() => {});
  }, []);

  // Non-Hyderabad zones show history only (the model forecasts Hyderabad).
  useEffect(() => {
    if (zone === 'Hyderabad') { setZoneHistory(null); return undefined; }
    let active = true;
    setZoneHistory(null);
    fetch(`${API_BASE}/history/${encodeURIComponent(zone)}?days=400`)
      .then((r) => r.json())
      .then((d) => { if (active) setZoneHistory(d.data || []); })
      .catch(() => { if (active) setZoneHistory([]); });
    return () => { active = false; };
  }, [zone]);

  const spark = useMemo(() => history?.slice(-30).map((d) => d.price), [history]);

  const zones = useMemo(() => {
    let z = latest?.zones || [];
    if (query) z = z.filter((x) => x.zone.toLowerCase().includes(query.toLowerCase()));
    return [...z].sort((a, b) => {
      const av = a[sort.key], bv = b[sort.key];
      if (typeof av === 'string') return sort.dir * av.localeCompare(bv);
      return sort.dir * (Math.abs(bv ?? 0) - Math.abs(av ?? 0)) * -1;
    });
  }, [latest, query, sort]);

  const th = (label, key, right) => (
    <th
      onClick={() => setSort((s) => ({ key, dir: s.key === key ? -s.dir : -1 }))}
      className={`micro-label sticky top-0 cursor-pointer select-none bg-bg-alt px-3 py-1.5 text-[9.5px] text-text-muted hover:text-text-main ${right ? 'text-right' : 'text-left'}`}
    >
      {label}{sort.key === key ? (sort.dir === -1 ? ' ↓' : ' ↑') : ''}
    </th>
  );

  return (
    <div className="mx-auto max-w-[1200px] space-y-4">
      {/* KPI strip */}
      <div className="flex divide-line rounded-panel border border-line bg-white">
        {full ? (
          <>
            <Kpi label="NECC Hyderabad" value={full.current_price} delta={latest?.zones?.find((z) => z.zone === 'Hyderabad')?.change_1d} spark={spark} animate />
            <Kpi label="1-Day Forecast" value={full.forecast_1d?.predicted_price} delta={full.forecast_1d?.predicted_change} animate />
            <Kpi label="7-Day Forecast" value={full.forecast_7d?.predicted_price} delta={full.forecast_7d?.predicted_change} animate />
            <Kpi label="14-Day Forecast" value={full.forecast_14d?.predicted_price} delta={full.forecast_14d?.predicted_change} animate />
            <div className="flex flex-1 items-center justify-between px-4 py-2.5">
              <div>
                <p className="micro-label text-[9.5px] text-text-muted">Signal</p>
                <p className={`num text-[17px] font-semibold uppercase leading-tight ${full.signal === 'bullish' ? 'text-positive' : full.signal === 'bearish' ? 'text-negative' : 'text-text-muted'}`}>
                  {full.signal}
                </p>
              </div>
            </div>
          </>
        ) : (
          <div className="h-[58px] w-full animate-pulse rounded-panel bg-neutral-100" />
        )}
      </div>

      {/* Main chart + right column */}
      <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
        <div className="rounded-panel border border-line bg-white">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-2">
            <div className="flex flex-wrap items-baseline gap-3">
              <select
                value={zone} onChange={(e) => setZone(e.target.value)}
                className="rounded-panel border border-line px-2 py-1 text-[12.5px] font-bold outline-none focus:border-accent"
              >
                {(zoneList.length ? zoneList : ['Hyderabad']).map((z) => <option key={z}>{z}</option>)}
              </select>
              <span className="text-[11px] text-text-muted">
                ₹ per 100 eggs{zone === 'Hyderabad' ? ' · dashed = model forecast · shaded = 80% confidence' : ' · history only (forecast covers Hyderabad)'}
              </span>
            </div>
            <div className="flex rounded-panel border border-line">
              {RANGES.map((r) => (
                <button
                  key={r.k} onClick={() => setRange(r.v)}
                  className={`num cursor-pointer px-2.5 py-1 text-[11px] font-semibold transition-colors ${range === r.v ? 'bg-accent text-white' : 'text-text-muted hover:text-text-main'}`}
                >
                  {r.k}
                </button>
              ))}
            </div>
          </div>
          <div className="px-2 py-2">
            <ForecastChart
              history={zone === 'Hyderabad' ? history : zoneHistory}
              full={zone === 'Hyderabad' ? full : null}
              range={range}
            />
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-1 border-t border-line px-4 py-1.5 text-[11px] text-text-muted">
            {accuracy?.mape_1d != null
              ? <><span>1D MAPE <b className="num font-semibold text-text-secondary">{accuracy.mape_1d}%</b></span><span>1D MAE <b className="num font-semibold text-text-secondary">₹{accuracy.mae_1d}</b></span>{accuracy.mape_7d != null && <span>7D MAPE <b className="num font-semibold text-text-secondary">{accuracy.mape_7d}%</b></span>}<span>{accuracy.total_forecasts_evaluated} forecasts evaluated</span></>
              : <span>Model accuracy appears after forecasts are evaluated against actuals.</span>}
            <span className="num ml-auto text-[10px]">SOURCE: NECC · UPD 06:00 IST</span>
          </div>
        </div>

        <div className="space-y-4">
          <FeedCostsPanel />
          <VolatilityPanel context={context} />
          <AnalystInsightPanel context={context} signal={full?.signal} />
        </div>
      </div>

      {/* Zone table */}
      <div className="rounded-panel border border-line bg-white">
        <div className="flex items-center justify-between border-b border-line px-4 py-2">
          <h2 className="text-[13px] font-bold">NECC zones <span className="num ml-1 text-[11px] font-normal text-text-muted">{zones.length} of {latest?.zones?.length ?? '--'}</span></h2>
          <input
            value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filter…"
            className="w-40 rounded-panel border border-line px-2 py-1 text-[12px] outline-none focus:border-accent"
          />
        </div>
        <div className="max-h-[320px] overflow-y-auto">
          <table className="w-full text-[12.5px]">
            <thead>
              <tr className="border-b border-line">
                {th('Zone', 'zone')}{th('Date', 'date')}{th('Price ₹/100', 'price', true)}{th('1D Δ', 'change_1d', true)}
              </tr>
            </thead>
            <tbody>
              {latest ? zones.map((z) => (
                <tr key={z.zone} className={`border-b border-line/60 last:border-0 hover:bg-bg-alt ${z.zone === 'Hyderabad' ? 'bg-accent/[0.06] font-semibold' : ''}`}>
                  <td className="px-3 py-1.5">{z.zone}</td>
                  <td className="num px-3 py-1.5 text-text-muted">{z.date}</td>
                  <td className="num px-3 py-1.5 text-right font-semibold">{fmt(z.price)}</td>
                  <td className={`num px-3 py-1.5 text-right font-semibold ${z.change_1d > 0 ? 'text-positive' : z.change_1d < 0 ? 'text-negative' : 'text-text-muted'}`}>
                    {z.change_1d == null ? '--' : `${z.change_1d > 0 ? '▲' : z.change_1d < 0 ? '▼' : '—'}${Math.abs(z.change_1d).toFixed(1)}`}
                  </td>
                </tr>
              )) : Array.from({ length: 8 }).map((_, i) => (
                <tr key={i}><td colSpan="4" className="px-3 py-2"><div className="h-3 animate-pulse rounded bg-neutral-100" /></td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="pb-2 text-[11px] text-text-muted">
        Forecasts are statistical estimates — not trading advice. Typical error (±₹) is the trailing-30-day MAE per horizon.
      </p>
    </div>
  );
}
