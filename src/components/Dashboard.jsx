import { useState, useEffect, useRef } from 'react'
import ImportCSV from './ImportCSV'
import { usePrices } from '../hooks/usePrices'
import TabBar from './TabBar'
import OrderHistory from './OrderHistory'
import AnalysisTab from './AnalysisTab'
import StrategyTab from './StrategyTab'
import { calcPMC, loadFromSupabase } from '../utils/parseCSV'

function PnlBadge({ value, percent }) {
  const positive = value >= 0
  return (
    <span className={`text-sm font-medium ${positive ? 'text-green-400' : 'text-red-400'}`}>
      {positive ? '+' : ''}€{value.toFixed(2)} ({positive ? '+' : ''}{percent.toFixed(2)}%)
    </span>
  )
}

const TABS = ['portfolio', 'ordini', 'analisi', 'strategia']
const PULL_THRESHOLD = 80
const SWIPE_THRESHOLD = 50
const GESTURE_LOCK = 10

function Dashboard() {
  const [portfolio, setPortfolio] = useState([])
  const [activeTab, setActiveTab] = useState('portfolio')
  const { prices, loading, lastUpdate, refresh } = usePrices(portfolio)
  const [pullY, setPullY] = useState(0)
  const [refreshing, setRefreshing] = useState(false)

  const contentRef = useRef(null)
  const touchStartX = useRef(null)
  const touchStartY = useRef(null)
  const gesture = useRef(null) // null | 'swipe' | 'pull'
  const canPull = useRef(false)

  useEffect(() => {
    const saved = localStorage.getItem('etf_portfolio')
    if (saved) {
      setPortfolio(JSON.parse(saved))
    } else {
      loadFromSupabase().then(trades => {
        if (trades && trades.length > 0) {
          const p = calcPMC(trades)
          localStorage.setItem('etf_trades', JSON.stringify(trades))
          localStorage.setItem('etf_portfolio', JSON.stringify(p))
          setPortfolio(p)
        }
      })
    }
  }, [])

  useEffect(() => {
    if (!loading) setRefreshing(false)
  }, [loading])

  const totalInvested = portfolio.reduce((s, e) => s + e.invested, 0)
  const totalCurrent = portfolio.reduce((s, e) => {
    const p = prices[e.isin]
    return s + (p ? p.price * e.shares : e.invested)
  }, 0)
  const totalPnl = totalCurrent - totalInvested
  const totalPnlPct = totalInvested ? (totalPnl / totalInvested) * 100 : 0

  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX
    touchStartY.current = e.touches[0].clientY
    gesture.current = null
    canPull.current = window.scrollY === 0
  }

  const handleTouchMove = (e) => {
    if (touchStartX.current === null) return
    const dx = e.touches[0].clientX - touchStartX.current
    const dy = e.touches[0].clientY - touchStartY.current

    // Lock gesture direction once threshold reached
    if (!gesture.current) {
      if (Math.abs(dx) > GESTURE_LOCK || Math.abs(dy) > GESTURE_LOCK) {
        gesture.current = Math.abs(dx) > Math.abs(dy) ? 'swipe' : 'pull'
      }
      return
    }

    if (gesture.current === 'swipe') {
      const el = contentRef.current
      if (!el) return
      const tabIdx = TABS.indexOf(activeTab)
      // Rubber band at first/last tab
      let offset = dx
      if ((tabIdx === 0 && dx > 0) || (tabIdx === TABS.length - 1 && dx < 0)) {
        offset = dx * 0.2
      }
      el.style.transition = 'none'
      el.style.transform = `translateX(${offset}px)`
    } else if (gesture.current === 'pull') {
      if (activeTab !== 'portfolio' || !canPull.current) return
      if (dy > 0) setPullY(Math.min(dy, PULL_THRESHOLD * 1.5))
    }
  }

  const handleTouchEnd = (e) => {
    if (gesture.current === 'swipe') {
      const dx = e.changedTouches[0].clientX - touchStartX.current
      const el = contentRef.current
      const tabIdx = TABS.indexOf(activeTab)

      if (Math.abs(dx) >= SWIPE_THRESHOLD) {
        const dir = dx < 0 ? 1 : -1 // 1 = next tab, -1 = prev tab
        const nextIdx = tabIdx + dir

        if (nextIdx >= 0 && nextIdx < TABS.length) {
          // Phase 1: slide current content out
          if (el) {
            el.style.transition = 'transform 0.25s ease'
            el.style.transform = `translateX(${dir > 0 ? '-100%' : '100%'})`
          }
          setTimeout(() => {
            // Phase 2: switch tab, place new content off-screen, slide in
            setActiveTab(TABS[nextIdx])
            if (el) {
              el.style.transition = 'none'
              el.style.transform = `translateX(${dir > 0 ? '100%' : '-100%'})`
              requestAnimationFrame(() => requestAnimationFrame(() => {
                el.style.transition = 'transform 0.25s ease'
                el.style.transform = 'translateX(0)'
              }))
            }
          }, 250)
        } else {
          // Edge: snap back with rubber band feel
          if (el) {
            el.style.transition = 'transform 0.3s ease'
            el.style.transform = 'translateX(0)'
          }
        }
      } else {
        // Below threshold: snap back
        if (el) {
          el.style.transition = 'transform 0.25s ease'
          el.style.transform = 'translateX(0)'
        }
      }
    } else if (gesture.current === 'pull') {
      if (pullY >= PULL_THRESHOLD && !loading) {
        setRefreshing(true)
        refresh()
      }
      setPullY(0)
    }

    touchStartX.current = null
    touchStartY.current = null
    gesture.current = null
    canPull.current = false
  }

  const pullProgress = Math.min(pullY / PULL_THRESHOLD, 1)
  const indicatorHeight = refreshing ? 48 : Math.min(pullY * 0.5, 48)
  const showIndicator = pullY > 0 || refreshing

  return (
    <div
      className="min-h-screen bg-gray-950 text-white pb-16"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div className="fixed top-0 left-0 right-0 bg-gray-950 z-50" style={{ height: 'env(safe-area-inset-top)' }} />
      {/* Pull-to-refresh indicator */}
      <div
        className="flex items-center justify-center overflow-hidden"
        style={{
          height: showIndicator ? indicatorHeight : 0,
          transition: !pullY ? 'height 0.25s ease' : 'none',
        }}
      >
        <svg
          className={`w-6 h-6 text-gray-400 ${refreshing ? 'animate-spin' : ''}`}
          style={!refreshing ? { transform: `rotate(${pullProgress * 360}deg)` } : {}}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
          />
        </svg>
      </div>

      {/* Swipe viewport — overflow-x-hidden clips sliding content */}
      <div className="overflow-x-hidden">
        <div ref={contentRef} className="max-w-2xl mx-auto px-4 pt-0 pb-4">
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
                <div className="bg-gray-900 border border-indigo-500/40 rounded-xl px-6 pt-5 pb-6 mb-4 text-center">
                  <div className="flex justify-center gap-10 mb-4">
                    <div>
                      <div className="text-xs text-gray-400 uppercase tracking-wider mb-1">Investito</div>
                      <div className="text-base font-semibold text-white">€{totalInvested.toFixed(2)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-400 uppercase tracking-wider mb-1">Valore</div>
                      <div className="text-base font-semibold text-white">€{totalCurrent.toFixed(2)}</div>
                    </div>
                  </div>
                  <div className="text-5xl font-bold tracking-tight text-white">
                    {totalPnl >= 0 ? '+' : ''}€{totalPnl.toFixed(2)}
                  </div>
                  <div className="mt-2 flex justify-center">
                    <span className={`text-sm font-semibold px-3 py-1 rounded-full ${totalPnl >= 0 ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                      {totalPnl >= 0 ? '+' : ''}{totalPnlPct.toFixed(2)}%
                    </span>
                  </div>
                </div>
              )}
              {portfolio.length > 0 && <div className="h-px bg-gray-800 mb-4" />}
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

          {/* Tab: Analisi */}
          {activeTab === 'analisi' && (
            <AnalysisTab portfolio={portfolio} prices={prices} />
          )}

          {/* Tab: Strategia */}
          {activeTab === 'strategia' && (
            <StrategyTab portfolio={portfolio} prices={prices} />
          )}
        </div>
      </div>

      <TabBar active={activeTab} onChange={setActiveTab} />
    </div>
  )
}

export default Dashboard
