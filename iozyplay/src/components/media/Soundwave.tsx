import { useEffect, useState, useRef } from 'react'
import styles from './Soundwave.module.scss'

interface SoundwaveProps {
  isPlaying: boolean
}

export default function Soundwave({ isPlaying }: SoundwaveProps) {
  const [activeBars, setActiveBars] = useState<number[]>([])
  const barHeightsRef = useRef<Record<number, number>>({})

  useEffect(() => {
    if (!isPlaying) {
      setActiveBars([])
      barHeightsRef.current = {}
      return
    }

    // Générer des barres actives de manière aléatoire pour créer un effet visuel
    const interval = setInterval(() => {
      const numBars = 24
      const active: number[] = []

      for (let i = 0; i < numBars; i++) {
        if (Math.random() > 0.3) {
          active.push(i)
          // Stocker la hauteur de chaque barre active pour éviter les déformations
          if (!barHeightsRef.current[i]) {
            barHeightsRef.current[i] = 20 + Math.random() * 80
          }
        } else {
          // Réinitialiser la hauteur quand la barre devient inactive
          delete barHeightsRef.current[i]
        }
      }
      setActiveBars(active)
    }, 150)

    return () => clearInterval(interval)
  }, [isPlaying])

  return (
    <div className={styles.audioWaves}>
      {Array.from({ length: 24 }).map((_, index) => {
        const heightPercent = activeBars.includes(index) ? barHeightsRef.current[index] || 20 : 20

        return (
          <div
            key={index}
            className={activeBars.includes(index) ? `${styles.waveBar} ${styles.waveBarActive}` : styles.waveBar}
            style={{
              height: `${heightPercent}%`,
              minHeight: '20px',
              maxHeight: 'none',
            }}
          />
        )
      })}
    </div>
  )
}
