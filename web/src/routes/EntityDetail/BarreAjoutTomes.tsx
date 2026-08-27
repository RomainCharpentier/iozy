import { Check, Loader2 } from 'lucide-react'
import { ErrorBanner } from '../../components/ErrorBanner'

/**
 * Ce qui accompagne une sélection de tomes à ajouter : l'état des
 * exemplaires, leur prix, et le bouton qui valide.
 *
 * <h2>Pourquoi elle n'apparaît qu'une fois quelque chose de coché</h2>
 * C'était un formulaire permanent sur l'ancien écran `/add/draft`, où
 * l'ajout était la seule raison d'être de la page. Sur la fiche, ajouter
 * n'est qu'une chose parmi d'autres : demander l'état et le prix avant
 * même de savoir s'il y aura un ajout ferait de la fiche un formulaire.
 *
 * <h2>Un clic, et rien d'autre</h2>
 * Elle demandait l'état des exemplaires et leur prix avant de laisser ajouter.
 * C'est deux questions de trop au moment où l'on veut simplement dire « je les
 * ai » (décision utilisateur du 2026-08-27) : l'état est stocké à `NEW`, comme
 * c'était déjà la valeur par défaut, et les deux se corrigent ensuite sur
 * chaque exemplaire (voir OwnershipDetails) - là où ils décrivent quelque
 * chose de réel plutôt qu'un formulaire à remplir d'avance.
 */
export function BarreAjoutTomes({
  nombre,
  onAjouter,
  enCours,
  attente,
  erreur,
  onToutDeselectionner,
}: {
  nombre: number
  onAjouter: () => void
  enCours: boolean
  /** Les informations de l'œuvre ne sont pas encore connues. Ajouter
   *  maintenant créerait une fiche sans jaquette ni auteur - constaté en
   *  direct : deux tomes ajoutés depuis un aperçu ouvert par URL, dont la
   *  recherche de métadonnées n'avait pas encore répondu, ont donné une œuvre
   *  aux attributs vides. */
  attente: boolean
  erreur: string | null
  onToutDeselectionner: () => void
}) {
  if (nombre === 0) return null

  return (
    <div className="flex flex-col gap-4 rounded-[20px] border border-accent/30 bg-accentTint p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-medium text-textPrimary">
          {nombre} tome{nombre > 1 ? 's' : ''} sélectionné{nombre > 1 ? 's' : ''}
        </p>
        <button type="button" onClick={onToutDeselectionner} className="text-[13px] text-textDim underline">
          Tout désélectionner
        </button>
      </div>

      <div className="flex flex-wrap items-end gap-5">
        <button
          type="button"
          onClick={onAjouter}
          disabled={enCours || attente}
          className="flex min-h-12 items-center gap-2.5 rounded-[14px] bg-accent px-5 text-sm font-semibold text-accentInk shadow-token-accent transition-transform hover:-translate-y-px disabled:opacity-50"
        >
          {enCours ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
          {enCours ? 'Ajout en cours...' : `Ajouter à ma collection`}
        </button>
      </div>

      {attente && (
        <p className="text-[13px] text-textDim">
          Informations de l'œuvre en cours de chargement — encore un instant avant de pouvoir ajouter.
        </p>
      )}
      {erreur && <ErrorBanner message={erreur} />}
    </div>
  )
}
