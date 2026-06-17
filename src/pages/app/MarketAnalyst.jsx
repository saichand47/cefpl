import React, { useRef, useState } from 'react';
import { supabase } from '../../supabaseClient';

const API_BASE = import.meta.env.VITE_EGGSIGHT_API_URL || 'http://localhost:8000';

const STARTERS = [
  'Why are egg prices rising?',
  'Forecast prices for the next 14 days',
  'Compare the current cycle with the same period last year',
  'Which zones moved the most today, and why might that be?',
  'Explain recent volatility in the Hyderabad rate',
];

export default function MarketAnalyst() {
  const [entries, setEntries] = useState([]); // {q, a, error, pending}
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const bottomRef = useRef(null);

  const ask = async (q) => {
    if (!q.trim() || busy) return;
    setBusy(true);
    setInput('');
    setEntries((e) => [...e, { q, pending: true }]);
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const r = await fetch(`${API_BASE}/analyst`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token || ''}` },
        body: JSON.stringify({ question: q }),
      });
      const d = await r.json();
      setEntries((e) => e.map((x, i) => (i === e.length - 1 ? { q, a: r.ok ? d.answer : null, error: r.ok ? null : (d.detail || 'Request failed') } : x)));
    } catch {
      setEntries((e) => e.map((x, i) => (i === e.length - 1 ? { q, error: 'Network error — is the API awake?' } : x)));
    } finally {
      setBusy(false);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    }
  };

  return (
    <div className="mx-auto flex max-w-[1100px] gap-4">
      {/* Analysis workflows */}
      <aside className="w-60 shrink-0">
        <div className="rounded-[4px] border border-neutral-200 bg-white">
          <p className="border-b border-neutral-200 px-3 py-2 text-[10.5px] font-bold uppercase tracking-wider text-neutral-400">
            Analysis workflows
          </p>
          <div className="p-1.5">
            {STARTERS.map((s) => (
              <button
                key={s} onClick={() => ask(s)} disabled={busy}
                className="block w-full cursor-pointer rounded-[4px] px-2 py-1.5 text-left text-[12.5px] text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 disabled:opacity-40"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
        <p className="mt-2 px-1 text-[11px] leading-relaxed text-neutral-400">
          Grounded in live NECC data, the model's forecasts, and 17 years of price history. Verify before trading decisions.
        </p>
      </aside>

      {/* Workspace */}
      <div className="flex min-h-[78vh] flex-1 flex-col rounded-[4px] border border-neutral-200 bg-white">
        <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-2">
          <h1 className="text-[13px] font-bold">AI Market Analyst</h1>
          <span className="text-[11px] text-neutral-400">Hyderabad NECC · live session data</span>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-4 py-3">
          {!entries.length && (
            <div className="flex h-full items-center justify-center text-[13px] text-neutral-400">
              Select an analysis workflow or pose a question below.
            </div>
          )}
          {entries.map((e, i) => (
            <div key={i} className="border-l-2 border-neutral-200 pl-3">
              <p className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">Query</p>
              <p className="text-[13.5px] font-semibold">{e.q}</p>
              <p className="mt-2 text-[11px] font-bold uppercase tracking-wider text-emerald-700">Analysis</p>
              {e.pending ? (
                <div className="mt-1 space-y-1.5">
                  <div className="h-3 w-4/5 animate-pulse rounded bg-neutral-100" />
                  <div className="h-3 w-3/5 animate-pulse rounded bg-neutral-100" />
                  <div className="h-3 w-2/3 animate-pulse rounded bg-neutral-100" />
                </div>
              ) : e.error ? (
                <p className="mt-1 text-[13px] font-medium text-red-600">{e.error}</p>
              ) : (
                <div className="mt-1 whitespace-pre-wrap text-[13.5px] leading-relaxed text-neutral-800">{e.a}</div>
              )}
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        <form
          onSubmit={(e) => { e.preventDefault(); ask(input); }}
          className="flex gap-2 border-t border-neutral-200 p-3"
        >
          <input
            value={input} onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about prices, forecasts, zones, cycles…"
            className="flex-1 rounded-[4px] border border-neutral-200 px-3 py-2 text-[13px] outline-none focus:border-neutral-400"
          />
          <button
            type="submit" disabled={busy || !input.trim()}
            className="cursor-pointer rounded-[4px] bg-emerald-700 px-4 py-2 text-[13px] font-semibold text-white hover:bg-emerald-800 disabled:opacity-40"
          >
            {busy ? 'Analyzing…' : 'Analyze'}
          </button>
        </form>
      </div>
    </div>
  );
}
