// Per-horizon reliability flags for the EggSight forecast display.
//
// Live scoring of the archived daily forecasts (Jun 7 – Jul 15 2026; see
// EggSight/forecasts/baseline_backtest_results.json and the 2026-07-16
// forecast-accuracy-audit) found the 14-day model materially worse than a
// no-change baseline (MAE ~2.6× naive) with a persistent one-sided bias, and
// the 7-day model also trailing the baseline in that window. Until retrained
// models beat the baseline in live scoring, the UI labels those horizons so
// a farmer never mistakes them for settled numbers.
//
// Review after each EggSight retrain; clear the flag once live scoring shows
// the horizon beating naive persistence.
export const HORIZON_CAUTION = {
  '1d': null,
  '7d': {
    level: 'caution',
    badge: 'Indicative',
    note: 'In recent live checks this outlook was less accurate than assuming no price change.',
  },
  '14d': {
    level: 'experimental',
    badge: 'Experimental',
    note: 'Under review: recently less accurate than assuming no price change, and it has run too low while prices were rising. Use for direction only.',
  },
};
