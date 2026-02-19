interface MediaSyncOverlayProps {
  gameStep: string
  mediaReady: boolean
}

export default function MediaSyncOverlay({ gameStep, mediaReady }: MediaSyncOverlayProps) {
  const getMessage = () => {
    if (gameStep === 'loading' && !mediaReady) return 'Chargement du média...'
    if (gameStep === 'loading' && mediaReady) return 'En attente des autres joueurs...'
    if (gameStep === 'ready') return 'Tous les joueurs sont prêts !'
    if (gameStep === 'starting') return 'Démarrage dans quelques instants...'
    return 'Synchronisation...'
  }

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0, 0, 0, 0.5)',
        zIndex: 100,
        borderRadius: '0.5rem',
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          textAlign: 'center',
          color: 'white',
          background: 'rgba(0, 0, 0, 0.8)',
          padding: '20px',
          borderRadius: '0.5rem',
        }}
      >
        <div className="loading-spinner" style={{ margin: '0 auto 16px' }}></div>
        <p>⏳ Synchronisation...</p>
        <p style={{ fontSize: '0.9em', opacity: 0.8 }}>{getMessage()}</p>
      </div>
    </div>
  )
}
