import { useState, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Upload, Download, CheckCircle, AlertCircle, FileSpreadsheet } from 'lucide-react'
import { api } from '../lib/api'

export default function Import() {
  const qc = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState('')
  const [dragOver, setDragOver] = useState(false)

  async function handleFile(file: File) {
    if (!file) return
    setImporting(true)
    setError('')
    setResult(null)
    try {
      const res = await api.importFile(file)
      setResult(res)
      qc.invalidateQueries({ queryKey: ['orders'] })
      qc.invalidateQueries({ queryKey: ['morning'] })
    } catch (e: any) {
      setError(e.message)
    } finally {
      setImporting(false)
    }
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Import & Export</h1>
      </div>

      <div className="p-6">
        <div className="grid grid-cols-2 gap-6">
          {/* Import */}
          <div className="space-y-4">
            <div className="card space-y-4">
              <h2 className="font-bold text-slate-800">Importer depuis Excel / CSV</h2>
              <div className="text-sm text-slate-500 space-y-2">
                <p>Colonnes reconnues (noms en anglais ou français):</p>
                <div className="bg-slate-50 rounded-lg p-3 text-xs font-mono text-slate-600 leading-relaxed">
                  Date · Article/Produit · Price/Prix · Discount/Remise · Cost/Coût · Size/Taille · Color/Couleur · Customer/Client · Payment/Paiement · Status/Statut · Month
                </div>
                <p className="text-amber-700 text-xs bg-amber-50 rounded-lg p-2">
                  Les profits de votre fichier Excel sont ignorés et recalculés automatiquement. Les coûts importés sont marqués "Coût partiel".
                </p>
              </div>

              {/* Drop zone */}
              <div
                className={`border-2 border-dashed rounded-xl p-10 text-center transition-colors cursor-pointer ${dragOver ? 'border-brand-500 bg-brand-50' : 'border-slate-200 hover:border-brand-300 hover:bg-slate-50'}`}
                onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}
                onClick={() => fileRef.current?.click()}
              >
                <FileSpreadsheet size={40} className="mx-auto text-slate-300 mb-3"/>
                <div className="text-sm font-medium text-slate-600">Glisser-déposer votre fichier ici</div>
                <div className="text-xs text-slate-400 mt-1">ou cliquer pour choisir — .xlsx, .xls, .csv</div>
              </div>

              <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}/>

              {importing && (
                <div className="flex items-center gap-2 text-brand-600 justify-center py-2">
                  <div className="w-5 h-5 border-2 border-brand-500 border-t-transparent rounded-full animate-spin"/>
                  <span className="text-sm">Import en cours…</span>
                </div>
              )}

              {error && (
                <div className="flex items-start gap-2 bg-red-50 text-red-700 p-3 rounded-xl">
                  <AlertCircle size={18} className="shrink-0 mt-0.5"/>
                  <div className="text-sm">{error}</div>
                </div>
              )}

              {result && (
                <div className="bg-green-50 rounded-xl p-4 space-y-2">
                  <div className="flex items-center gap-2 text-green-700 font-bold">
                    <CheckCircle size={20}/>
                    Import terminé
                  </div>
                  <div className="text-sm text-green-800">{result.created} commande(s) importée(s) avec succès</div>
                  {result.errors?.length > 0 && (
                    <div className="mt-2">
                      <div className="text-xs font-semibold text-amber-700 mb-1">{result.errors.length} erreur(s):</div>
                      {result.errors.slice(0,5).map((e: string, i: number) => (
                        <div key={i} className="text-xs text-amber-700">{e}</div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Export */}
            <div className="card space-y-3">
              <h2 className="font-bold text-slate-800">Exporter les données</h2>
              <button onClick={() => api.exportOrders()}
                className="w-full flex items-center justify-center gap-2 btn-secondary">
                <Download size={16}/> Exporter les commandes (.xlsx)
              </button>
              <button onClick={() => api.exportAll()}
                className="w-full flex items-center justify-center gap-2 btn-secondary">
                <Download size={16}/> Export complet (commandes + dépenses + cash + drops)
              </button>
              <button onClick={() => api.exportTemplate()}
                className="w-full flex items-center justify-center gap-2 py-2.5 text-brand-600 font-medium text-sm border border-brand-200 rounded-xl bg-brand-50 hover:bg-brand-100 transition-colors">
                <FileSpreadsheet size={16}/> Télécharger le modèle d'import
              </button>
            </div>
          </div>

          {/* Mapping guide */}
          <div className="card">
            <h3 className="font-semibold text-slate-700 mb-4">Guide de correspondance des colonnes</h3>
            <div className="space-y-0">
              {[
                ['Date / date', 'Date de commande', 'JJ/MM/AAAA ou YYYY-MM-DD'],
                ['Article / Produit / Name', 'Nom du produit', 'Texte libre'],
                ['Price / Prix', 'Prix de vente', 'Nombre (FCFA)'],
                ['Discount / Remise', 'Remise appliquée', 'Nombre (FCFA)'],
                ['Cost / Coût', 'Coût total (fabric+sewing)', 'Mappé en 60% tissu + 40% couture'],
                ['Size / Taille', 'Taille', 'S, M, L, XL, Custom…'],
                ['Color / Couleur', 'Couleur', 'Texte libre'],
                ['Customer / Client / Name', 'Nom du client', 'Texte libre'],
                ['Payment / Paiement', 'Statut paiement', 'Paid/Payé → payé, Partial/Partiel → partiel'],
                ['Status / Statut', 'Statut production', 'Delivered/Livré, Cancelled/Annulé…'],
              ].map(([col, field, note], i) => (
                <div key={i} className="flex gap-3 py-3 border-b border-slate-50 last:border-0">
                  <div className="font-mono text-brand-700 shrink-0 w-36 text-xs pt-0.5">{col}</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-slate-700">{field}</div>
                    <div className="text-xs text-slate-400 mt-0.5">{note}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
