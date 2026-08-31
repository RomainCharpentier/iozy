import { LogOut } from 'lucide-react'
import { useAuth } from '../lib/useAuth'

/**
 * Sortir : <b>un</b> bouton, à <b>un</b> endroit, pour tout le monde.
 *
 * <h2>Il y en avait deux, et c'était deux de trop</h2>
 * « Se déconnecter » vivait dans les Paramètres, « Quitter » dans le bandeau
 * de visite. Deux boutons, deux mots, deux places - pour un seul geste. Et le
 * premier était introuvable : trois clics depuis l'avatar (Profil, puis
 * Paramètres, puis la section Mon compte), c'est-à-dire nulle part pour qui
 * ne connaît pas le chemin.
 *
 * <p>Il n'y en a plus qu'un, dans l'en-tête, sur tous les écrans. Un visiteur
 * n'a ni profil ni réglages où aller chercher une sortie (voir
 * lib/accesInvite) ; un compte, lui, n'avait aucune raison de la chercher si
 * loin.
 *
 * <h2>Une icône, comme ses voisines</h2>
 * Aucun libellé à l'écran : l'en-tête porte déjà l'administration en icône
 * seule, et pour la même raison - il doit rester calme. Un mot ici aurait
 * pesé plus lourd que les deux boutons réunis, et il aurait fallu le faire
 * disparaître sur mobile, donc écrire deux règles pour un seul bouton.
 *
 * <p>Le <b>nom accessible</b>, lui, est toujours là, et il suit qui l'on est :
 * on <b>se déconnecte</b> d'un compte, on <b>quitte</b> une visite - il n'y a
 * pas de compte à quitter. C'est ce nom que lit un lecteur d'écran, et c'est
 * l'infobulle que voit une souris. Une icône muette n'aurait été une sortie
 * que pour qui devine.
 *
 * <h2>Même en cas d'échec, on sort</h2>
 * Le hook s'en charge (voir `useAuth`, `onSettled`) : ce que la personne
 * voulait, c'est sortir, et un serveur injoignable ne doit pas l'enfermer
 * dans une session qu'elle a demandé à fermer.
 */
export function BoutonSortie({ compact = false }: { compact?: boolean }) {
  const { estInvite, deconnexion } = useAuth()
  // Les mêmes deux tailles que les autres raccourcis d'en-tête : elles se
  // lisent comme une rangée, pas comme trois boutons dessinés séparément.
  const taille = compact ? 'h-9 w-9' : 'h-[38px] w-[38px]'
  const mot = estInvite ? 'Quitter' : 'Se déconnecter'

  return (
    <button
      type="button"
      onClick={() => deconnexion.mutate()}
      disabled={deconnexion.isPending}
      title={mot}
      aria-label={mot}
      className={`flex ${taille} shrink-0 items-center justify-center rounded-xl text-textDim transition-colors hover:bg-rowHover hover:text-textPrimary disabled:opacity-50`}
    >
      <LogOut size={17} />
    </button>
  )
}
