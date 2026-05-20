import { useState } from 'react'
import { parseCSV, calcPMC } from '../utils/parseCSV'

function ImportCSV({ onImport }) {
  const [pendingFile, setPendingFile] = useState(null)

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
      onImport(portfolio)
      setPendingFile(null)
    }
    reader.readAsText(pendingFile)
  }

  return (
    <div className="mt-4">
      <label className="block text-sm text-gray-400 mb-2">Importa CSV Trade Republic</label>
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
    </div>
  )
}

export default ImportCSV