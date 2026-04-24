export function parseCSV(text) {
  const lines = text.trim().split('\n')
  const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''))

  return lines
    .slice(1)
    .map(line => {
      const values = line.split(',').map(v => v.trim().replace(/"/g, ''))
      return Object.fromEntries(headers.map((h, i) => [h, values[i]]))
    })
    .filter(row => row.type === 'BUY' && row.category === 'TRADING')
}

export function calcPMC(trades) {
  const byISIN = {}

  trades.forEach(t => {
    const isin = t.symbol
    if (!byISIN[isin]) byISIN[isin] = { totalAmount: 0, totalShares: 0, name: t.name }
    byISIN[isin].totalAmount += Math.abs(parseFloat(t.amount))
    byISIN[isin].totalShares += parseFloat(t.shares)
  })

  return Object.entries(byISIN).map(([isin, data]) => ({
    isin,
    name: data.name,
    shares: data.totalShares,
    invested: data.totalAmount,
    pmc: data.totalAmount / data.totalShares,
  }))
}