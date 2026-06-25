import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../supabaseClient';

/* FeedSight — accuracy scoreboard. Internal CEFPL portal page.
   Reads Supabase accuracy views built from public.feedsight_outcomes (the weekly
   forecast-vs-realized scoring). Model-vs-naive, by crop/state/market/horizon,
   rolling 4w/12w, and an alert when the model underperforms naive. */

const fmt = (n, d = 1) => (n == null ? '--' : Number(n).toLocaleString('en-IN', { maximumFractionDigits: d }));
const HZ = { next_week: 'Next week', next_4w: 'Next 4 weeks' };
const better = (m, n) => (m == null || n == null ? null : Math.round((1 - m / n) * 1000) / 10); // % better than naive
const beatsCls = (b) => (b === true ? 'text-emerald-700' : b === false ? 'text-red-600' : 'text-neutral-400');

export default function FeedSightAccuracy() {
  const [rolling, setRolling] = useState(null);
  const [byCrop, setByCrop] = useState(null);
  const [byState, setByState] = useState(null);
  const [byMarket, setByMarket] = useState(null);
  const [err, setErr] = useState(null);
  const [crop, setCrop] = useState('');
  const [hz, setHz] = useState('next_week');

  useEffect(() => {
    let active = true;
    Promise.all([
      supabase.from('feedsight_accuracy_rolling').select('*'),
      supabase.from('feedsight_accuracy_by_crop').select('*'),
      supabase.from('feedsight_accuracy_by_state').select('*'),
      supabase.from('feedsight_accuracy_by_market').select('*'),
    ]).then(([r, c, s, m]) => {
      if (!active) return;
      const e = r.error || c.error || s.error || m.error;
      if (e) { setErr(e.message); return; }
      setRolling(r.data || []); setByCrop(c.data || []);
      setByState(s.data || []); setByMarket(m.data || []);
    });
    return () => { active = false; };
  }, []);

  const r12 = useMemo(() => (rolling || []).filter((x) => x.window === '12w'), [rolling]);
  const alerts = useMemo(() => r12.filter((x) => x.beats_naive === false), [r12]);
  const loading = rolling == null;

  const states = useMemo(() => [...new Set((byState || []).map((x) => x.state))].sort(), [byState]);
  const stateRows = useMemo(() => (byState || [])
    .filter((x) => (!crop || x.crop === crop) && x.horizon === hz)
    .sort((a, b) => (better(a.model_mae, a.naive_mae) ?? -99) - (better(b.model_mae, b.naive_mae) ?? -99) > 0 ? -1 : 1),
    [byState, crop, hz]);
  const marketRows = useMemo(() => (byMarket || [])
    .filter((x) => (!crop || x.crop === crop) && x.horizon === hz && x.n >= 4)
    .sort((a, b) => b.n - a.n), [byMarket, crop, hz]);

  function kpi(label, val, sub) {
    return (
      <div className="flex-1 border-r border-neutral-200 px-4 py-2.5 last:border-r-0">
        <p className="text-[10.5px] font-bold uppercase tracking-wider text-neutral-400">{label}</p>
        <p className="text-[19px] font-bold tabular-nums leading-tight">{val}</p>
        {sub && <p className="text-[11px] text-neutral-400">{sub}</p>}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1240px] space-y-4">
      <div className="rounded-[4px] border border-neutral-200 bg-white px-4 py-2 text-[12px] text-neutral-500">
        Forecast accuracy — each week's FeedSight forecast scored against the realized mandi modal price.
        Compares the served forecast (model blend, or naive fallback) to a pure naive last-price baseline. Lower MAE / higher directional % is better.
      </div>

      {alerts.length > 0 && (
        <div className="rounded-[4px] border border-red-300 bg-red-50 px-4 py-2.5 text-[12.5px] text-red-700">
          ⚠ <b>Underperformance alert:</b> over the trailing 12 weeks the model is NOT beating naive for{' '}
          {alerts.map((a) => `${a.crop ? a.crop + ' ' : ''}${HZ[a.horizon]}`).join(', ')}. Consider a retrain
          (<code>monthly_retrain.sh</code>) — it will keep the new model only if it passes the gate.
        </div>
      )}

      {/* 12-week headline */}
      <div className="flex flex-wrap rounded-[4px] border border-neutral-200 bg-white">
        {loading ? <div className="h-[58px] w-full animate-pulse bg-neutral-100" /> : (
          <>
            {['next_week', 'next_4w'].map((h) => {
              const row = r12.find((x) => x.horizon === h);
              if (!row) return kpi(HZ[h], '--');
              return (
                <React.Fragment key={h}>
                  {kpi(`${HZ[h]} — model MAE`, `₹${fmt(row.model_mae)}`, `naive ₹${fmt(row.naive_mae)}`)}
                  {kpi(`${HZ[h]} — vs naive`,
                    <span className={beatsCls(row.beats_naive)}>{better(row.model_mae, row.naive_mae)}%</span>,
                    `${row.beats_naive ? 'beats' : 'trails'} naive`)}
                  {kpi(`${HZ[h]} — dir. acc`, row.dir_acc_pct == null ? '--' : `${row.dir_acc_pct}%`, `${fmt(row.n, 0)} scored`)}
                </React.Fragment>
              );
            })}
          </>
        )}
      </div>
      {err && <div className="rounded-[4px] border border-red-200 bg-red-50 px-4 py-2 text-[12px] text-red-600">Failed to load accuracy: {err}. (Has the scorer run yet?)</div>}

      {/* rolling 4w/12w */}
      <div className="rounded-[4px] border border-neutral-200 bg-white">
        <div className="border-b border-neutral-200 px-4 py-2 text-[13px] font-bold">Rolling accuracy — model vs naive</div>
        <table className="w-full text-[12.5px]">
          <thead><tr className="border-b border-neutral-200 text-left text-[10.5px] uppercase tracking-wider text-neutral-500">
            <th className="px-3 py-1.5">Window</th><th className="px-3 py-1.5">Horizon</th>
            <th className="px-3 py-1.5 text-right">Model MAE</th><th className="px-3 py-1.5 text-right">Naive MAE</th>
            <th className="px-3 py-1.5 text-right">vs naive</th><th className="px-3 py-1.5 text-right">Dir. acc</th>
            <th className="px-3 py-1.5 text-right">n</th>
          </tr></thead>
          <tbody>
            {(rolling || []).sort((a, b) => (a.window + a.horizon).localeCompare(b.window + b.horizon)).map((x, i) => (
              <tr key={i} className="border-b border-neutral-100 last:border-0">
                <td className="px-3 py-1.5">{x.window}</td><td className="px-3 py-1.5">{HZ[x.horizon]}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">₹{fmt(x.model_mae)}</td>
                <td className="px-3 py-1.5 text-right tabular-nums text-neutral-500">₹{fmt(x.naive_mae)}</td>
                <td className={`px-3 py-1.5 text-right font-semibold tabular-nums ${beatsCls(x.beats_naive)}`}>{better(x.model_mae, x.naive_mae)}%</td>
                <td className="px-3 py-1.5 text-right tabular-nums">{x.dir_acc_pct == null ? '--' : `${x.dir_acc_pct}%`}</td>
                <td className="px-3 py-1.5 text-right tabular-nums text-neutral-400">{fmt(x.n, 0)}</td>
              </tr>
            ))}
            {!loading && !(rolling || []).length && <tr><td colSpan="7" className="px-3 py-4 text-neutral-400">No outcomes scored yet — run <code>score_outcomes.py</code>.</td></tr>}
          </tbody>
        </table>
      </div>

      {/* by crop x horizon (all-time) */}
      <div className="rounded-[4px] border border-neutral-200 bg-white">
        <div className="border-b border-neutral-200 px-4 py-2 text-[13px] font-bold">By crop &amp; horizon</div>
        <table className="w-full text-[12.5px]">
          <thead><tr className="border-b border-neutral-200 text-left text-[10.5px] uppercase tracking-wider text-neutral-500">
            <th className="px-3 py-1.5">Crop</th><th className="px-3 py-1.5">Horizon</th>
            <th className="px-3 py-1.5 text-right">Model MAE</th><th className="px-3 py-1.5 text-right">Naive MAE</th>
            <th className="px-3 py-1.5 text-right">MAPE</th><th className="px-3 py-1.5 text-right">Dir. acc</th>
            <th className="px-3 py-1.5 text-right">vs naive</th>
          </tr></thead>
          <tbody>
            {(byCrop || []).map((x, i) => (
              <tr key={i} className="border-b border-neutral-100 last:border-0">
                <td className="px-3 py-1.5">{x.crop}</td><td className="px-3 py-1.5">{HZ[x.horizon]}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">₹{fmt(x.model_mae)}</td>
                <td className="px-3 py-1.5 text-right tabular-nums text-neutral-500">₹{fmt(x.naive_mae)}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">{x.model_mape == null ? '--' : `${x.model_mape}%`}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">{x.dir_acc_pct == null ? '--' : `${x.dir_acc_pct}%`}</td>
                <td className={`px-3 py-1.5 text-right font-semibold tabular-nums ${beatsCls(x.beats_naive)}`}>{better(x.model_mae, x.naive_mae)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* by state + markets (12w), filterable */}
      <div className="rounded-[4px] border border-neutral-200 bg-white">
        <div className="flex flex-wrap items-center gap-2 border-b border-neutral-200 px-4 py-2 text-[12px]">
          <span className="text-[13px] font-bold">By state &amp; market (last 12 weeks)</span>
          <div className="ml-auto flex items-center gap-2">
            <select value={crop} onChange={(e) => setCrop(e.target.value)} className="rounded-[4px] border border-neutral-200 px-2 py-1">
              <option value="">All crops</option><option>Soybean</option><option>Maize</option></select>
            <select value={hz} onChange={(e) => setHz(e.target.value)} className="rounded-[4px] border border-neutral-200 px-2 py-1">
              <option value="next_week">Next week</option><option value="next_4w">Next 4 weeks</option></select>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-0 md:grid-cols-2">
          <div className="border-r border-neutral-200">
            <div className="px-4 py-1.5 text-[11px] font-bold uppercase tracking-wider text-neutral-400">States</div>
            <div className="max-h-[320px] overflow-y-auto">
              <table className="w-full text-[12.5px]"><tbody>
                {stateRows.map((x, i) => (
                  <tr key={i} className="border-b border-neutral-100">
                    <td className="px-3 py-1.5">{x.state}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">₹{fmt(x.model_mae)}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-neutral-500">vs ₹{fmt(x.naive_mae)}</td>
                    <td className={`px-3 py-1.5 text-right font-semibold tabular-nums ${beatsCls(x.beats_naive)}`}>{better(x.model_mae, x.naive_mae)}%</td>
                  </tr>
                ))}
                {!stateRows.length && <tr><td className="px-3 py-3 text-neutral-400">no data</td></tr>}
              </tbody></table>
            </div>
          </div>
          <div>
            <div className="px-4 py-1.5 text-[11px] font-bold uppercase tracking-wider text-neutral-400">Top markets (by volume)</div>
            <div className="max-h-[320px] overflow-y-auto">
              <table className="w-full text-[12.5px]"><tbody>
                {marketRows.slice(0, 60).map((x, i) => (
                  <tr key={i} className="border-b border-neutral-100">
                    <td className="px-3 py-1.5">{x.market} <span className="text-neutral-400">· {x.state}</span></td>
                    <td className="px-3 py-1.5 text-right tabular-nums">₹{fmt(x.model_mae)}</td>
                    <td className={`px-3 py-1.5 text-right font-semibold tabular-nums ${beatsCls(x.beats_naive)}`}>{better(x.model_mae, x.naive_mae)}%</td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-neutral-400">{x.dir_acc_pct == null ? '--' : `${x.dir_acc_pct}%`}</td>
                  </tr>
                ))}
                {!marketRows.length && <tr><td className="px-3 py-3 text-neutral-400">no data</td></tr>}
              </tbody></table>
            </div>
          </div>
        </div>
        <div className="border-t border-neutral-200 px-4 py-1.5 text-[11px] text-neutral-400">
          "vs naive" = % lower MAE than the naive last-price baseline (green = model better). ₹ = INR/quintal.
        </div>
      </div>
    </div>
  );
}
