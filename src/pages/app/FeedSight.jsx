import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../supabaseClient';

/* FeedSight — near-term mandi (soybean & maize) forecast terminal.
   Internal CEFPL portal page. Reads the weekly batch from Supabase
   (public.feedsight_latest view → public.feedsight_forecasts).
   Matches MarketDashboard's institutional light-terminal styling.
   Decision-support only — directional intelligence, NOT exact price prediction. */

const fmt = (n, d = 0) => (n == null ? '--' : Number(n).toLocaleString('en-IN', { maximumFractionDigits: d }));
const pct = (p) => (p == null ? '--' : `${p > 0 ? '+' : ''}${Number(p).toFixed(2)}%`);
const dirColor = (d) => (d === 'up' ? 'text-positive' : d === 'down' ? 'text-negative' : 'text-text-muted');
const dirArrow = (d) => (d === 'up' ? '▲' : d === 'down' ? '▼' : '—');
const isNaiveModel = (m) => String(m).includes('naive');
const labelClass = (l) =>
  /Strong Up|^Up/.test(l) ? 'bg-accent/10 text-accent-hover'
  : /Strong Down|^Down/.test(l) ? 'bg-negative/10 text-negative'
  : /Caution|Low/.test(l) ? 'bg-amber-500/10 text-amber-700'
  : 'bg-neutral-100 text-text-muted';
const actionLabel = { model_ok: 'model', use_state_model: 'state model', use_naive: 'naive' };

function decisionLabel(changePct, conf, naive) {
  if (naive || (conf != null && conf < 0.45)) return 'Low Confidence / Use Caution';
  if (changePct == null) return 'Flat';
  if (changePct >= 3) return 'Strong Up';
  if (changePct >= 0.75) return 'Up';
  if (changePct <= -3) return 'Strong Down';
  if (changePct <= -0.75) return 'Down';
  return 'Flat';
}

/* ── Market detail overlay ───────────────────────────────────────── */
function DetailRow({ label, children }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-line/60 py-1.5 last:border-0">
      <span className="micro-label text-[10px] text-text-muted">{label}</span>
      <span className="num text-right text-[12.5px]">{children}</span>
    </div>
  );
}

function MarketDetail({ m, onClose }) {
  if (!m) return null;
  const naive = isNaiveModel(m.model_used);
  const low = m.confidence < 0.45;
  const leg = (h) => m[h] || {};
  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-ink/40 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-[560px] overflow-hidden rounded-modal border border-line bg-white shadow-[var(--shadow-modal)]">
        <div className="flex items-start justify-between border-b border-line px-4 py-3">
          <div>
            <h3 className="text-[15px] font-bold leading-tight">{m.market}
              <span className="ml-2 text-[12px] font-normal text-text-muted">· {m.crop}</span></h3>
            <p className="text-[11.5px] text-text-muted">{m.district || '—'}, {m.state} · origin week {m.refresh_week}</p>
          </div>
          <button onClick={onClose} className="cursor-pointer rounded px-1.5 text-[16px] text-text-muted hover:text-text-main">✕</button>
        </div>

        {(naive || low) && (
          <div className="mx-4 mt-3 rounded-chip border border-amber-300 bg-amber-50 px-3 py-2 text-[12px] text-amber-800">
            {naive && <div>⚠ Naive fallback in use — no model forecast; treat as carry-forward of the current price (no directional signal).</div>}
            {low && <div>⚠ Low confidence ({m.confidence.toFixed(2)}) — thin/volatile market; use caution.</div>}
          </div>
        )}

        <div className="px-4 py-2">
          <DetailRow label="Current modal"><b>₹{fmt(m.current)}</b></DetailRow>
          <DetailRow label="Next-week forecast">
            <span className={dirColor(leg('nw').direction)}>₹{fmt(leg('nw').forecast)} · {dirArrow(leg('nw').direction)} {pct(leg('nw').change_pct)}</span>
          </DetailRow>
          <DetailRow label="Next-4-week forecast">
            <span className={dirColor(leg('fw').direction)}>₹{fmt(leg('fw').forecast)} · {dirArrow(leg('fw').direction)} {pct(leg('fw').change_pct)}</span>
          </DetailRow>
          <DetailRow label="Direction (nw / 4w)">
            <span className={dirColor(leg('nw').direction)}>{leg('nw').direction || '--'}</span>
            <span className="text-border"> / </span>
            <span className={dirColor(leg('fw').direction)}>{leg('fw').direction || '--'}</span>
          </DetailRow>
          <DetailRow label="Confidence score"><b>{m.confidence.toFixed(3)}</b></DetailRow>
          <DetailRow label="Model used"><span className="text-text-secondary">{m.model_used}</span></DetailRow>
          <DetailRow label="Recommended action"><span className="text-text-secondary">{m.recommended_action}</span></DetailRow>
          <DetailRow label="Fallback reason"><span className="text-text-secondary">{m.fallback_reason === 'none' ? '—' : m.fallback_reason}</span></DetailRow>
          <div className="mt-2 flex items-center gap-2">
            <span className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${labelClass(leg('nw').label || '')}`}>NW: {leg('nw').label || '--'}</span>
            <span className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${labelClass(leg('fw').label || '')}`}>4W: {leg('fw').label || '--'}</span>
          </div>
          <p className="mt-3 text-[11px] text-text-muted">FeedSight is decision-support only — directional intelligence, not a price guarantee. ₹ = INR/quintal.</p>
        </div>
      </div>
    </div>
  );
}

