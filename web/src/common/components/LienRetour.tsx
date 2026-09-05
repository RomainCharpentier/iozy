import { useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { retourDepuis, type Retour } from '@/common/lib/retour'

/**
 * Le chemin du retour, en haut d'un écran qu'on a forcément ouvert depuis
 * ailleurs.
 *
 * <h2>Deux sources, et la première l'emporte</h2>
 * Si celui qui a ouvert cet écran a <b>nommé</b> son origine (voir
 * {@code lib/retour}), c'est elle qu'on propose : un rayon ouvert depuis
 * Découvrir y revient, pas à Ma collection. Sinon - lien reçu, rechargement,
 * URL tapée - on propose le <b>parent naturel</b>, celui qui contient
 * réellement cet écran dans l'application.
 *
 * <p>Le second cas est la raison d'être de ce composant : dix écrans n'avaient
 * <b>aucun</b> retour. Ils sont tous accessibles depuis quelque part, et
 * depuis nulle part ailleurs - « Comptes » depuis Administration, « Bilan
 * annuel » depuis Découvrir. Sans lien, la seule sortie était le bouton
 * Précédent du navigateur, qui n'existe pas dans une app installée en plein
 * écran (voir le manifeste PWA, {@code display: standalone}).
 *
 * <h2>Le libellé NOMME la destination</h2>
 * Jamais « Retour » seul. Un « Retour » sans destination ment une fois sur
 * deux, et c'est exactement ce que {@code navigate(-1)} ferait : ouvrir deux
 * écrans d'affilée ramènerait au précédent, pas à celui qui contient.
 *
 * <h2>44 px de haut</h2>
 * Le premier élément interactif de la page, et le plus susceptible d'être visé
 * au pouce en haut de l'écran. Les copies manuelles de ce lien s'en passaient
 * (leur texte fait 20 px) : c'est aussi ce que cette extraction corrige.
 */
export function LienRetour({ parDefaut }: { parDefaut: Retour }) {
  const navigate = useNavigate()
  const retour = retourDepuis(useLocation().state) ?? parDefaut

  return (
    <button
      type="button"
      onClick={() => navigate(retour.to)}
      className="flex min-h-11 w-fit items-center gap-1.5 text-sm font-semibold text-textDim hover:text-textPrimary"
    >
      <ArrowLeft size={15} />
      {retour.libelle}
    </button>
  )
}
