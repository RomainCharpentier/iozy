import ConfirmDialog from '@/components/common/ConfirmDialog'

interface QuitGameDialogProps {
  isOpen: boolean
  isOnline: boolean
  isHost: boolean
  isGameEnded: boolean
  onLeaveRoom: () => void
  onEndGame: () => void
  onCancel: () => void
}

/** Texte de la confirmation de sortie (exporté pour les tests) */
export function getQuitConfirmMessage(isOnline: boolean, isHost: boolean): string {
  if (!isOnline) return 'Votre progression sera perdue.'
  const base = "Vous ne pourrez revenir qu'avec le lien du salon."
  return isHost ? `${base} L'hôte sera transmis à un autre joueur.` : base
}

/**
 * Confirmation avant de quitter (barre du haut et écran de fin) : chemin de sortie unique,
 * qui quitte le salon côté serveur AVANT de revenir à l'accueil (pas de joueur fantôme).
 */
export default function QuitGameDialog({
  isOpen,
  isOnline,
  isHost,
  isGameEnded,
  onLeaveRoom,
  onEndGame,
  onCancel,
}: QuitGameDialogProps) {
  return (
    <ConfirmDialog
      isOpen={isOpen}
      title={isOnline && isGameEnded ? 'Quitter le salon ?' : 'Quitter la partie ?'}
      message={getQuitConfirmMessage(isOnline, isHost)}
      confirmText="Quitter"
      cancelText="Rester"
      variant="danger"
      onConfirm={() => {
        onLeaveRoom()
        onEndGame()
      }}
      onCancel={onCancel}
    />
  )
}
