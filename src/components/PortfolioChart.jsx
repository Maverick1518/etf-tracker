import { useMemo } from 'react'

const W = 400
const H = 200
const PAD = { top: 20, right: 20, bottom: 40, left: 56 }
const CW = W - PAD.left - PAD.right
const CH = H - PAD.top - PAD.bottom

function lineChart(points) {
  const n = points.length
  const xScale = i => n === 1 ? PAD.left + CW / 2 : PAD.left + (i / (n - 1)) * CW
  const maxVal = points[n - 1].value
  const yScale = v => maxVal === 0 ? PAD.top + CH : PAD.top + CH - (v / maxVal) * CH

  const poly = points.map((p, i) => `${xScale(i)},${yScale(p.value)}`).join(' ')

  const area = [
    `M${xScale(0)},${PAD.top + CH}`,
    ...points.map((p, i) => `L${xScale(i)},${yScale(p.value)}`),
    `L${xScale(n - 1)},${PAD.top + CH}`,
    'Z',
  ].join(' ')

  return { xScale, yScale, poly, area, maxVal }
}

function fmtEur(v) {
  return v >= 1000 ? `€${(v / 1000).toFixed(1)}k` : `€${v.toFixed(0)}`
}

function fmtDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('it-IT', { month: 'short', year: '2-digit' })
}

function PortfolioChart() {
  const points = useMemo(() => {
    try {
      const trades = JSON.parse(localStorage.getItem('etf_trades') || '[]')
      if (!trades.length) return []

      const byDate = {}
      trades.forEach(t => {
        const d = t.date ? t.date.slice(0, 10) : null
        if (!d) return
        byDate[d] = (byDate[d] || 0) + Math.abs(parseFloat(t.amount) || 0)
      })

      let cum = 0
      return Object.entries(byDate)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([date, amount]) => ({ date, value: (cum += amount) }))
    } catch {
      return []
    }
  }, [])

  if (points.length === 0) {
    return (
      <div className="bg-gray-900 rounded-lg p-4">
        <p className="text-gray-500 text-sm">Nessun dato. Importa un CSV nella tab Ordini.</p>
      </div>
    )
  }

  const { xScale, yScale, poly, area, maxVal } = lineChart(points)
  const n = points.length

  const yTicks = [0, maxVal * 0.5, maxVal]
  const xIdxs = n <= 2
    ? points.map((_, i) => i)
    : [0, Math.round((n - 1) / 2), n - 1]

  return (
    <div className="bg-gray-900 rounded-lg p-4">
      <h2 className="text-sm font-semibold text-gray-400 mb-3">Investito cumulativo</h2>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ display: 'block' }}>
        {/* grid + Y labels */}
        {yTicks.map((v, i) => (
          <g key={i}>
            <line
              x1={PAD.left} y1={yScale(v)}
              x2={W - PAD.right} y2={yScale(v)}
              stroke="#1f2937" strokeWidth={1}
            />
            <text x={PAD.left - 6} y={yScale(v) + 4} textAnchor="end" fontSize="10" fill="#6b7280">
              {fmtEur(v)}
            </text>
          </g>
        ))}

        {/* X labels */}
        {xIdxs.map(i => (
          <text key={i} x={xScale(i)} y={H - PAD.bottom + 16} textAnchor="middle" fontSize="10" fill="#6b7280">
            {fmtDate(points[i].date)}
          </text>
        ))}

        {/* area fill */}
        <path d={area} fill="#6366f1" opacity={0.1} />

        {/* line */}
        <polyline
          points={poly}
          fill="none"
          stroke="#818cf8"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* dots — only when few points */}
        {n <= 40 && points.map((p, i) => (
          <circle key={i} cx={xScale(i)} cy={yScale(p.value)} r={3} fill="#818cf8" />
        ))}

        {/* last value label */}
        <text
          x={xScale(n - 1) - 6}
          y={yScale(maxVal) - 8}
          textAnchor="end"
          fontSize="11"
          fontWeight="600"
          fill="#818cf8"
        >
          {fmtEur(maxVal)}
        </text>
      </svg>
    </div>
  )
}

export default PortfolioChart
