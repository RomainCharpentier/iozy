import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, X, PackagePlus, Scale } from 'lucide-react'

/**
 * Bouton flottant "+" persistant au-dessus de la TabBar (patron courant type
 * Gmail/Google Keep) - centralise les deux parcours d'acquisition (Ajout
 * rapide, Évaluer un achat) qui n'ont plus d'onglet dédié depuis la
 * réorganisation à 4 onglets (voir TabBar.tsx) : "je veux faire entrer
 * quelque chose de nouveau dans ma collection" reste accessible en un tap
 * depuis n'importe quel écran, sans lui dédier un 5e onglet.
 */
export function FloatingAddButton() {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()

  function go(path: string) {
    setOpen(false)
    navigate(path)
  }

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-20 bg-black/40"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}
      <div className="fixed bottom-20 right-4 z-30 flex flex-col items-end gap-3">
        {open && (
          <>
            <button
              type="button"
              onClick={() => go('/purchase-analysis')}
              className="flex items-center gap-2 rounded-full bg-surface px-4 py-2.5 text-sm font-medium text-textPrimary shadow-lg"
            >
              <Scale size={16} />
              Évaluer un achat
            </button>
            <button
              type="button"
              onClick={() => go('/add')}
              className="flex items-center gap-2 rounded-full bg-surface px-4 py-2.5 text-sm font-medium text-textPrimary shadow-lg"
            >
              <PackagePlus size={16} />
              Ajouter à ma collection
            </button>
          </>
        )}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? 'Fermer le menu ajouter' : 'Ajouter'}
          aria-expanded={open}
          className="flex h-14 w-14 items-center justify-center rounded-full bg-accent text-accentText shadow-lg"
        >
          {open ? <X size={24} /> : <Plus size={24} />}
        </button>
      </div>
    </>
  )
}
