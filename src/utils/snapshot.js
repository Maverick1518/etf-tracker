const SNAPSHOTS_KEY = "etf_snapshots";
const MAX_SNAPSHOTS = 365;

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function saveSnapshot(portfolio, prices, invested) {
  const totalCurrent = portfolio.reduce((s, e) => {
    const p = prices[e.isin];
    return s + (p ? p.price * e.shares : e.invested);
  }, 0);

  const date = todayISO();
  const snapshots = getSnapshots().filter((s) => s.date !== date);
  snapshots.push({ date, value: totalCurrent, invested });
  snapshots.sort((a, b) => a.date.localeCompare(b.date));

  const trimmed = snapshots.slice(-MAX_SNAPSHOTS);
  localStorage.setItem(SNAPSHOTS_KEY, JSON.stringify(trimmed));
  return trimmed;
}

export function getSnapshots() {
  const saved = localStorage.getItem(SNAPSHOTS_KEY);
  return saved ? JSON.parse(saved) : [];
}

function monthKey(dateStr) {
  return dateStr.slice(0, 7); // YYYY-MM
}

function lastDayOfMonthISO(monthStr) {
  const [y, m] = monthStr.split("-").map(Number);
  return new Date(y, m, 0).toISOString().slice(0, 10);
}

export function buildSnapshotsFromTrades(trades) {
  const sorted = [...trades]
    .filter((t) => t.date)
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  const months = [...new Set(sorted.map((t) => monthKey(t.date)))];

  const cumulativeShares = {};
  const lastPrice = {};
  const snapshots = [];
  let idx = 0;
  let cumulativeInvested = 0;

  for (const month of months) {
    while (idx < sorted.length && monthKey(sorted[idx].date) === month) {
      const t = sorted[idx];
      const isin = t.symbol;
      const shares = parseFloat(t.shares);

      const amt = parseFloat(t.amount);
      const price = parseFloat(t.price);
      let tradePrice;
      if (!isNaN(amt) && amt !== 0) {
        tradePrice = Math.abs(amt) / shares;
      } else if (!isNaN(price) && price > 0) {
        tradePrice = price;
      } else {
        tradePrice = null;
      }

      cumulativeShares[isin] = (cumulativeShares[isin] || 0) + shares;
      if (tradePrice != null) lastPrice[isin] = tradePrice;

      let investedAmt = Math.abs(parseFloat(t.amount));
      if (isNaN(investedAmt)) {
        const sh = parseFloat(t.shares);
        const pr = parseFloat(t.price);
        investedAmt = !isNaN(sh) && !isNaN(pr) ? sh * pr : 0;
      }
      cumulativeInvested += investedAmt;

      idx++;
    }

    const totalValue = Object.keys(cumulativeShares).reduce((sum, isin) => {
      const shares = cumulativeShares[isin];
      const price = lastPrice[isin];
      return sum + (shares > 0 && price ? shares * price : 0);
    }, 0);

    snapshots.push({ date: lastDayOfMonthISO(month), value: totalValue, invested: cumulativeInvested });
  }

  return snapshots;
}