export default function FeedSight() {
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState(null);
  const [crop, setCrop] = useState('');
  const [state, setState] = useState('');
  const [district, setDistrict] = useState('');
  const [q, setQ] = useState('');
  const [dir, setDir] = useState('');
  const [hz, setHz] = useState('nw');
  const [minConf, setMinConf] = useState(0);
  const [action, setAction] = useState('');
  const [modelKind, setModelKind] = useState('');   // '', 'model', 'state', 'naive'
  const [sort, setSort] = useState({ key: 'confidence', dir: -1 });
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    let active = true;
    // Paginate: Supabase/PostgREST returns at most 1000 rows per request, so
    // fetch in pages until a short page is returned (the table has >2000 rows).
    (async () => {
      const PAGE = 1000;
      let all = [];
      for (let from = 0; ; from += PAGE) {
        const { data, error } = await supabase
          .from('feedsight_latest').select('*').range(from, from + PAGE - 1);
        if (!active) return;
        if (error) { setErr(error.message); return; }
        all = all.concat(data || []);
        if (!data || data.length < PAGE) break;
      }
      if (active) setRows(all);
    })();
    return () => { active = false; };
  }, []);

  // pivot to one record per crop-market with both horizons
  const markets = useMemo(() => {
    if (!rows) return null;
    const m = new Map();
    for (const r of rows) {
      const k = `${r.crop}|${r.state}|${r.district}|${r.market}`;
      const rec = m.get(k) || {
        crop: r.crop, state: r.state, district: r.district, market: r.market,
        current: Number(r.current_modal_price), confidence: Number(r.confidence_score),
        model_used: r.model_used, recommended_action: r.recommended_action,
        fallback_reason: r.fallback_reason, refresh_week: r.refresh_week,
      };
      const naive = isNaiveModel(r.model_used);
      const cp = r.forecast_change_pct == null ? null : Number(r.forecast_change_pct);
      rec[r.horizon === 'next_week' ? 'nw' : 'fw'] = {
        forecast: Number(r.forecast_price), change_pct: cp, direction: r.direction,
        label: r.decision_label || decisionLabel(cp, Number(r.confidence_score), naive),
      };
      m.set(k, rec);
    }
    return [...m.values()];
  }, [rows]);

  const meta = useMemo(() => {
    if (!markets) return null;
    const nModel = markets.filter((x) => !isNaiveModel(x.model_used)).length;
    const dirs = { up: 0, down: 0, flat: 0 };
    markets.forEach((x) => { const d = x.nw?.direction; if (d) dirs[d] = (dirs[d] || 0) + 1; });
    return { n: markets.length, nModel, nFallback: markets.length - nModel, dirs,
      avgConf: markets.reduce((s, x) => s + x.confidence, 0) / (markets.length || 1), week: markets[0]?.refresh_week };
  }, [markets]);

  const states = useMemo(() => (markets ? [...new Set(markets.map((m) => m.state))].sort() : []), [markets]);
  const districts = useMemo(() => (markets
    ? [...new Set(markets.filter((m) => !state || m.state === state).map((m) => m.district).filter(Boolean))].sort()
    : []), [markets, state]);

  const matchesModelKind = (m) => {
    if (!modelKind) return true;
    if (modelKind === 'naive') return isNaiveModel(m.model_used);
    if (modelKind === 'state') return m.model_used === 'hgb_blend(state_eligible)';
    if (modelKind === 'model') return m.model_used === 'hgb_blend';
    return true;
  };

  const filtered = useMemo(() => {
    if (!markets) return [];
    const f = markets.filter((m) =>
      (!crop || m.crop === crop) && (!state || m.state === state) && (!district || m.district === district) &&
      (!q || m.market.toLowerCase().includes(q.toLowerCase())) &&
      (!dir || (m[hz] && m[hz].direction === dir)) && (m.confidence >= minConf) &&
      (!action || m.recommended_action === action) && matchesModelKind(m));
    const get = { crop: (m) => m.crop, state: (m) => m.state, district: (m) => m.district, market: (m) => m.market,
      current: (m) => m.current, nwf: (m) => m.nw?.forecast, fwf: (m) => m.fw?.forecast,
      pct: (m) => m[hz]?.change_pct, confidence: (m) => m.confidence, action: (m) => m.recommended_action }[sort.key] || ((m) => m.confidence);
    return f.sort((a, b) => {
      let x = get(a), y = get(b); x = x ?? -1e9; y = y ?? -1e9;
      return typeof x === 'string' ? sort.dir * String(x).localeCompare(String(y)) : sort.dir * (x > y ? 1 : x < y ? -1 : 0);
    });
  }, [markets, crop, state, district, q, dir, hz, minConf, action, modelKind, sort]);

  const th = (label, key, right) => (
    <th onClick={() => setSort((s) => ({ key, dir: s.key === key ? -s.dir : -1 }))}
      className={`micro-label sticky top-0 cursor-pointer select-none bg-bg-alt px-3 py-1.5 text-[9.5px] text-text-muted hover:text-text-main ${right ? 'text-right' : 'text-left'}`}>
      {label}{sort.key === key ? (sort.dir === -1 ? ' ↓' : ' ↑') : ''}
    </th>
  );

  function exportCsv() {
    const cols = ['crop', 'state', 'district', 'market', 'current', 'next_week', 'next_4w', 'horizon_shown', 'direction', 'change_pct', 'confidence', 'decision', 'model_used', 'recommended_action'];
    const lines = [cols.join(',')];
    filtered.forEach((m) => { const leg = m[hz] || {};
      lines.push([m.crop, m.state, m.district, `"${m.market}"`, m.current, m.nw?.forecast ?? '', m.fw?.forecast ?? '', hz, leg.direction ?? '', leg.change_pct ?? '', m.confidence, `"${leg.label ?? ''}"`, m.model_used, m.recommended_action].join(',')); });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/csv' }));
    a.download = `feedsight_${hz}_${meta?.week || 'latest'}.csv`; a.click();
  }

  return (
    <div className="mx-auto max-w-[1240px] space-y-4">
      <div className="rounded-panel border border-amber-200 bg-amber-50 px-4 py-2 text-[12px] text-amber-800">
        Near-term mandi <b>directional intelligence</b> for procurement/selling support — not exact price prediction.
        Read direction + confidence together; treat naive-fallback / low-confidence rows with caution.
      </div>

      {/* KPI strip */}
      <div className="flex flex-wrap rounded-panel border border-line bg-white">
        {meta ? (
          <>
            {[['Refresh week', meta.week], ['Forecast markets', meta.n], ['Model forecasts', meta.nModel],
              ['Naive fallback', meta.nFallback], ['Avg confidence', meta.avgConf.toFixed(2)]].map(([l, v]) => (
              <div key={l} className="flex-1 border-r border-line px-4 py-2.5 last:border-r-0">
                <p className="micro-label text-[9.5px] text-text-muted">{l}</p>
                <p className="num text-[19px] font-semibold leading-tight">{v}</p>
              </div>
            ))}
            <div className="flex-1 px-4 py-2.5">
              <p className="micro-label text-[9.5px] text-text-muted">Next-wk dir (U/F/D)</p>
              <p className="num text-[19px] font-semibold leading-tight">
                <span className="text-positive">{meta.dirs.up}</span> /
                <span className="text-text-muted"> {meta.dirs.flat}</span> /
                <span className="text-negative"> {meta.dirs.down}</span>
              </p>
            </div>
          </>
        ) : <div className="h-[58px] w-full animate-pulse bg-neutral-100" />}
      </div>

      {/* Filters + table */}
      <div className="rounded-panel border border-line bg-white">
        <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-2 text-[12px]">
          <h2 className="text-[13px] font-bold">Mandi forecasts <span className="font-normal text-text-muted">v1.2 · {filtered.length} markets</span></h2>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <select value={crop} onChange={(e) => setCrop(e.target.value)} className="rounded-panel border border-line px-2 py-1">
              <option value="">All crops</option><option>Soybean</option><option>Maize</option></select>
            <select value={state} onChange={(e) => { setState(e.target.value); setDistrict(''); }} className="rounded-panel border border-line px-2 py-1">
              <option value="">All states</option>{states.map((s) => <option key={s}>{s}</option>)}</select>
            <select value={district} onChange={(e) => setDistrict(e.target.value)} className="rounded-panel border border-line px-2 py-1">
              <option value="">All districts</option>{districts.map((d) => <option key={d}>{d}</option>)}</select>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="market…" className="w-24 rounded-panel border border-line px-2 py-1 outline-none focus:border-accent" />
            <select value={hz} onChange={(e) => setHz(e.target.value)} className="rounded-panel border border-line px-2 py-1">
              <option value="nw">Next week</option><option value="fw">Next 4 weeks</option></select>
            <select value={dir} onChange={(e) => setDir(e.target.value)} className="rounded-panel border border-line px-2 py-1">
              <option value="">All dir</option><option>up</option><option>flat</option><option>down</option></select>
            <select value={action} onChange={(e) => setAction(e.target.value)} className="rounded-panel border border-line px-2 py-1">
              <option value="">All actions</option><option value="model_ok">model_ok</option><option value="use_state_model">use_state_model</option><option value="use_naive">use_naive</option></select>
            <select value={modelKind} onChange={(e) => setModelKind(e.target.value)} className="rounded-panel border border-line px-2 py-1">
              <option value="">All models</option><option value="model">model</option><option value="state">state model</option><option value="naive">naive</option></select>
            <label className="text-text-muted">conf≥</label>
            <input type="number" min="0" max="1" step="0.05" value={minConf} onChange={(e) => setMinConf(parseFloat(e.target.value) || 0)} className="w-16 rounded-panel border border-line px-2 py-1" />
            <button onClick={exportCsv} className="rounded-panel bg-accent px-2.5 py-1 font-semibold text-white hover:bg-accent-hover">Export CSV</button>
          </div>
        </div>

        {err && <div className="px-4 py-3 text-[12px] text-negative">Failed to load forecasts: {err}</div>}
        <div className="max-h-[560px] overflow-y-auto">
          <table className="w-full text-[12.5px]">
            <thead><tr className="border-b border-line">
              {th('Crop', 'crop')}{th('State', 'state')}{th('District', 'district')}{th('Market', 'market')}
              {th('Modal ₹', 'current', true)}{th('Next-wk ₹', 'nwf', true)}{th('Next-4wk ₹', 'fwf', true)}
              <th className="micro-label sticky top-0 bg-bg-alt px-3 py-1.5 text-left text-[9.5px] text-text-muted">Dir</th>
              {th('Chg %', 'pct', true)}{th('Conf', 'confidence', true)}
              <th className="micro-label sticky top-0 bg-bg-alt px-3 py-1.5 text-left text-[9.5px] text-text-muted">Decision</th>
              <th className="micro-label sticky top-0 bg-bg-alt px-3 py-1.5 text-left text-[9.5px] text-text-muted">Model</th>
              {th('Action', 'action')}
            </tr></thead>
            <tbody>
              {markets ? filtered.map((m, i) => { const leg = m[hz] || {}; const naive = isNaiveModel(m.model_used);
                return (
                  <tr key={i} onClick={() => setSelected(m)} className="cursor-pointer border-b border-line/60 last:border-0 hover:bg-bg-alt">
                    <td className="px-3 py-1.5">{m.crop}</td><td className="px-3 py-1.5">{m.state}</td>
                    <td className="px-3 py-1.5 text-text-muted">{m.district || '—'}</td><td className="px-3 py-1.5 font-medium">{m.market}</td>
                    <td className="px-3 py-1.5 num text-right">₹{fmt(m.current)}</td>
                    <td className="px-3 py-1.5 num text-right">₹{fmt(m.nw?.forecast)}</td>
                    <td className="px-3 py-1.5 num text-right">₹{fmt(m.fw?.forecast)}</td>
                    <td className={`px-3 py-1.5 ${dirColor(leg.direction)}`}>{leg.direction || '--'}</td>
                    <td className={`px-3 py-1.5 num text-right font-semibold ${dirColor(leg.direction)}`}>{pct(leg.change_pct)}</td>
                    <td className="px-3 py-1.5 num text-right">{m.confidence.toFixed(2)}</td>
                    <td className="px-3 py-1.5"><span className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${labelClass(leg.label || '')}`}>{leg.label || '--'}</span></td>
                    <td className="px-3 py-1.5 text-text-muted">{naive ? 'naive' : 'model'}</td>
                    <td className="px-3 py-1.5 text-text-muted">{actionLabel[m.recommended_action] || m.recommended_action}</td>
                  </tr>
                );
              }) : Array.from({ length: 10 }).map((_, i) => (
                <tr key={i}><td colSpan="13" className="px-3 py-2"><div className="h-3 animate-pulse rounded bg-neutral-100" /></td></tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="border-t border-line px-4 py-1.5 text-[11px] text-text-muted">
          Click any row for market detail. Decision = label for the selected horizon. ₹ = INR/quintal. FeedSight is decision-support only — directional intelligence, not a price guarantee.
        </div>
      </div>

      <MarketDetail m={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
