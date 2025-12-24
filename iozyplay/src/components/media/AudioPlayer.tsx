import { useRef, useState, useEffect } from 'react'

interface AudioPlayerProps {
  mediaUrl: string
  autoPlay: boolean
  shouldPause: boolean
  onMediaReady?: () => void
  onMediaStart?: () => void
}

export default function AudioPlayer({
  mediaUrl,
  autoPlay,
  shouldPause,
  onMediaReady,
  onMediaStart
}: AudioPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const audioRef = useRef<HTMLAudioElement>(null)

  useEffect(() => {
    if (shouldPause) {
      if (audioRef.current && !audioRef.current.paused) {
        audioRef.current.pause()
        setIsPlaying(false)
      }
      return
    }
    
    if (autoPlay && !shouldPause) {
      if (audioRef.current) {
        if (audioRef.current.readyState >= 2) {
          const playPromise = audioRef.current.play()
          if (playPromise !== undefined) {
            playPromise
              .then(() => {
                setIsPlaying(true)
                if (onMediaStart) {
                  setTimeout(() => {
                    onMediaStart()
                  }, 100)
                }
              })
              .catch((error) => {
                console.error('[AudioPlayer] Erreur lors du démarrage de l\'audio:', error)
                setIsPlaying(false)
              })
          }
        } else {
          const onCanPlay = () => {
            if (audioRef.current && !shouldPause && autoPlay) {
              const playPromise = audioRef.current.play()
              if (playPromise !== undefined) {
                playPromise
                  .then(() => {
                    setIsPlaying(true)
                    if (onMediaStart) {
                      setTimeout(() => {
                        onMediaStart()
                      }, 100)
                    }
                  })
                  .catch((error) => {
                    console.error('[AudioPlayer] Erreur lors du démarrage de l\'audio après chargement:', error)
                    setIsPlaying(false)
                  })
              }
            }
            audioRef.current?.removeEventListener('canplay', onCanPlay)
          }
          audioRef.current.addEventListener('canplay', onCanPlay)
        }
      }
    }
  }, [autoPlay, shouldPause, onMediaStart])

  const togglePlayPause = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause()
      } else {
        audioRef.current.play()
      }
      setIsPlaying(!isPlaying)
    }
  }

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime)
      setDuration(audioRef.current.duration)
    }
  }

  const formatTime = (seconds: number) => {
    if (isNaN(seconds)) return '0:00'
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value)
    if (audioRef.current) {
      audioRef.current.currentTime = newTime
      setCurrentTime(newTime)
    }
  }

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0

  return (
    <div className="media-player audio-player" style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', margin: 0, padding: 0 }}>
      {isLoading && (
        <div className="media-loading" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', margin: 0, padding: 0, zIndex: 10 }}>
          <div className="loading-spinner" style={{ margin: '0 0 16px 0', display: 'block' }}></div>
          <p style={{ margin: 0, textAlign: 'center' }}>Chargement du média...</p>
        </div>
      )}
      <audio
        ref={audioRef}
        src={mediaUrl}
        preload="auto"
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={() => {
          if (audioRef.current) {
            setDuration(audioRef.current.duration)
          }
        }}
        onCanPlay={() => {
          setIsLoading(false)
          if (onMediaReady) {
            onMediaReady()
          }
        }}
        onLoadStart={() => setIsLoading(true)}
        onWaiting={() => setIsLoading(true)}
        onPlaying={() => setIsLoading(false)}
        onEnded={() => setIsPlaying(false)}
        onPlay={() => {
          setIsPlaying(true)
          if (onMediaStart) {
            onMediaStart()
          }
        }}
        onPause={() => setIsPlaying(false)}
      />
      <div className="audio-visualizer-wrapper" style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', maxWidth: '600px', margin: '0 auto', padding: '12px', zIndex: 2, height: '140px', minHeight: '140px' }}>
        <div className="audio-visualizer" style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', margin: '0 auto', height: '100%' }}>
          <div className="audio-waves" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', height: '100px', minHeight: '100px', width: '100%', margin: '0 auto' }}>
            {[...Array(20)].map((_, i) => (
              <div
                key={i}
                className={`wave-bar ${isPlaying ? 'active' : ''}`}
                style={{
                  animationDelay: `${i * 0.1}s`,
                  height: isPlaying ? `${Math.random() * 60 + 20}%` : '20%',
                  width: '4px',
                  background: 'linear-gradient(to top, var(--accent-primary), var(--accent-secondary))',
                  borderRadius: '2px',
                  transition: 'height 0.1s ease',
                  alignSelf: 'center',
                  margin: 0
                }}
              />
            ))}
          </div>
        </div>
      </div>
      <div className="audio-controls" style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--spacing-md)', width: '100%', maxWidth: '600px', zIndex: 5, marginTop: 'auto', paddingTop: '8px' }}>
        <button className="play-pause-button" onClick={togglePlayPause} style={{ width: '80px', height: '80px', fontSize: '2rem', marginBottom: 'var(--spacing-sm)' }}>
          {isPlaying ? '⏸️' : '▶️'}
        </button>
        <div className="audio-progress-container" style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', width: '100%' }}>
          <div className="time-display start-time" style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', minWidth: '50px' }}>{formatTime(currentTime)}</div>
          <input
            type="range"
            min="0"
            max={duration || 0}
            value={currentTime}
            onChange={handleSeek}
            className="audio-progress"
            style={{ flex: 1, height: '6px' }}
          />
          <div className="time-display end-time" style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', minWidth: '50px' }}>{formatTime(duration)}</div>
        </div>
      </div>
    </div>
  )
}




