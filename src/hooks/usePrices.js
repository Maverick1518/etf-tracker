const TICKERS = {
  IE00B4L5Y983: "EUNL.DE",
  IE00B5BMR087: "SXR8.DE",
  IE00BKM4GZ66: "IS3N.DE",
  IE00B4ND3602: "PPFB.DE",
  IE000I8KRLL9: "SEMI.DE",
};

const FALLBACK = {
  IE00B4L5Y983: "SWDA.MI",
  IE00B5BMR087: "CSPX.MI",
  IE00BKM4GZ66: "EIMI.MI",
  IE00B4ND3602: "SGLN.MI",
  IE000I8KRLL9: "SEMI.MI",
};

async function fetchPrice(ticker) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=1d`;
  const proxy = `https://corsproxy.io/?${encodeURIComponent(url)}`;
  const res = await fetch(proxy);
  const data = await res.json();
  const meta = data.chart.result[0].meta;
  return {
    price: meta.regularMarketPrice,
    prevClose: meta.chartPreviousClose,
  };
}

import { useState, useEffect, useCallback } from "react";

export function usePrices(portfolio) {
  const [prices, setPrices] = useState({});
  const [loading, setLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);

  const refresh = useCallback(async () => {
    if (!portfolio.length) return;
    setLoading(true);

    const results = {};
    for (const etf of portfolio) {
      try {
        results[etf.isin] = await fetchPrice(TICKERS[etf.isin]);
      } catch {
        try {
          results[etf.isin] = await fetchPrice(FALLBACK[etf.isin]);
        } catch {
          const saved = JSON.parse(localStorage.getItem("etf_prices") || "{}");
          results[etf.isin] = saved[etf.isin] || null;
        }
      }
    }

    setPrices(results);
    localStorage.setItem("etf_prices", JSON.stringify(results));
    setLastUpdate(new Date());
    setLoading(false);
  }, [portfolio]);

  useEffect(() => {
    const saved = localStorage.getItem("etf_prices");
    if (saved) setPrices(JSON.parse(saved));
    refresh();

    const interval = setInterval(refresh, 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, [refresh]);

  return { prices, loading, lastUpdate, refresh };
}
