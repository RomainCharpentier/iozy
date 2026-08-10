import { useNavigate } from 'react-router-dom'
import { Scale } from 'lucide-react'

/**
 * Bouton flottant persistant au-dessus de la TabBar (patron courant type
 * Gmail/Google Keep) - raccourci vers "Évaluer un achat", accessible depuis
 * n'importe quel écran sans lui dédier un onglet. Simple bouton unique
 * (pas de menu à choix multiples) depuis que "Ajouter" a récupéré son
 * propre onglet (voir TabBar.tsx) : il n'y a plus qu'une seule destination
 * à proposer ici.
 */
export function FloatingAddButton() {
  const navigate = useNavigate()

  return (
    <button
      type="button"
      onClick={() => navigate('/purchase-analysis')}
      aria-label="Évaluer un achat"
      title="Évaluer un achat"
      className="fixed bottom-20 right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-accentText shadow-lg"
    >
      <Scale size={24} />
    </button>
  )
}
