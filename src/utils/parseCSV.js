function parseCSVLine(line) {
  const fields = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      fields.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current.trim());
  return fields;
}

export function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  const headers = parseCSVLine(lines[0]);

  return lines
    .slice(1)
    .map((line) => {
      const values = parseCSVLine(line);
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
    console.log('trade amount raw:', t.symbol, JSON.stringify(t.amount), typeof t.amount);
    let amt = parseFloat(t.amount);
    if (isNaN(amt)) {
      const shares = parseFloat(t.shares);
      const price = parseFloat(t.price);
      if (!isNaN(shares) && !isNaN(price)) amt = shares * price;
    }
    if (!isNaN(amt)) byISIN[isin].totalAmount += Math.abs(amt);
    byISIN[isin].totalShares += parseFloat(t.shares);
  });
  console.log('calcPMC byISIN:', JSON.stringify(byISIN));

  return Object.entries(byISIN).map(([isin, data]) => ({
    isin,
    name: data.name,
    shares: data.totalShares,
    invested: data.totalAmount,
    pmc: data.totalAmount / data.totalShares,
  }));
}
