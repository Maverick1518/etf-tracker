const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#3b82f6']

function PieChart({ data }) {
  const total = data.reduce((s, d) => s + d.value, 0)
  let angle = -90
  const slices = data.map((d, i) => {
    const pct = d.value / total
    const start = angle
    angle += pct * 360
    const r = 90
    const cx = 110, cy = 110
    const toRad = a => (a * Math.PI) / 180
    const x1 = cx + r * Math.cos(toRad(start))
    const y1 = cy + r * Math.sin(toRad(start))
    const x2 = cx + r * Math.cos(toRad(angle))
    const y2 = cy + r * Math.sin(toRad(angle))
    const large = pct > 0.5 ? 1 : 0
    const mid = start + (pct * 360) / 2
    const lx = cx + r * 0.62 * Math.cos(toRad(mid))
    const ly = cy + r * 0.62 * Math.sin(toRad(mid))
    return { x1, y1, x2, y2, large, cx, cy, r, color: COLORS[i], pct, lx, ly, name: d.name, value: d.value }
  })

  return (
    <svg width={220} height={220} viewBox="0 0 220 220">
      {slices.map((s, i) => (
        <g key={i}>
          <path
            d={`M${s.cx},${s.cy} L${s.x1},${s.y1} A${s.r},${s.r} 0 ${s.large},1 ${s.x2},${s.y2} Z`}
            fill={s.color}
            opacity={0.9}
          />
          {s.pct > 0.08 && (
            <text x={s.lx} y={s.ly} textAnchor="middle" fontSize="11" fontWeight="600" fill="white">
              {(s.pct * 100).toFixed(0)}%
            </text>
          )}
        </g>
      ))}
    </svg>
  )
}

function AllocationChart({ portfolio, prices }) {
  const COLORS_LEG = COLORS
  const data = portfolio.map(etf => {
    const p = prices[etf.isin]
    const value = p ? p.price * etf.shares : etf.invested
    return {
      name: etf.name.replace(' USD (Acc)', '').replace(' (Acc)', ''),
      value: parseFloat(value.toFixed(2))
    }
  })

  return (
    <div className="bg-gray-900 rounded-lg p-4 mt-4">
      <h2 className="text-sm font-semibold text-gray-400 mb-3">Allocazione portafoglio</h2>
      <div className="flex items-center gap-6">
        <PieChart data={data} />
        <div className="space-y-2">
          {data.map((d, i) => (
            <div key={i} className="flex items-center gap-2 text-sm">
              <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS_LEG[i] }} />
              <span className="text-gray-300">{d.name}</span>
              <span className="text-white ml-auto pl-4">€{d.value.toFixed(0)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default AllocationChart