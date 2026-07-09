import React, { useRef, useState } from 'react';
import { supabase } from '../../supabaseClient';

const API_BASE = import.meta.env.VITE_EGGSIGHT_API_URL || 'http://localhost:8000';

const STARTERS = [
  { title: 'Morning briefing', sub: 'What changed overnight?', q: 'Morning briefing — what changed overnight?' },
  { title: 'Explain the move', sub: 'Why did Hyderabad move today?', q: 'Explain today’s Hyderabad move' },
  { title: 'Cycle comparison', sub: 'This period vs last year', q: 'Compare this cycle with the same period last year' },
  { title: 'Zone movers', sub: 'Biggest moves and likely causes', q: 'Which zones moved most today, and why?' },
  { title: 'Volatility check', sub: 'How wide are the bands?', q: 'Volatility check — how wide are the bands?' },
];

const istTime = () =>
  new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false }) + ' IST';

export default function MarketAnalyst() {
  const [entries, setEntries] = useState([]); // {q, time, a, error, pending}
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const bottomRef = useRef(null);

  const ask = async (q) => {
    if (!q.trim() || busy) return;
    setBusy(true);
    setInput('');
    setEntries((e) => [...e, { q, time: istTime(), pending: true }]);
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const r = await fetch(`${API_BASE}/analyst`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token || ''}` },
        body: JSON.stringify({ question: q }),
      });
      const d = await r.json();
      setEntries((e) => e.map((x, i) => (i === e.length - 1 ? { ...x, pending: false, a: r.ok ? d.answer : null, error: r.ok ? null : (d.detail || 'Request failed') } : x)));
    } catch {
      setEntries((e) => e.map((x, i) => (i === e.length - 1 ? { ...x, pending: false, error: 'Network error — is the API awake?' } : x)));
    } finally {
      setBusy(false);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    }
  };

  return (
    <div className="mx-auto flex max-w-[1100px] gap-4">
      {/* Analysis workflows */}
      <aside className="w-[250px] shrink-0 self-start lg:sticky lg:top-12">
        <div className="rounded-panel border border-line bg-white">
          <p className="micro-label border-b border-line px-3 py-2 text-[9.5px] text-text-muted">
            Analysis workflows
          </p>
          <div className="p-1.5">
            {STARTERS.map((s) => (
              <button
                key={s.title} onClick={() => ask(s.q)} disabled={busy}
                className="block w-full cursor-pointer rounded-panel px-2.5 py-2 text-left hover:bg-neutral-100 disabled:opacity-40"
              >
                <span className="block text-[12.5px] font-semibold text-text-main">{s.title}</span>
                <span className="block text-[11px] text-text-muted">{s.sub}</span>
              </button>
            ))}
          </div>
        </div>
        <p className="mt-2 px-1 text-[11px] leading-relaxed text-text-muted">
          Grounded in live NECC data, the model's forecasts, and 17 years of price history. Verify before trading decisions.
        </p>
      </aside>

      {/* Workspace */}
      <div className="flex min-h-[78vh] flex-1 flex-col rounded-panel border border-line bg-white">
        <div className="flex items-center justify-between border-b border-line px-4 py-2">
          <h1 className="text-[13px] font-bold">AI Market Analyst</h1>
          <span className="num text-[10.5px] text-text-muted">HYDERABAD NECC · LIVE SESSION DATA</span>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-4 py-3">
          {!entries.length && (
            <div className="flex h-full flex-col items-center justify-center gap-1 text-center">
              <p className="text-[13.5px] font-semibold text-text-secondary">Start with an analysis workflow</p>
              <p className="text-[12.5px] text-text-muted">Or pose your own question about prices, forecasts, zones, or cycles.</p>
            </div>
          )}
          {entries.map((e, i) => (
            <div key={i} className="border-l-2 border-line pl-3">
              <p className="micro-label text-[10px] text-text-muted">Query · {e.time}</p>
              <p className="text-[13.5px] font-semibold">{e.q}</p>
              {e.pending ? (
                <p className="num mt-2 flex items-center gap-2 text-[10.5px] text-text-muted">
                  <span className="flex gap-1">
                    <span className="h-1 w-1 animate-pulse rounded-full bg-accent" />
                    <span className="h-1 w-1 animate-pulse rounded-full bg-accent [animation-delay:150ms]" />
                    <span className="h-1 w-1 animate-pulse rounded-full bg-accent [animation-delay:300ms]" />
                  </span>
                  ANALYZING LIVE NECC DATA…
                </p>
              ) : e.error ? (
                <p className="mt-2 text-[13px] font-medium text-negative">{e.error}</p>
              ) : (
                <>
                  <p className="micro-label mt-2.5 text-[10px] text-positive-strong">Analysis</p>
                  <div className="mt-1 whitespace-pre-wrap text-[13.5px] leading-relaxed text-text-secondary">{e.a}</div>
                  <p className="num mt-2 text-[9.5px] text-text-muted">SOURCES: NECC RATES · MODEL FORECAST 06:00 IST · FEED SPOT PRICES</p>
                </>
              )}
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        <div className="border-t border-line p-3">
          <form
            onSubmit={(e) => { e.preventDefault(); ask(input); }}
            className="flex gap-2"
          >
            <input
              value={input} onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about prices, forecasts, zones, cycles…"
              className="flex-1 rounded-panel border border-line px-3 py-2 text-[13px] outline-none focus:border-accent"
            />
            <button
              type="submit" disabled={busy || !input.trim()}
              className="cursor-pointer rounded-panel bg-accent px-4 py-2 text-[13px] font-semibold text-white hover:bg-accent-hover active:scale-[0.97] disabled:opacity-40"
            >
              {busy ? 'Analyzing…' : 'Analyze'}
            </button>
          </form>
          <p className="mt-2 text-[10.5px] text-text-muted">
            Answers are decision support, not trading guarantees. The analyst cites the data it used — verify before trading decisions.
          </p>
        </div>
      </div>
    </div>
  );
}
