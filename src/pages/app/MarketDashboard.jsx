import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

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

function Kpi({ label, value, suffix, delta, spark, animate }) {
  const display = useCountUp(animate ? value : null);
  const shown = animate && display != null ? display : value;
  return (
    <div className="flex min-w-0 flex-1 items-center justify-between gap-2 border-r border-neutral-200 px-4 py-2.5 last:border-r-0">
      <div className="min-w-0">
        <p className="truncate text-[10.5px] font-bold uppercase tracking-wider text-neutral-400">{label}</p>
        <div className="flex items-baseline gap-1.5">
          <span className="text-[19px] font-bold tabular-nums leading-tight">{value == null ? '--' : `₹${fmt(shown, 1)}`}</span>
          {suffix && <span className="text-[11px] text-neutral-400">{suffix}</span>}
          {delta != null && (
            <span className={`text-[11.5px] font-semibold tabular-nums ${delta > 0 ? 'text-emerald-700' : delta < 0 ? 'text-red-600' : 'text-neutral-400'}`}>
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
    return <div className="h-[320px] animate-pulse rounded-[4px] bg-neutral-100" />;
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
              <line x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} stroke="#e5e5e5" strokeWidth="1" />
              <text x={PAD.l - 6} y={y(v) + 3} textAnchor="end" fontSize="10" fill="#a3a3a3" className="tabular-nums">{v.toFixed(0)}</text>
            </g>
          );
        })}
        <path d={bandPath} fill="#05966914" className="confidence-band" />
        <path d={histPath} fill="none" stroke="#171717" strokeWidth="1.6" />
        <path d={fcPath} fill="none" stroke="#059669" strokeWidth="1.6" strokeDasharray="5 3" />
        {series.fc.map((p, i) => <circle key={i} cx={x(fcStart + 1 + i)} cy={y(p.price)} r="3" fill="#059669" />)}
        <line x1={x(fcStart)} x2={x(fcStart)} y1={PAD.t} y2={H - PAD.b} stroke="#d4d4d4" strokeWidth="1" strokeDasharray="2 3" />
        <text x={x(fcStart) + 4} y={PAD.t + 9} fontSize="9" fill="#a3a3a3">TODAY</text>
        {hover != null && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={PAD.t} y2={H - PAD.b} stroke="#737373" strokeWidth="1" />
            <circle cx={x(hover)} cy={y(all[hover].price)} r="3.5" fill="#171717" />
          </g>
        )}
      </svg>
      {hover != null && (
        <div className="pointer-events-none absolute left-2 top-2 rounded-[4px] border border-neutral-200 bg-white px-2.5 py-1.5 text-[11.5px] shadow-sm">
          <span className="font-semibold tabular-nums">{all[hover].date}</span>
          <span className="ml-2 font-bold tabular-nums">₹{fmt(all[hover].price)}</span>
          {all[hover].type === 'fc' && all[hover].lo != null && (
            <span className="ml-2 text-neutral-400 tabular-nums">[{fmt(all[hover].lo, 0)}–{fmt(all[hover].hi, 0)}]</span>
          )}
          {all[hover].type === 'fc' && <span className="ml-1.5 text-emerald-700">forecast</span>}
        </div>
      )}
    </div>
  );
}

/* ── Dashboard ───────────────────────────────────────────────────── */
const RANGES = [{ k: '30D', v: 30 }, { k: '90D', v: 90 }, { k: '1Y', v: 365 }];

