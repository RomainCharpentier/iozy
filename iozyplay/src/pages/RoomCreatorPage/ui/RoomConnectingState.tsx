interface RoomConnectingStateProps {
  isConnecting: boolean
  error: string | null
  onBack: () => void
}

export default function RoomConnectingState({
  isConnecting,
  error,
  onBack,
}: RoomConnectingStateProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 'calc(100vh - 4rem)',
        flexDirection: 'column',
        gap: 'var(--spacing-md)',
      }}
    >
      <h2 style={{ fontSize: 'var(--font-size-xl)' }}>Création du salon...</h2>
      {isConnecting && (
        <>
          <div
            style={{
              width: '50px',
              height: '50px',
              border: '4px solid var(--border)',
              borderTopColor: 'var(--accent-primary)',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
            }}
          ></div>
          <p className="text-secondary">Connexion au serveur...</p>
        </>
      )}
      {error && (
        <div style={{ textAlign: 'center', maxWidth: '600px' }}>
          <p style={{ color: 'var(--error)', marginBottom: 'var(--spacing-md)' }}>{error}</p>
          <p className="text-secondary" style={{ marginBottom: 'var(--spacing-md)' }}>
            Pour démarrer le serveur backend, exécutez : <code>npm run dev:server</code>
          </p>
          <button className="btn btn-secondary" onClick={onBack}>
            ← Retour
          </button>
        </div>
      )}
    </div>
  )
}
