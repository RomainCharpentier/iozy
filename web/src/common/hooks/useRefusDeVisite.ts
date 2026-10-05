import { useEffect } from 'react'
import { EVENEMENT_ECRITURE_REFUSEE, MESSAGE_LECTURE_SEULE } from '@/common/api/client'
import { useToast } from '@/common/lib/toast'

/**
 * Shows, in one sentence, why this button did nothing.
 *
 * <h2>The safety net, not the door</h2>
 * The write screens are not offered to a visitor (see lib/accesInvite), and
 * neither are the main editing actions of a detail page. What remains are the
 * small ones: ticking a volume, following an edition, dragging a work into a
 * ranking. Hiding them one by one, in about forty places, amounted to betting
 * that none would be forgotten - and the oversight would have shown up as a
 * dead button, or as a red error that says nothing.
 *
 * <p>This hook is therefore not a protection - the server refuses, and it
 * alone protects - it is the ANSWER, set in one single place to apply
 * everywhere.
 */
export function useRefusDeVisite() {
  const toast = useToast()
  useEffect(() => {
    const auRefus = () => toast(MESSAGE_LECTURE_SEULE)
    window.addEventListener(EVENEMENT_ECRITURE_REFUSEE, auRefus)
    return () => window.removeEventListener(EVENEMENT_ECRITURE_REFUSEE, auRefus)
  }, [toast])
}
