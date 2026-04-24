import { supabase } from "./supabase";

export function parseCSV(text) {
  const lines = text.trim().split("\n");
  const headers = lines[0].split(",").map((h) => h.trim().replace(/"/g, ""));

  return lines
    .slice(1)
    .map((line) => {
      const values = line.split(",").map((v) => v.trim().replace(/"/g, ""));
      return Object.fromEntries(headers.map((h, i) => [h, values[i]]));
    })
    .filter((row) => row.type === "BUY" && row.category === "TRADING");
}

export function calcPMC(trades) {
  const byISIN = {};

  trades.forEach((t) => {
    const isin = t.symbol;
    if (!byISIN[isin])
      byISIN[isin] = { totalAmount: 0, totalShares: 0, name: t.name };
    byISIN[isin].totalAmount += Math.abs(parseFloat(t.amount));
    byISIN[isin].totalShares += parseFloat(t.shares);
  });

  return Object.entries(byISIN).map(([isin, data]) => ({
    isin,
    name: data.name,
    shares: data.totalShares,
    invested: data.totalAmount,
    pmc: data.totalAmount / data.totalShares,
  }));
}

export async function syncToSupabase(trades) {
  await supabase.from("trades").delete().gte("id", 0);
  const rows = trades.map((t) => ({
    datetime: t.datetime,
    date: t.date,
    type: t.type,
    category: t.category,
    name: t.name,
    symbol: t.symbol,
    shares: parseFloat(t.shares),
    price: parseFloat(t.price),
    amount: parseFloat(t.amount),
    currency: t.currency,
  }));
  const { error } = await supabase.from("trades").insert(rows);
  if (error) console.error("Supabase sync error:", error);
}

export async function loadFromSupabase() {
  const { data, error } = await supabase
    .from("trades")
    .select("*")
    .order("date", { ascending: false });
  if (error) {
    console.error("Supabase load error:", error);
    return null;
  }
  return data;
}
