import { useState, useEffect } from 'react'
import { parseCSV, calcPMC } from '../utils/parseCSV'
import { buildSnapshotsFromTrades } from '../utils/snapshot'

const LAST_IMPORT_KEY = 'etf_last_import'

function ImportCSV({ onImport }) {
  const [pendingFile, setPendingFile] = useState(null)
  const [lastImport, setLastImport] = useState(null)
  const [successMsg, setSuccessMsg] = useState(null)

  useEffect(() => {
    const raw = localStorage.getItem(LAST_IMPORT_KEY)
    if (raw) {
      try {
        setLastImport(JSON.parse(raw))
      } catch {
        // ignore corrupted entry
      }
    }
  }, [])

  function handleFileChange(e) {
    const file = e.target.files[0]
    setPendingFile(file || null)
  }

  function handleCarica() {
    if (!pendingFile) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const trades = parseCSV(ev.target.result)
      const portfolio = calcPMC(trades)
      localStorage.setItem('etf_trades', JSON.stringify(trades))
      localStorage.setItem('etf_portfolio', JSON.stringify(portfolio))

      const snapshots = buildSnapshotsFromTrades(trades)
      localStorage.setItem('etf_snapshots', JSON.stringify(snapshots))

      const info = {
        filename: pendingFile.name,
        count: trades.length,
        date: new Date().toLocaleString('it-IT'),
      }
      localStorage.setItem(LAST_IMPORT_KEY, JSON.stringify(info))
      setLastImport(info)
      setSuccessMsg(`✓ CSV importato — ${trades.length} ordini caricati`)

      onImport(portfolio)
      setPendingFile(null)
    }
    reader.readAsText(pendingFile)
  }

  return (
    <div className="mt-4">
      <label className="block text-sm text-gray-400 mb-2">Importa CSV Trade Republic</label>
      {lastImport && (
        <p className="text-xs text-gray-500 mb-2">
          Ultimo import: {lastImport.filename} · {lastImport.date} · {lastImport.count} ordini
        </p>
      )}
      <div className="flex items-center gap-3">
        <input
          type="file"
          accept=".csv"
          onChange={handleFileChange}
          className="block text-sm text-gray-300 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:bg-indigo-600 file:text-white hover:file:bg-indigo-500 cursor-pointer"
        />
        {pendingFile && (
          <button
            onClick={handleCarica}
            className="bg-indigo-600 text-white text-sm px-3 py-1.5 rounded hover:bg-indigo-500"
          >
            Carica
          </button>
        )}
      </div>
      {successMsg && (
        <p className="text-sm text-green-500 mt-2">{successMsg}</p>
      )}
    </div>
  )
}

export default ImportCSV