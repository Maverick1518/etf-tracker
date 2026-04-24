import { useState, useEffect } from 'react'
import ImportCSV from './ImportCSV'
import { usePrices } from '../hooks/usePrices'
import AllocationChart from './AllocationChart'
import TabBar from './TabBar'
import OrderHistory from './OrderHistory'
import PortfolioChart from './PortfolioChart'
import { calcPMC, loadFromSupabase } from '../utils/parseCSV'

function PnlBadge({ value, percent }) {
  const positive = value >= 0
  return (
    <span className={`text-sm font-medium ${positive ? 'text-green-400' : 'text-red-400'}`}>
      {positive ? '+' : ''}€{value.toFixed(2)} ({positive ? '+' : ''}{percent.toFixed(2)}%)
    </span>
  )
}

function Dashboard() {
  const [portfolio, setPortfolio] = useState([])
  const [activeTab, setActiveTab] = useState('portfolio')
  const { prices, loading, lastUpdate, refresh } = usePrices(portfolio)

  useEffect(() => {
    const saved = localStorage.getItem('etf_portfolio')
    if (saved) {
      setPortfolio(JSON.parse(saved))
    } else {
      loadFromSupabase().then(trades => {
        if (trades && trades.length > 0) {
          const portfolio = calcPMC(trades)
          localStorage.setItem('etf_trades', JSON.stringify(trades))
          localStorage.setItem('etf_portfolio', JSON.stringify(portfolio))
          setPortfolio(portfolio)
        }
      })
    }
  }, [])

  const totalInvested = portfolio.reduce((s, e) => s + e.invested, 0)
  const totalCurrent = portfolio.reduce((s, e) => {
    const p = prices[e.isin]
    return s + (p ? p.price * e.shares : e.invested)
  }, 0)
  const totalPnl = totalCurrent - totalInvested
  const totalPnlPct = totalInvested ? (totalPnl / totalInvested) * 100 : 0

  return (
    <div className="min-h-screen bg-gray-950 text-white pb-16">
      <div className="max-w-2xl mx-auto p-4">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold">ETF Portfolio Tracker</h1>
          <button
            onClick={refresh}
            disabled={loading}
            className="text-sm px-3 py-1.5 rounded bg-gray-800 hover:bg-gray-700 disabled:opacity-50"
          >
            {loading ? 'Aggiornamento...' : '↻ Refresh'}
          </button>
        </div>

        {lastUpdate && (
          <p className="text-xs text-gray-500 mb-4">
            Aggiornato: {lastUpdate.toLocaleTimeString('it-IT')}
          </p>
        )}

        {/* Tab: Portfolio */}
        {activeTab === 'portfolio' && (
          <>
            {portfolio.length > 0 && (
              <div className="bg-gray-900 rounded-lg p-4 mb-4 flex gap-6">
                <div>
                  <div className="text-xs text-gray-400">Investito</div>
                  <div className="font-semibold">€{totalInvested.toFixed(2)}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-400">Valore attuale</div>
                  <div className="font-semibold">€{totalCurrent.toFixed(2)}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-400">P&L totale</div>
                  <PnlBadge value={totalPnl} percent={totalPnlPct} />
                </div>
              </div>
            )}

            {portfolio.length > 0 ? (
              <div className="space-y-3">
                {portfolio.map(etf => {
                  const p = prices[etf.isin]
                  const currentValue = p ? p.price * etf.shares : null
                  const pnl = currentValue ? currentValue - etf.invested : null
                  const pnlPct = pnl ? (pnl / etf.invested) * 100 : null
                  const dayChange = p ? ((p.price - p.prevClose) / p.prevClose) * 100 : null

                  return (
                    <div key={etf.isin} className="bg-gray-900 rounded-lg p-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-medium">{etf.name}</div>
                          <div className="text-xs text-gray-500 mt-0.5">{etf.isin}</div>
                        </div>
                        <div className="text-right">
                          {currentValue
                            ? <div className="font-semibold text-lg">€{currentValue.toFixed(2)}</div>
                            : <div className="font-semibold text-lg text-gray-500">—</div>
                          }
                          {p && (
                            <div className="flex items-center justify-end gap-1.5 mt-0.5">
                              <span className="text-xs text-gray-400">€{p.price.toFixed(2)}</span>
                              <span className={`text-xs ${dayChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                {dayChange >= 0 ? '+' : ''}{dayChange.toFixed(2)}%
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-4 text-sm text-gray-400">
                        <span>Quote: <span className="text-white">{etf.shares.toFixed(4)}</span></span>
                        <span>Investito: <span className="text-white">€{etf.invested.toFixed(2)}</span></span>
                        {pnl !== null && <PnlBadge value={pnl} percent={pnlPct} />}
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="text-gray-500 text-sm">Nessun ETF. Importa un CSV nella tab Ordini.</p>
            )}
          </>
        )}

        {/* Tab: Ordini */}
        {activeTab === 'ordini' && (
          <div className="space-y-6">
            <ImportCSV onImport={setPortfolio} />
            <OrderHistory />
          </div>
        )}

        {/* Tab: Grafici */}
        {activeTab === 'grafici' && (
          <div className="space-y-4">
            <PortfolioChart />
            {portfolio.length > 0 && <AllocationChart portfolio={portfolio} prices={prices} />}
          </div>
        )}
      </div>

      <TabBar active={activeTab} onChange={setActiveTab} />
    </div>
  )
}

export default Dashboard