export default function MarketDashboard() {
  const [params] = useSearchParams();
  const [full, setFull] = useState(null);
  const [latest, setLatest] = useState(null);
  const [accuracy, setAccuracy] = useState(null);
  const [history, setHistory] = useState(null);
  const [range, setRange] = useState(90);
  const [query, setQuery] = useState(params.get('q') || '');
  const [sort, setSort] = useState({ key: 'change_1d', dir: -1 });

  useEffect(() => { setQuery(params.get('q') || ''); }, [params]);


  useEffect(() => {
    fetch(`${API_BASE}/forecast/full`).then((r) => r.json()).then(setFull).catch(() => {});
    fetch(`${API_BASE}/latest`).then((r) => r.json()).then(setLatest).catch(() => {});
    fetch(`${API_BASE}/accuracy`).then((r) => r.json()).then(setAccuracy).catch(() => {});
    fetch(`${API_BASE}/history/Hyderabad?days=400`).then((r) => r.json()).then((d) => setHistory(d.data)).catch(() => {});
  }, []);

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
      className={`sticky top-0 cursor-pointer select-none bg-neutral-50 px-3 py-1.5 text-[10.5px] font-bold uppercase tracking-wider text-neutral-500 hover:text-neutral-800 ${right ? 'text-right' : 'text-left'}`}
    >
      {label}{sort.key === key ? (sort.dir === -1 ? ' ↓' : ' ↑') : ''}
    </th>
  );

  return (
    <div className="mx-auto max-w-[1200px] space-y-4">
      {/* KPI strip */}
      <div className="flex divide-neutral-200 rounded-[4px] border border-neutral-200 bg-white">
        {full ? (
          <>
            <Kpi label="NECC Hyderabad" value={full.current_price} delta={latest?.zones?.find((z) => z.zone === 'Hyderabad')?.change_1d} spark={spark} animate />
            <Kpi label="1-Day Forecast" value={full.forecast_1d?.predicted_price} delta={full.forecast_1d?.predicted_change} animate />
            <Kpi label="7-Day Forecast" value={full.forecast_7d?.predicted_price} delta={full.forecast_7d?.predicted_change} animate />
            <Kpi label="14-Day Forecast" value={full.forecast_14d?.predicted_price} delta={full.forecast_14d?.predicted_change} animate />
            <div className="flex flex-1 items-center justify-between px-4 py-2.5">
              <div>
                <p className="text-[10.5px] font-bold uppercase tracking-wider text-neutral-400">Signal</p>
                <p className={`text-[19px] font-bold uppercase leading-tight ${full.signal === 'bullish' ? 'text-emerald-700' : full.signal === 'bearish' ? 'text-red-600' : 'text-neutral-500'}`}>
                  {full.signal}
                </p>
              </div>
            </div>
          </>
        ) : (
          <div className="h-[58px] w-full animate-pulse bg-neutral-100" />
        )}
      </div>

      {/* Main chart */}
      <div className="rounded-[4px] border border-neutral-200 bg-white">
        <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-2">
          <div className="flex items-baseline gap-3">
            <h2 className="text-[13px] font-bold">Hyderabad — price & forecast</h2>
            <span className="text-[11px] text-neutral-400">₹ per 100 eggs · dashed = model forecast · shaded = 80% confidence</span>
          </div>
          <div className="flex rounded-[4px] border border-neutral-200">
            {RANGES.map((r) => (
              <button
                key={r.k} onClick={() => setRange(r.v)}
                className={`cursor-pointer px-2.5 py-1 text-[11.5px] font-semibold transition-colors ${range === r.v ? 'bg-neutral-900 text-white' : 'text-neutral-500 hover:text-neutral-900'}`}
              >
                {r.k}
              </button>
            ))}
          </div>
        </div>
        <div className="px-2 py-2">
          <ForecastChart history={history} full={full} range={range} />
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-1 border-t border-neutral-200 px-4 py-1.5 text-[11px] text-neutral-400">
          {accuracy?.mape_1d != null
            ? <><span>1D MAPE <b className="text-neutral-700">{accuracy.mape_1d}%</b></span><span>1D MAE <b className="text-neutral-700">₹{accuracy.mae_1d}</b></span>{accuracy.mape_7d != null && <span>7D MAPE <b className="text-neutral-700">{accuracy.mape_7d}%</b></span>}<span>{accuracy.total_forecasts_evaluated} forecasts evaluated</span></>
            : <span>Model accuracy appears after forecasts are evaluated against actuals.</span>}
        </div>
      </div>

      {/* Zone table */}
      <div className="rounded-[4px] border border-neutral-200 bg-white">
        <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-2">
          <h2 className="text-[13px] font-bold">NECC zones <span className="ml-1 font-normal text-neutral-400">{zones.length} of {latest?.zones?.length ?? '--'}</span></h2>
          <input
            value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filter…"
            className="w-40 rounded-[4px] border border-neutral-200 px-2 py-1 text-[12px] outline-none focus:border-neutral-400"
          />
        </div>
        <div className="max-h-[380px] overflow-y-auto">
          <table className="w-full text-[12.5px]">
            <thead>
              <tr className="border-b border-neutral-200">
                {th('Zone', 'zone')}{th('Date', 'date')}{th('Price ₹/100', 'price', true)}{th('1D Δ', 'change_1d', true)}
              </tr>
            </thead>
            <tbody>
              {latest ? zones.map((z) => (
                <tr key={z.zone} className={`border-b border-neutral-100 last:border-0 hover:bg-neutral-50 ${z.zone === 'Hyderabad' ? 'bg-emerald-50/50 font-semibold' : ''}`}>
                  <td className="px-3 py-1.5">{z.zone}</td>
                  <td className="px-3 py-1.5 text-neutral-400 tabular-nums">{z.date}</td>
                  <td className="px-3 py-1.5 text-right font-semibold tabular-nums">{fmt(z.price)}</td>
                  <td className={`px-3 py-1.5 text-right font-semibold tabular-nums ${z.change_1d > 0 ? 'text-emerald-700' : z.change_1d < 0 ? 'text-red-600' : 'text-neutral-400'}`}>
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
    </div>
  );
}
