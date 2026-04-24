import { parseCSV, calcPMC, syncToSupabase } from '../utils/parseCSV'

function ImportCSV({ onImport }) {
  function handleFile(e) {
    const file = e.target.files[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = async (ev) => {
      const trades = parseCSV(ev.target.result)
      const portfolio = calcPMC(trades)
      localStorage.setItem('etf_trades', JSON.stringify(trades))
      localStorage.setItem('etf_portfolio', JSON.stringify(portfolio))
      await syncToSupabase(trades)
      onImport(portfolio)
    }
    reader.readAsText(file)
  }

  return (
    <div className="mt-4">
      <label className="block text-sm text-gray-400 mb-2">Importa CSV Trade Republic</label>
      <input
        type="file"
        accept=".csv"
        onChange={handleFile}
        className="block text-sm text-gray-300 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:bg-indigo-600 file:text-white hover:file:bg-indigo-500 cursor-pointer"
      />
    </div>
  )
}

export default ImportCSV