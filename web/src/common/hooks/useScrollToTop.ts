import { useLayoutEffect } from 'react'
import { useNavigationType } from 'react-router-dom'

/**
 * Ouvrir un écran, c'est en voir le haut.
 *
 * <h2>Ce que son absence donnait</h2>
 * Une application à page unique ne recharge rien : la position de défilement
 * survit donc à la navigation. Descendre dans « Ma collection » puis toucher
 * une œuvre ouvrait sa fiche <b>à la même hauteur</b>. Mesuré entre deux
 * fiches : parti de 902 px sur l'une, on arrivait à 1055 px sur l'autre, son
 * titre hors écran, la section « Assistant » en haut de l'écran - au milieu
 * d'une page qu'on vient d'ouvrir.
 *
 * <p>Le défaut se cache bien : il ne se voit que si la page d'arrivée est au
 * moins aussi haute que le décalage courant, sinon le navigateur ramène tout
 * seul dans les clous. Avec cinq œuvres en base, presque rien ; avec une vraie
 * collection, systématique.
 *
 * <h2>Pourquoi seulement en avant</h2>
 * `POP` - retour et avance - est laissé au navigateur, qui restaure très bien :
 * vérifié, 1200 px retrouvés au pixel près sur une fiche. Reprendre la main
 * dessus ne ferait qu'abîmer quelque chose qui marche.
 *
 * <h2>Pourquoi un effet de MISE EN PAGE</h2>
 * Deux raisons, et la seconde est la vraie.
 * <ol>
 *   <li>Le saut a lieu pendant le commit, avant le premier affichage : on ne
 *       voit jamais la page apparaître décalée puis se recadrer.</li>
 *   <li>React exécute TOUS les effets de mise en page avant le moindre effet
 *       ordinaire. Un écran qui vise volontairement une section précise le fait
 *       dans un `useEffect` - voir ProfilePage, qui déroule jusqu'au partage
 *       quand on y arrive par le raccourci. En `useEffect` ici, ce hook aurait
 *       gagné la course (les effets d'un parent passent après ceux de ses
 *       enfants) et annulé cette intention. En `useLayoutEffect`, il passe
 *       avant : l'écran garde le dernier mot sur sa propre destination.</li>
 * </ol>
 */
export function useScrollToTopOnNavigation(pathname: string): void {
  const typeDeNavigation = useNavigationType()

  useLayoutEffect(() => {
    if (typeDeNavigation === 'POP') return
    window.scrollTo(0, 0)
  }, [pathname, typeDeNavigation])
}
