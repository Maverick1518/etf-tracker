const SNAPSHOTS_KEY = "etf_snapshots";
const MAX_SNAPSHOTS = 365;

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function saveSnapshot(portfolio, prices) {
  const totalCurrent = portfolio.reduce((s, e) => {
    const p = prices[e.isin];
    return s + (p ? p.price * e.shares : e.invested);
  }, 0);

  const date = todayISO();
  const snapshots = getSnapshots().filter((s) => s.date !== date);
  snapshots.push({ date, value: totalCurrent });
  snapshots.sort((a, b) => a.date.localeCompare(b.date));

  const trimmed = snapshots.slice(-MAX_SNAPSHOTS);
  localStorage.setItem(SNAPSHOTS_KEY, JSON.stringify(trimmed));
  return trimmed;
}

export function getSnapshots() {
  const saved = localStorage.getItem(SNAPSHOTS_KEY);
  return saved ? JSON.parse(saved) : [];
}
