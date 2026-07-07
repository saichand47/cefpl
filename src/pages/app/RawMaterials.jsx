import React, { useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Plus, Trash2, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { supabase } from '../../supabaseClient';

const MATERIALS = [
  { id: 'soybean_meal', label: 'Soybean Meal', color: '#1b1915' },
  { id: 'maize', label: 'Maize', color: '#047857' },
];

const fmt = (n, d = 2) => (n == null ? '--' : Number(n).toLocaleString('en-IN', { maximumFractionDigits: d }));

/** Least-squares linear trend over recent entries → projected price in `daysAhead` days. */
function trendProjection(rows, daysAhead = 14) {
  const pts = rows.slice(-30).map((r) => [new Date(r.recorded_on).getTime() / 86400000, Number(r.price_per_kg)]);
  if (pts.length < 4) return null;
  const n = pts.length;
  const mx = pts.reduce((s, p) => s + p[0], 0) / n;
  const my = pts.reduce((s, p) => s + p[1], 0) / n;
  let num = 0, den = 0;
  for (const [x, y] of pts) { num += (x - mx) * (y - my); den += (x - mx) ** 2; }
  if (!den) return null;
  const slope = num / den;
  const lastX = pts[pts.length - 1][0];
  const lastY = pts[pts.length - 1][1];
  return { projected: my + slope * (lastX + daysAhead - mx), perDay: slope, last: lastY };
}

function MiniChart({ rows, color }) {
  if (rows.length < 2) {
    return <div className="flex h-24 items-center justify-center num text-[12px] text-text-muted">Add a few entries to see the trend</div>;
  }
  const pts = rows.map((r) => Number(r.price_per_kg));
  const min = Math.min(...pts), max = Math.max(...pts);
  const span = max - min || 1;
  const line = pts.map((p, i) => `${(i / (pts.length - 1)) * 100},${90 - ((p - min) / span) * 80}`).join(' ');
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-24 w-full">
      <polyline points={line} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export default function RawMaterials() {
  const { user, profile } = useOutletContext();
  const isAdmin = profile?.role === 'admin';
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState({ material: 'soybean_meal', price_per_kg: '', market: '', recorded_on: new Date().toISOString().slice(0, 10), notes: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = () =>
    supabase.from('raw_material_prices').select('*').order('recorded_on', { ascending: true }).limit(1000)
      .then(({ data }) => setRows(data || []));
  useEffect(() => { load(); }, []);

  const byMaterial = useMemo(() => {
    const m = {};
    for (const mat of MATERIALS) m[mat.id] = rows.filter((r) => r.material === mat.id);
    return m;
  }, [rows]);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    const price = parseFloat(form.price_per_kg);
    if (!price || price <= 0) { setError('Enter a valid price per kg.'); return; }
    setSaving(true);
    const { error: err } = await supabase.from('raw_material_prices').insert({
      material: form.material,
      price_per_kg: price,
      market: form.market.trim(),
      recorded_on: form.recorded_on,
      notes: form.notes.trim(),
      entered_by: user.id,
    });
    setSaving(false);
    if (err) { setError(err.message); return; }
    setForm((f) => ({ ...f, price_per_kg: '', notes: '' }));
    load();
  };

  const remove = async (id) => {
    if (!window.confirm('Delete this entry?')) return;
    await supabase.from('raw_material_prices').delete().eq('id', id);
    load();
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-xl font-bold">Raw Materials</h1>
        <p className="text-[13px] text-text-muted">
          Soybean meal & maize quotes (₹/kg) from traders and mandis. Projection is a 30-entry linear trend — a guide, not a model forecast.
        </p>
      </div>

      {/* Material cards */}
      <div className="grid gap-4 lg:grid-cols-2">
        {MATERIALS.map((mat) => {
          const data = byMaterial[mat.id];
          const latest = data[data.length - 1];
          const prev = data[data.length - 2];
          const change = latest && prev ? latest.price_per_kg - prev.price_per_kg : null;
          const proj = trendProjection(data);
          const TrendIcon = change > 0 ? TrendingUp : change < 0 ? TrendingDown : Minus;
          return (
            <div key={mat.id} className="rounded-panel border border-line bg-white p-3.5">
              <div className="flex items-baseline justify-between">
                <h2 className="text-[14px] font-bold">{mat.label}</h2>
                <span className="num text-[12px] text-text-muted">{data.length} entries</span>
              </div>
              <div className="mt-2 flex items-baseline gap-3">
                <p className="num text-2xl font-semibold">₹{fmt(latest?.price_per_kg)}<span className="text-[13px] font-medium text-text-muted">/kg</span></p>
                {change != null && (
                  <span className={`num flex items-center gap-1 text-[13px] font-semibold ${change > 0 ? 'text-negative' : change < 0 ? 'text-positive' : 'text-text-muted'}`}>
                    <TrendIcon size={14} /> {change > 0 ? '+' : ''}{fmt(change)} vs prev
                  </span>
                )}
              </div>
              {latest && <p className="num text-[12px] text-text-muted">latest: {latest.recorded_on}{latest.market ? ` · ${latest.market}` : ''}</p>}
              <MiniChart rows={data} color={mat.color} />
              {proj && (
                <p className="text-[12.5px] text-text-muted">
                  14-day trend projection: <b className="num font-semibold text-text-main">₹{fmt(proj.projected)}/kg</b>
                  {' '}({proj.perDay >= 0 ? '+' : ''}{fmt(proj.perDay, 3)}/day)
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* Entry form */}
      <form onSubmit={submit} className="rounded-panel border border-line bg-white p-3.5">
        <h2 className="text-[14px] font-bold">Add quote</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-5">
          <select
            value={form.material}
            onChange={(e) => setForm({ ...form, material: e.target.value })}
            className="rounded-panel border border-line px-2.5 py-2 text-[13.5px] outline-none focus:border-accent"
          >
            {MATERIALS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
          </select>
          <input
            type="number" step="0.01" min="0" placeholder="Price ₹/kg" required
            value={form.price_per_kg}
            onChange={(e) => setForm({ ...form, price_per_kg: e.target.value })}
            className="rounded-panel border border-line px-2.5 py-2 text-[13.5px] outline-none focus:border-accent"
          />
          <input
            type="date" required value={form.recorded_on}
            onChange={(e) => setForm({ ...form, recorded_on: e.target.value })}
            className="rounded-panel border border-line px-2.5 py-2 text-[13.5px] outline-none focus:border-accent"
          />
          <input
            placeholder="Market / trader (optional)" value={form.market}
            onChange={(e) => setForm({ ...form, market: e.target.value })}
            className="rounded-panel border border-line px-2.5 py-2 text-[13.5px] outline-none focus:border-accent"
          />
          <button
            type="submit" disabled={saving}
            className="flex cursor-pointer items-center justify-center gap-1.5 rounded-panel bg-accent px-3 py-2 text-[13.5px] font-semibold text-white hover:bg-accent-hover active:scale-[0.97] disabled:opacity-50"
          >
            <Plus size={15} /> {saving ? 'Saving…' : 'Add entry'}
          </button>
        </div>
        <input
          placeholder="Notes (optional)" value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
          className="mt-3 w-full rounded-panel border border-line px-2.5 py-2 text-[13.5px] outline-none focus:border-accent"
        />
        {error && <p className="mt-2 text-[13px] font-medium text-negative">{error}</p>}
      </form>

      {/* Entries table */}
      <div className="rounded-panel border border-line bg-white">
        <h2 className="border-b border-line px-4 py-3 text-[14px] font-bold">Recent entries</h2>
        <table className="w-full text-[13.5px]">
          <thead>
            <tr className="micro-label border-b border-line text-left text-[10px] text-text-muted">
              <th className="px-4 py-2 font-semibold">Date</th>
              <th className="px-4 py-2 font-semibold">Material</th>
              <th className="px-4 py-2 text-right font-semibold">₹/kg</th>
              <th className="px-4 py-2 font-semibold">Market</th>
              <th className="px-4 py-2 font-semibold">Notes</th>
              {isAdmin && <th className="px-4 py-2"></th>}
            </tr>
          </thead>
          <tbody>
            {[...rows].reverse().slice(0, 30).map((r) => (
              <tr key={r.id} className="border-b border-line/60 last:border-0 hover:bg-bg-alt">
                <td className="num px-4 py-2">{r.recorded_on}</td>
                <td className="px-4 py-2">{MATERIALS.find((m) => m.id === r.material)?.label}</td>
                <td className="num px-4 py-2 text-right font-semibold">₹{fmt(r.price_per_kg)}</td>
                <td className="px-4 py-2 text-text-muted">{r.market || '—'}</td>
                <td className="px-4 py-2 text-text-muted">{r.notes || '—'}</td>
                {isAdmin && (
                  <td className="px-4 py-2 text-right">
                    <button onClick={() => remove(r.id)} className="cursor-pointer text-text-muted hover:text-negative">
                      <Trash2 size={14} />
                    </button>
                  </td>
                )}
              </tr>
            ))}
            {!rows.length && (
              <tr><td colSpan={isAdmin ? 6 : 5} className="px-4 py-8 text-center text-text-muted">
                No entries yet — add the first quote above.
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
