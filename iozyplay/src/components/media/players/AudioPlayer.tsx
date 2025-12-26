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

    const handleCanPlay = () => {
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

    return () => {
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
    <div className="audio-player" style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '20px' }}>
      <Soundwave isPlaying={isPlaying && !shouldPause} />
      <audio
        ref={audioRef}
        src={mediaUrl}
        controls
        style={{ width: '100%', maxWidth: '500px' }}
        preload="auto"
      />
    </div>
  )
}

