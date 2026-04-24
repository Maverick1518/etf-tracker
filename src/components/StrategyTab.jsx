import { useState, useEffect, useMemo } from 'react'

const STORAGE_KEY = 'etf_strategy'

function loadStrategy() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null') } catch { return null }
}

function saveStrategy(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

function shortName(name) {
  return name
    .replace(/ USD \(Acc\)/g, '')
    .replace(/ \(Acc\)/g, '')
    .replace(/ UCITS ETF.*/g, '')
    .replace(/ ETF$/g, '')
    .trim()
}

function initTargets(portfolio, saved) {
  const equal = portfolio.length > 0 ? parseFloat((100 / portfolio.length).toFixed(1)) : 0
  return Object.fromEntries(
    portfolio.map((etf, i) => {
      if (saved?.targets?.[etf.isin] !== undefined) return [etf.isin, saved.targets[etf.isin]]
      // last ETF absorbs rounding remainder
      const isLast = i === portfolio.length - 1
      if (isLast) {
        const sumSoFar = portfolio.slice(0, i).reduce((s, e) => {
          return s + (saved?.targets?.[e.isin] ?? equal)
        }, 0)
        return [etf.isin, parseFloat((100 - sumSoFar).toFixed(1))]
      }
      return [etf.isin, equal]
    })
  )
}

function StrategyTab({ portfolio, prices }) {
  const saved = useMemo(() => loadStrategy(), [])

  const [budget, setBudget] = useState(saved?.budget ?? 135)
  const [budgetInput, setBudgetInput] = useState(String(saved?.budget ?? 135))
  const [targets, setTargets] = useState(() => initTargets(portfolio, saved))

  // detect new ISINs not in saved targets
  const newIsins = portfolio
    .map(e => e.isin)
    .filter(isin => saved?.targets && !(isin in saved.targets))

  // sync targets when portfolio changes (new ETF added)
  useEffect(() => {
    setTargets(prev => {
      const next = { ...prev }
      let changed = false
      portfolio.forEach(etf => {
        if (!(etf.isin in next)) {
          next[etf.isin] = 0
          changed = true
        }
      })
      return changed ? next : prev
    })
  }, [portfolio])

  // persist on any change
  useEffect(() => {
    saveStrategy({ budget, targets })
  }, [budget, targets])

  const totalCurrent = useMemo(() =>
    portfolio.reduce((s, etf) => {
      const p = prices[etf.isin]
      return s + (p ? p.price * etf.shares : etf.invested)
    }, 0)
  , [portfolio, prices])

  const currentWeights = useMemo(() =>
    Object.fromEntries(portfolio.map(etf => {
      const p = prices[etf.isin]
      const val = p ? p.price * etf.shares : etf.invested
      return [etf.isin, totalCurrent > 0 ? val / totalCurrent * 100 : 0]
    }))
  , [portfolio, prices, totalCurrent])

  const targetSum = Object.values(targets).reduce((s, v) => s + (parseFloat(v) || 0), 0)
  const targetsValid = Math.abs(targetSum - 100) < 0.1

  function handleTargetChange(isin, val) {
    setTargets(prev => ({ ...prev, [isin]: val }))
  }

  // suggested purchases
  const suggestions = useMemo(() => {
    if (!targetsValid || portfolio.length === 0) return []

    const rows = portfolio.map(etf => {
      const gap = (parseFloat(targets[etf.isin]) || 0) - currentWeights[etf.isin]
      return { isin: etf.isin, name: shortName(etf.name), gap }
    })

    const totalGaps = rows.reduce((s, r) => s + (r.gap > 0 ? r.gap : 0), 0)

    const result = rows.map(r => ({
      isin: r.isin,
      name: r.name,
      amount: r.gap > 0 && totalGaps > 0
        ? Math.round(budget * r.gap / totalGaps)
        : 0,
    }))

    // adjust last under-target ETF to hit exact budget
    const underTarget = result.filter(r => r.amount > 0)
    if (underTarget.length > 0) {
      const sumRaw = result.reduce((s, r) => s + r.amount, 0)
      underTarget[underTarget.length - 1].amount += budget - sumRaw
    }

    return result
  }, [budget, targets, portfolio, targetsValid, currentWeights])

  const suggTotal = suggestions.reduce((s, r) => s + r.amount, 0)

  if (portfolio.length === 0) return (
    <p className="text-gray-500 text-sm">Nessun ETF. Importa un CSV nella tab Ordini.</p>
  )

  return (
    <div className="space-y-5">

      {/* New ETF warning */}
      {newIsins.length > 0 && (
        <div className="bg-yellow-900/40 border border-yellow-700 rounded-lg px-4 py-2 text-yellow-300 text-sm">
          Nuovo ETF rilevato: aggiorna i pesi target
        </div>
      )}

      {/* Budget */}
      <div className="bg-gray-900 rounded-lg p-4">
        <label className="text-xs text-gray-400 block mb-1">Budget mensile (€)</label>
        <input
          type="number"
          min="0"
          value={budgetInput}
          onChange={e => setBudgetInput(e.target.value)}
          onBlur={() => {
            const v = parseFloat(budgetInput)
            if (!isNaN(v) && v >= 0) setBudget(v)
            else setBudgetInput(String(budget))
          }}
          className="bg-gray-800 text-white text-lg font-semibold w-32 px-3 py-1.5 rounded border border-gray-700 focus:outline-none focus:border-indigo-500"
        />
      </div>

      {/* Target weights table */}
      <div className="bg-gray-900 rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-400">Pesi target</h2>
          <span className={`text-xs font-medium ${targetsValid ? 'text-green-400' : 'text-red-400'}`}>
            Totale: {targetSum.toFixed(1)}%
            {!targetsValid && ' ⚠ devono sommare 100%'}
          </span>
        </div>
        <div className="space-y-2">
          {portfolio.map(etf => {
            const diff = (parseFloat(targets[etf.isin]) || 0) - currentWeights[etf.isin]
            const underTarget = diff > 0.05
            const overTarget  = diff < -0.05
            return (
              <div key={etf.isin} className="flex items-center gap-3 text-sm">
                <span className="text-gray-300 flex-1 min-w-0 truncate">{shortName(etf.name)}</span>
                <div className="flex items-center gap-1 shrink-0">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={targets[etf.isin] ?? 0}
                    onChange={e => handleTargetChange(etf.isin, e.target.value)}
                    className="bg-gray-800 text-white w-16 px-2 py-1 rounded border border-gray-700 text-right focus:outline-none focus:border-indigo-500"
                  />
                  <span className="text-gray-500 w-3">%</span>
                </div>
                <span className="text-gray-500 w-14 text-right shrink-0">
                  {currentWeights[etf.isin].toFixed(1)}%
                </span>
                <span className={`w-14 text-right shrink-0 font-medium ${
                  underTarget ? 'text-green-400' : overTarget ? 'text-red-400' : 'text-gray-500'
                }`}>
                  {diff >= 0 ? '+' : ''}{diff.toFixed(1)}%
                </span>
              </div>
            )
          })}
        </div>
        <div className="mt-3 pt-3 border-t border-gray-800 flex gap-6 text-xs text-gray-500">
          <span>Target | Attuale | Diff</span>
        </div>
      </div>

      {/* Suggested purchases */}
      <div className="bg-gray-900 rounded-lg p-4">
        <h2 className="text-sm font-semibold text-gray-400 mb-3">Acquisti consigliati mese prossimo</h2>
        {!targetsValid ? (
          <p className="text-red-400 text-sm">Correggi i pesi target prima.</p>
        ) : (
          <>
            <div className="space-y-1">
              {suggestions.map(r => (
                <div key={r.isin} className="flex justify-between text-sm">
                  <span className="text-gray-300">{r.name}</span>
                  <span className="text-white font-medium">€{r.amount}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 pt-3 border-t border-gray-800 flex justify-between text-sm font-semibold">
              <span className="text-gray-400">Totale</span>
              <span className="text-indigo-400">€{suggTotal}</span>
            </div>
          </>
        )}
      </div>

    </div>
  )
}

export default StrategyTab
