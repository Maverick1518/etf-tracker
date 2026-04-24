import { useState, useEffect } from 'react'
import ImportCSV from './ImportCSV'

function Dashboard() {
  const [portfolio, setPortfolio] = useState([])

  useEffect(() => {
    const saved = localStorage.getItem('etf_portfolio')
    if (saved) setPortfolio(JSON.parse(saved))
  }, [])

  return (
    <div className="min-h-screen bg-gray-950 text-white p-4 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-2">ETF Portfolio Tracker</h1>
      <ImportCSV onImport={setPortfolio} />

      {portfolio.length > 0 && (
        <div className="mt-6 space-y-3">
          {portfolio.map(etf => (
            <div key={etf.isin} className="bg-gray-900 rounded-lg p-4">
              <div className="font-medium">{etf.name}</div>
              <div className="text-sm text-gray-400 mt-1">{etf.isin}</div>
              <div className="mt-2 flex gap-6 text-sm">
                <span>Quote: <span className="text-white">{etf.shares.toFixed(4)}</span></span>
                <span>Investito: <span className="text-white">€{etf.invested.toFixed(2)}</span></span>
                <span>PMC: <span className="text-white">€{etf.pmc.toFixed(2)}</span></span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default Dashboard