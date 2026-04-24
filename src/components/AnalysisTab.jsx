import { useState, useEffect, useMemo, useRef } from 'react'
import AllocationChart from './AllocationChart'

// ── Constants ─────────────────────────────────────────────────────────────────
const TICKERS = {
  IE00B4L5Y983: 'EUNL.DE',
  IE00B5BMR087: 'SXR8.DE',
  IE00BKM4GZ66: 'IS3N.DE',
  IE00B4ND3602: 'PPFB.DE',
  IE000I8KRLL9: 'IE000I8KRLL9.SG',
}
const SHORT_NAMES = {
  IE00B4L5Y983: 'World',
  IE00B5BMR087: 'S&P 500',
  IE00BKM4GZ66: 'EM IMI',
  IE00B4ND3602: 'Gold',
  IE000I8KRLL9: 'Semi',
}
const TF = [
  { label: '1S',  range: '5d',  interval: '1d'  },
  { label: '1M',  range: '1mo', interval: '1d'  },
  { label: '1A',  range: '1y',  interval: '1d'  },
  { label: 'Max', range: 'max', interval: '1wk' },
]
const CACHE_TTL = 60 * 60 * 1000

// ── SVG layout ────────────────────────────────────────────────────────────────
const W = 400, H = 200
const PAD = { top: 24, right: 16, bottom: 36, left: 52 }
const CW = W - PAD.left - PAD.right
const CH = H - PAD.top - PAD.bottom

// ── Data fetch ────────────────────────────────────────────────────────────────
async function fetchChart(ticker, range, interval) {
  console.log('[AnalysisTab] fetchChart', { ticker, range, interval })
  const key = `etf_chart_${ticker}_${range}`
  try {
    const cached = JSON.parse(localStorage.getItem(key))
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
      console.log('[AnalysisTab] cache hit', key)
      return cached.data
    }
  } catch { /* ignore stale */ }

  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=${interval}&range=${range}`
  const proxies = [
    `https://corsproxy.io/?${encodeURIComponent(url)}`,
    `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`,
  ]

  for (const proxy of proxies) {
    try {
      console.log('[AnalysisTab] trying proxy', proxy.split('?')[0])
      const res = await fetch(proxy)
      if (!res.ok) { console.warn('[AnalysisTab] proxy HTTP', res.status); continue }
      const raw = await res.json()
      // allorigins wraps response in raw.contents
      const json = raw.contents ? JSON.parse(raw.contents) : raw
      console.log('[AnalysisTab] response keys', Object.keys(json))
      const result = json?.chart?.result?.[0]
      if (!result?.timestamp) {
        console.warn('[AnalysisTab] no timestamp in result', JSON.stringify(json).slice(0, 300))
        continue
      }
      const closes = result.indicators?.quote?.[0]?.close ?? []
      const data = result.timestamp
        .map((ts, i) => ({ date: ts * 1000, price: closes[i] ?? null }))
        .filter(p => p.price != null)
      console.log('[AnalysisTab] data points', data.length)
      localStorage.setItem(key, JSON.stringify({ data, ts: Date.now() }))
      return data
    } catch (e) {
      console.warn('[AnalysisTab] proxy error', e.message)
    }
  }
  throw new Error('Nessun proxy disponibile')
}

// ── Price formatting ──────────────────────────────────────────────────────────
function fmtPrice(p) {
  if (p >= 1000) return `€${(p / 1000).toFixed(2)}k`
  if (p >= 100)  return `€${p.toFixed(2)}`
  return `€${p.toFixed(2)}`
}
function fmtAxis(p) {
  if (p >= 1000) return `${(p / 1000).toFixed(1)}k`
  if (p >= 100)  return p.toFixed(0)
  return p.toFixed(1)
}
function fmtDate(ts) {
  return new Date(ts).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' })
}
function fmtDateFull(ts) {
  return new Date(ts).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: '2-digit' })
}

