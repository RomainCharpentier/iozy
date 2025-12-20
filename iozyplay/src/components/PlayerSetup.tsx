import { useState } from 'react'
import { GameMode, Player } from '../types'
import { soundManager } from '../utils/sounds'

interface PlayerSetupProps {
  onStart: (mode: GameMode, players: Player[]) => void
  onBack: () => void
}

export default function PlayerSetup({ onStart, onBack }: PlayerSetupProps) {
  const [gameMode, setGameMode] = useState<GameMode>('solo')
  const [playerCount, setPlayerCount] = useState<number>(2)
  const [playerNames, setPlayerNames] = useState<string[]>(['Joueur 1', 'Joueur 2'])

  const handleModeChange = (mode: GameMode) => {
    soundManager.playClick()
    setGameMode(mode)
    if (mode === 'solo') {
      setPlayerCount(1)
      setPlayerNames(['Joueur'])
    } else {
      setPlayerCount(2)
      setPlayerNames(['Joueur 1', 'Joueur 2'])
    }
  }

  const handlePlayerCountChange = (count: number) => {
    soundManager.playClick()
    if (count < 2) count = 2
    if (count > 6) count = 6
    setPlayerCount(count)
    
    // Ajuster les noms des joueurs
    const newNames = [...playerNames]
    while (newNames.length < count) {
      newNames.push(`Joueur ${newNames.length + 1}`)
    }
    while (newNames.length > count) {
      newNames.pop()
    }
    setPlayerNames(newNames)
  }

  const handlePlayerNameChange = (index: number, name: string) => {
    const newNames = [...playerNames]
    newNames[index] = name || `Joueur ${index + 1}`
    setPlayerNames(newNames)
  }

  const handleStart = () => {
    const players: Player[] = playerNames.map((name, index) => ({
      id: `player-${index}`,
      name: name.trim() || `Joueur ${index + 1}`,
      score: 0
    }))

    soundManager.playStart()
    onStart(gameMode, players)
  }

  return (
    <div className="player-setup">
      <h2>Configuration de la partie</h2>
      
      <div className="mode-selection">
        <h3>Mode de jeu</h3>
        <div className="mode-buttons">
          <button
            className={`mode-button ${gameMode === 'solo' ? 'active' : ''}`}
            onClick={() => handleModeChange('solo')}
          >
            🎮 Solo
          </button>
          <button
            className={`mode-button ${gameMode === 'multi' ? 'active' : ''}`}
            onClick={() => handleModeChange('multi')}
          >
            👥 Multijoueur
          </button>
        </div>
      </div>

      {gameMode === 'multi' && (
        <div className="players-config">
          <h3>Nombre de joueurs</h3>
          <div className="player-count-selector">
            <button
              className="count-button"
              onClick={() => handlePlayerCountChange(playerCount - 1)}
              disabled={playerCount <= 2}
            >
              −
            </button>
            <span className="count-display">{playerCount}</span>
            <button
              className="count-button"
              onClick={() => handlePlayerCountChange(playerCount + 1)}
              disabled={playerCount >= 6}
            >
              +
            </button>
          </div>

          <h3>Noms des joueurs</h3>
          <div className="player-names">
            {playerNames.map((name, index) => (
              <div key={index} className="player-name-input">
                <label>Joueur {index + 1}</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => handlePlayerNameChange(index, e.target.value)}
                  placeholder={`Joueur ${index + 1}`}
                  maxLength={20}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="setup-actions">
        <button className="back-button" onClick={onBack}>
          ← Retour
        </button>
        <button className="start-button" onClick={handleStart}>
          Continuer →
        </button>
      </div>
    </div>
  )
}

