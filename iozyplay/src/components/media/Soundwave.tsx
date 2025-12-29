import { useEffect, useState } from 'react'

interface SoundwaveProps {
  isPlaying: boolean
}

export default function Soundwave({ isPlaying }: SoundwaveProps) {
  const [activeBars, setActiveBars] = useState<number[]>([])

  useEffect(() => {
    if (!isPlaying) {
      setActiveBars([])
      return
    }

    // Générer des barres actives de manière aléatoire pour créer un effet visuel
    const interval = setInterval(() => {
      const numBars = 20
      const active: number[] = []
      for (let i = 0; i < numBars; i++) {
        if (Math.random() > 0.3) {
          active.push(i)
        }
      }
      setActiveBars(active)
    }, 150)

    return () => clearInterval(interval)
  }, [isPlaying])

  return (
    <div className="audio-waves">
      {Array.from({ length: 20 }).map((_, index) => (
        <div
          key={index}
          className={`wave-bar ${activeBars.includes(index) ? 'active' : ''}`}
          style={{
            height: activeBars.includes(index) 
              ? `${20 + Math.random() * 80}%` 
              : '20%'
          }}
        />
      ))}
    </div>
  )
}





