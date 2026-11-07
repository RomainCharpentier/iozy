/**
 * État du bouton « Passer » / « Suivant » placé à côté du champ de réponse.
 *
 * - Solo : passe directement (question suivante, ou fin du reveal).
 * - En ligne : c'est un vote ; la question (ou le reveal) n'est passée que lorsque
 *   tous les joueurs connectés ont voté. Après le vote, le bouton reste visible,
 *   désactivé, avec le compteur « Vote envoyé · X/Y ».
 */
export interface SkipButtonInput {
  solo: boolean
  isReveal: boolean
  ready: boolean // média lancé, partie en cours
  hasVoted: boolean
  votes: number // votes reçus du serveur (skipVotes)
  total: number // joueurs connectés
}

export interface SkipButtonState {
  icon: string
  label: string
  shortLabel: string // version compacte pour les petits écrans
  title: string
  disabled: boolean
}

export function getSkipButtonState({
  solo,
  isReveal,
  ready,
  hasVoted,
  votes,
  total,
}: SkipButtonInput): SkipButtonState {
  const label = isReveal ? 'Suivant' : 'Passer'

  if (!solo && hasVoted) {
    // Le compteur ne peut pas dépasser le nombre de joueurs connectés (déconnexion en cours)
    const safeTotal = Math.max(total, votes, 1)
    const count = `${votes}/${safeTotal}`
    return {
      icon: '✓',
      label: `Vote envoyé · ${count}`,
      shortLabel: count,
      title: `Vote envoyé : en attente des autres joueurs (${count})`,
      disabled: true,
    }
  }

  if (!ready) {
    return {
      icon: '⏭',
      label,
      shortLabel: label,
      title: 'Attendez que le média démarre',
      disabled: true,
    }
  }

  if (solo) {
    return {
      icon: '⏭',
      label,
      shortLabel: label,
      title: isReveal ? 'Passer à la question suivante' : 'Passer cette question',
      disabled: false,
    }
  }

  return {
    icon: '⏭',
    label,
    shortLabel: label,
    title: isReveal
      ? 'Vote pour passer à la suite : tous les joueurs doivent voter'
      : 'Vote pour passer : tous les joueurs doivent voter',
    disabled: false,
  }
}