// ── Chart component ───────────────────────────────────────────────────────────
function Chart({ data, loading, error }) {
  const svgRef = useRef(null)
  const [tip, setTip] = useState(null)

  const computed = useMemo(() => {
    if (!data || data.length < 2) return null

    const n = data.length
    const prices = data.map(d => d.price)
    const minP = Math.min(...prices)
    const maxP = Math.max(...prices)
    const yPad = (maxP - minP) * 0.1 || maxP * 0.05 || 1
    const yLo = minP - yPad
    const yHi = maxP + yPad

    const xS = i => PAD.left + (i / (n - 1)) * CW
    const yS = p => PAD.top + CH - ((p - yLo) / (yHi - yLo)) * CH

    const pts = data.map((d, i) => ({ x: xS(i), y: yS(d.price), date: d.date, price: d.price }))
    const positive = data[n - 1].price >= data[0].price
    const color = positive ? '#818cf8' : '#ef4444'

    const polyStr = pts.map(p => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ')
    const areaStr = [
      `M${xS(0).toFixed(2)},${(PAD.top + CH).toFixed(2)}`,
      ...pts.map(p => `L${p.x.toFixed(2)},${p.y.toFixed(2)}`),
      `L${xS(n - 1).toFixed(2)},${(PAD.top + CH).toFixed(2)}`,
      'Z',
    ].join(' ')

    const xCount = Math.min(5, n)
    const xLabels = Array.from({ length: xCount }, (_, k) => {
      const idx = Math.round(k / Math.max(xCount - 1, 1) * (n - 1))
      return { x: xS(idx), date: data[idx].date }
    })

    const yLabels = [0, 1, 2, 3].map(k => {
      const p = yLo + (k / 3) * (yHi - yLo)
      return { y: yS(p), price: p }
    })

    return { pts, positive, color, polyStr, areaStr, xLabels, yLabels }
  }, [data])

  function handleMove(clientX) {
    if (!svgRef.current || !computed) return
    const rect = svgRef.current.getBoundingClientRect()
    const svgX = (clientX - rect.left) / rect.width * W
    const i = Math.max(0, Math.min(
      computed.pts.length - 1,
      Math.round((svgX - PAD.left) / CW * (computed.pts.length - 1))
    ))
    setTip(computed.pts[i])
  }

  // ── States ──
  if (loading) return (
    <div className="h-52 flex items-center justify-center text-gray-500 text-sm">
      Caricamento...
    </div>
  )
  if (error) return (
    <div className="h-52 flex items-center justify-center text-red-400 text-sm text-center px-4">
      {error}
    </div>
  )
  if (!computed) return (
    <div className="h-52 flex items-center justify-center text-gray-500 text-sm">
      Nessun dato disponibile
    </div>
  )

  const { pts, color, polyStr, areaStr, xLabels, yLabels } = computed
  const active = tip ?? pts[pts.length - 1]

  return (
    <div>
      {/* Tooltip header */}
      <div className="flex items-baseline justify-between mb-2 px-1 min-h-6">
        <span className="text-base font-semibold" style={{ color }}>{fmtPrice(active.price)}</span>
        <span className="text-xs text-gray-400">{fmtDateFull(active.date)}</span>
      </div>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        style={{ display: 'block', touchAction: 'none' }}
        onMouseMove={e => handleMove(e.clientX)}
        onTouchMove={e => handleMove(e.touches[0].clientX)}
        onMouseLeave={() => setTip(null)}
      >
        {/* Y grid + labels */}
        {yLabels.map((l, i) => (
          <g key={i}>
            <line
              x1={PAD.left} y1={l.y.toFixed(2)}
              x2={W - PAD.right} y2={l.y.toFixed(2)}
              stroke="#1f2937" strokeWidth={1}
            />
            <text x={PAD.left - 5} y={l.y + 4} textAnchor="end" fontSize="10" fill="#6b7280">
              {fmtAxis(l.price)}
            </text>
          </g>
        ))}

        {/* X labels */}
        {xLabels.map((l, i) => (
          <text
            key={i}
            x={l.x} y={H - PAD.bottom + 14}
            textAnchor="middle" fontSize="10" fill="#6b7280"
          >
            {fmtDate(l.date)}
          </text>
        ))}

        {/* Area fill */}
        <path d={areaStr} fill={color} opacity={0.12} />

        {/* Line */}
        <polyline
          points={polyStr}
          fill="none" stroke={color} strokeWidth={2}
          strokeLinejoin="round" strokeLinecap="round"
        />

        {/* Hover indicator */}
        {tip && (
          <g>
            <line
              x1={tip.x} y1={PAD.top}
              x2={tip.x} y2={PAD.top + CH}
              stroke={color} strokeWidth={1} strokeDasharray="3,3" opacity={0.5}
            />
            <circle cx={tip.x} cy={tip.y} r={4} fill={color} />
            <circle cx={tip.x} cy={tip.y} r={2} fill="white" />
          </g>
        )}
      </svg>
    </div>
  )
}

// ── Main tab ──────────────────────────────────────────────────────────────────
function AnalysisTab({ portfolio, prices }) {
  const available = useMemo(
    () => portfolio.filter(etf => TICKERS[etf.isin]),
    [portfolio]
  )

  const [selectedIsin, setSelectedIsin] = useState(null)
  // derive effective isin: explicit selection → first available → null
  const isin = (selectedIsin && TICKERS[selectedIsin]) ? selectedIsin : (available[0]?.isin ?? null)

  const [tfIdx, setTfIdx] = useState(1)
  const [chartData, setChartData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    const ticker = TICKERS[isin]
    console.log('[AnalysisTab] effect', { isin, ticker, tfIdx, portfolioLen: portfolio.length })
    if (!isin || !ticker) return
    const { range, interval } = TF[tfIdx]
    setLoading(true)
    setError(null)
    setChartData(null)
    fetchChart(ticker, range, interval)
      .then(data => { setChartData(data); setLoading(false) })
      .catch(e => { console.error('[AnalysisTab] fetch error', e); setError(e.message); setLoading(false) })
  }, [isin, tfIdx])

  const periodChange = useMemo(() => {
    if (!chartData || chartData.length < 2) return null
    const first = chartData[0].price
    const last = chartData[chartData.length - 1].price
    return (last - first) / first * 100
  }, [chartData])

  if (portfolio.length === 0) return (
    <p className="text-gray-500 text-sm">Nessun ETF. Importa un CSV nella tab Ordini.</p>
  )

  return (
    <div className="space-y-4">

      {/* Price history card */}
      <div className="bg-gray-900 rounded-lg p-4">

        {/* ETF pills */}
        <div className="flex flex-wrap gap-2 mb-3">
          {available.map(etf => (
            <button
              key={etf.isin}
              onClick={() => setSelectedIsin(etf.isin)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                isin === etf.isin
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:text-white'
              }`}
            >
              {SHORT_NAMES[etf.isin] ?? etf.name}
            </button>
          ))}
        </div>

        {/* Timeframe pills */}
        <div className="flex gap-1 mb-4">
          {TF.map((tf, i) => (
            <button
              key={tf.label}
              onClick={() => setTfIdx(i)}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                tfIdx === i
                  ? 'bg-gray-700 text-white'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {tf.label}
            </button>
          ))}
        </div>

        <Chart data={chartData} loading={loading} error={error} />

        {/* Period performance */}
        {periodChange !== null && !loading && (
          <div className={`mt-3 text-sm font-semibold text-center ${
            periodChange >= 0 ? 'text-green-400' : 'text-red-400'
          }`}>
            {periodChange >= 0 ? '+' : ''}{periodChange.toFixed(2)}% nel periodo
          </div>
        )}
      </div>

      <AllocationChart portfolio={portfolio} prices={prices} />
    </div>
  )
}

export default AnalysisTab
