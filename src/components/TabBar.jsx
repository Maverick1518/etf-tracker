const TABS = [
  { id: 'portfolio', label: 'Portfolio', icon: '📊' },
  { id: 'ordini',    label: 'Ordini',    icon: '📋' },
  { id: 'analisi',   label: 'Analisi',   icon: '📈' },
  { id: 'strategia', label: 'Strategia', icon: '🎯' },
]

function TabBar({ active, onChange }) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-800 flex z-50">
      {TABS.map(tab => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={`flex-1 flex flex-col items-center py-2 text-xs gap-0.5 transition-colors ${
            active === tab.id ? 'text-indigo-400' : 'text-gray-500'
          }`}
        >
          <span className="text-xl leading-none">{tab.icon}</span>
          {tab.label}
        </button>
      ))}
    </nav>
  )
}

export default TabBar
