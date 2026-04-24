import { useState, useMemo } from 'react'

function OrderHistory() {
  const trades = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('etf_trades') || '[]')
    } catch {
      return []
    }
  }, [])

  const etfOptions = useMemo(() => {
    const names = [...new Map(trades.map(t => [t.symbol, t.name])).entries()]
    return names.sort((a, b) => a[1].localeCompare(b[1]))
  }, [trades])

  const [filterISIN, setFilterISIN] = useState('all')

  const filtered = useMemo(() => {
    const base = filterISIN === 'all' ? trades : trades.filter(t => t.symbol === filterISIN)
    return [...base].sort((a, b) => {
      const da = a.date ? new Date(a.date) : 0
      const db = b.date ? new Date(b.date) : 0
      return db - da
    })
  }, [trades, filterISIN])

  if (trades.length === 0) {
    return <p className="text-gray-500 text-sm">Nessun ordine. Importa un CSV nella tab Ordini.</p>
  }

  return (
    <div>
      <div className="mb-4">
        <label className="text-xs text-gray-400 block mb-1">Filtra per ETF</label>
        <select
          value={filterISIN}
          onChange={e => setFilterISIN(e.target.value)}
          className="bg-gray-800 text-white text-sm rounded px-3 py-1.5 border border-gray-700 focus:outline-none focus:border-indigo-500 w-full"
        >
          <option value="all">Tutti gli ETF</option>
          {etfOptions.map(([isin, name]) => (
            <option key={isin} value={isin}>{name}</option>
          ))}
        </select>
      </div>

      <div className="text-xs text-gray-500 mb-2">{filtered.length} ordini</div>

      <div className="overflow-x-auto rounded-lg">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-800 text-gray-400 text-left">
              <th className="px-3 py-2 font-medium">Data</th>
              <th className="px-3 py-2 font-medium">ETF</th>
              <th className="px-3 py-2 font-medium text-right">Quote</th>
              <th className="px-3 py-2 font-medium text-right">Prezzo</th>
              <th className="px-3 py-2 font-medium text-right">Importo</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {filtered.map((t, i) => {
              const shares = parseFloat(t.shares)
              const amount = Math.abs(parseFloat(t.amount))
              const price = shares > 0 ? amount / shares : null
              const date = t.date
                ? new Date(t.date).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: '2-digit' })
                : '—'

              return (
                <tr key={i} className="bg-gray-900 hover:bg-gray-800 transition-colors">
                  <td className="px-3 py-2 text-gray-400 whitespace-nowrap">{date}</td>
                  <td className="px-3 py-2">
                    <div className="text-white font-medium leading-tight">{t.name}</div>
                    <div className="text-gray-500 text-xs">{t.symbol}</div>
                  </td>
                  <td className="px-3 py-2 text-right text-white">{shares.toFixed(4)}</td>
                  <td className="px-3 py-2 text-right text-white">
                    {price !== null ? `€${price.toFixed(2)}` : '—'}
                  </td>
                  <td className="px-3 py-2 text-right font-medium text-white">€{amount.toFixed(2)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default OrderHistory
