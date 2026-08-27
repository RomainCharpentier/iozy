import { Check, Loader2 } from 'lucide-react'
import { ErrorBanner } from '../../components/ErrorBanner'

/**
 * Ajouter à sa collection une œuvre qui n'a PAS de tome - un jeu vidéo, un jeu
 * de société.
 *
 * <h2>Un clic, et rien d'autre</h2>
 * Ce bloc demandait l'état de l'exemplaire et son prix avant de laisser
 * ajouter. C'est deux questions de trop au moment où l'on veut simplement
 * dire « je l'ai » (décision utilisateur du 2026-08-27) : l'état est stocké à
 * `NEW`, comme c'était déjà la valeur par défaut, et les deux se corrigent
 * ensuite sur l'exemplaire lui-même (voir OwnershipDetails) - là où ils
 * décrivent quelque chose de réel plutôt qu'un formulaire à remplir d'avance.
 */
export function AjoutDirect({
  onAjouter,
  enCours,
  attente,
  erreur,
}: {
  onAjouter: () => void
  enCours: boolean
  /** Les informations de l'œuvre ne sont pas encore connues - ajouter
   *  maintenant créerait une fiche sans jaquette ni auteur (constaté en
   *  direct sur un aperçu ouvert par URL). */
  attente: boolean
  erreur: string | null
}) {
  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={onAjouter}
        disabled={enCours || attente}
        title={attente ? "Les informations de l'œuvre ne sont pas encore chargées" : undefined}
        className="flex min-h-12 w-fit items-center gap-2 rounded-[14px] bg-accent px-5 text-sm font-semibold text-accentInk shadow-token-accent disabled:opacity-50"
      >
        {enCours ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
        Ajouter à ma collection
      </button>

      {attente && <p className="text-[13px] text-textDim">Chargement des informations de l&apos;œuvre...</p>}
      {erreur && <ErrorBanner message={erreur} />}
    </div>
  )
}
