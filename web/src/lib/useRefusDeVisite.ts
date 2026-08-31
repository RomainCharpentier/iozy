import { useEffect } from 'react'
import { EVENEMENT_ECRITURE_REFUSEE, MESSAGE_LECTURE_SEULE } from '../api/client'
import { useToast } from './toast'

/**
 * Montre, en une phrase, pourquoi ce bouton n'a rien fait.
 *
 * <h2>Le filet, pas la porte</h2>
 * Les écrans d'écriture ne sont pas proposés à un visiteur (voir
 * lib/accesInvite), et les principaux gestes d'édition d'une fiche non plus.
 * Restent les petits : cocher un tome, suivre une édition, glisser une œuvre
 * dans un classement. Les masquer un par un, dans une quarantaine d'endroits,
 * revenait à parier qu'aucun ne serait oublié - et l'oubli se serait vu comme
 * un bouton mort, ou comme une erreur rouge qui ne dit rien.
 *
 * <p>Ce hook n'est donc pas une protection - le serveur refuse, et lui seul
 * protège - c'est la RÉPONSE, posée à un seul endroit pour valoir partout.
 */
export function useRefusDeVisite() {
  const toast = useToast()
  useEffect(() => {
    const auRefus = () => toast(MESSAGE_LECTURE_SEULE)
    window.addEventListener(EVENEMENT_ECRITURE_REFUSEE, auRefus)
    return () => window.removeEventListener(EVENEMENT_ECRITURE_REFUSEE, auRefus)
  }, [toast])
}
