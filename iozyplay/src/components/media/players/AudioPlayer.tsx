import { useEffect, useRef, useState } from 'react'
import Soundwave from '../Soundwave'

interface AudioPlayerProps {
  mediaUrl: string
  autoPlay?: boolean
  shouldPause?: boolean
  onMediaReady?: () => void
  onMediaStart?: () => void
}

export default function AudioPlayer({
  mediaUrl,
  autoPlay = false,
  shouldPause = false,
  onMediaReady,
  onMediaStart
}: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const hasStartedRef = useRef(false)
  const [isPlaying, setIsPlaying] = useState(false)

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    let timeoutId: number | null = null

    const cleanup = () => {
      if (timeoutId) {
        clearTimeout(timeoutId)
        timeoutId = null
      }
    }

    const handleCanPlay = () => {
      cleanup()
      if (onMediaReady) {
        onMediaReady()
      }
    }

    const handlePlay = () => {
      setIsPlaying(true)
      if (!hasStartedRef.current) {
        hasStartedRef.current = true
        if (onMediaStart) {
          onMediaStart()
        }
      }
    }

    const handlePause = () => {
      setIsPlaying(false)
    }

    const handleEnded = () => {
      setIsPlaying(false)
    }

    audio.addEventListener('canplay', handleCanPlay)
    audio.addEventListener('play', handlePlay)
    audio.addEventListener('pause', handlePause)
    audio.addEventListener('ended', handleEnded)
    audio.addEventListener('error', () => {
      cleanup()
      if (onMediaReady) {
        onMediaReady()
      }
    })

    // Timeout de 30 secondes pour le chargement
    timeoutId = window.setTimeout(() => {
      cleanup()
      if (onMediaReady) {
        onMediaReady()
      }
    }, 30000)

    return () => {
      cleanup()
      audio.removeEventListener('canplay', handleCanPlay)
      audio.removeEventListener('play', handlePlay)
      audio.removeEventListener('pause', handlePause)
      audio.removeEventListener('ended', handleEnded)
    }
  }, [onMediaReady, onMediaStart])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    if (shouldPause) {
      audio.pause()
    } else if (autoPlay) {
      audio.play().catch((error) => {
        console.error('Error playing audio:', error)
      })
    }
  }, [shouldPause, autoPlay])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    // Réinitialiser hasStarted quand le média change
    hasStartedRef.current = false
  }, [mediaUrl])

  return (
    <div className="audio-player" style={{ width: '100%', height: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '20px', padding: '1.5rem', boxSizing: 'border-box' }}>
      <div style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto', minHeight: '120px', maxHeight: '200px', height: 'auto', overflow: 'visible' }}>
        <Soundwave isPlaying={isPlaying && !shouldPause} />
      </div>
      <audio
        ref={audioRef}
        src={mediaUrl}
        controls
        style={{ width: '100%', maxWidth: '500px', flexShrink: 0 }}
        preload="auto"
      />
    </div>
  )
}

