import { useRef, useState, useEffect } from 'react'

interface VideoPlayerProps {
  mediaUrl: string
  autoPlay: boolean
  shouldPause: boolean
  restartVideo: boolean
  onVideoRestarted?: () => void
  onMediaReady?: () => void
  onMediaStart?: () => void
}

export default function VideoPlayer({
  mediaUrl,
  autoPlay,
  shouldPause,
  restartVideo,
  onVideoRestarted,
  onMediaReady,
  onMediaStart
}: VideoPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    if (restartVideo && videoRef.current) {
      setIsLoading(true)
      videoRef.current.currentTime = 0
      videoRef.current.play().catch(() => {
        setIsLoading(false)
      })
    }
  }, [restartVideo])

  useEffect(() => {
    if (shouldPause) {
      if (videoRef.current && !videoRef.current.paused) {
        videoRef.current.pause()
        setIsPlaying(false)
      }
      return
    }
    
    if (autoPlay && !shouldPause) {
      if (videoRef.current) {
        if (videoRef.current.readyState >= 2) {
          const playPromise = videoRef.current.play()
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
                console.error('[VideoPlayer] Erreur lors du démarrage de la vidéo:', error)
                setIsPlaying(false)
              })
          }
        } else {
          const onCanPlay = () => {
            if (videoRef.current && !shouldPause && autoPlay) {
              const playPromise = videoRef.current.play()
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
                    console.error('[VideoPlayer] Erreur lors du démarrage de la vidéo après chargement:', error)
                    setIsPlaying(false)
                  })
              }
            }
            videoRef.current?.removeEventListener('canplay', onCanPlay)
          }
          videoRef.current.addEventListener('canplay', onCanPlay)
        }
      }
    }
  }, [autoPlay, shouldPause, onMediaStart])

  const togglePlayPause = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause()
      } else {
        videoRef.current.play()
      }
      setIsPlaying(!isPlaying)
    }
  }

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime)
      setDuration(videoRef.current.duration)
    }
  }

  const formatTime = (seconds: number) => {
    if (isNaN(seconds)) return '0:00'
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div className="media-player video-player" style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative', margin: 0, padding: 0 }}>
      {isLoading && (
        <div className="media-loading" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', margin: 0, padding: 0 }}>
          <div className="loading-spinner" style={{ margin: '0 0 16px 0', display: 'block' }}></div>
          <p style={{ margin: 0, textAlign: 'center' }}>Chargement de la vidéo...</p>
        </div>
      )}
      <video
        ref={videoRef}
        src={mediaUrl}
        preload="auto"
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={() => {
          if (videoRef.current) {
            setDuration(videoRef.current.duration)
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
        onPlaying={() => {
          setIsLoading(false)
          if (onMediaStart && !isPlaying) {
            onMediaStart()
          }
        }}
        onEnded={() => setIsPlaying(false)}
        onPlay={() => {
          setIsPlaying(true)
          if (onMediaStart) {
            onMediaStart()
          }
        }}
        className="blindtest-video"
        style={{ maxWidth: '100%', maxHeight: '100%', width: 'auto', height: 'auto', borderRadius: '0.5rem' }}
      />
      <div className="video-controls" style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)', marginTop: 'var(--spacing-md)', padding: 'var(--spacing-sm)', background: 'rgba(0, 0, 0, 0.5)', borderRadius: '0.5rem' }}>
        <button className="play-pause-button" onClick={togglePlayPause} style={{ width: '60px', height: '60px', fontSize: '1.5rem' }}>
          {isPlaying ? '⏸️' : '▶️'}
        </button>
        <div className="time-display" style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-primary)' }}>
          {formatTime(currentTime)} / {formatTime(duration)}
        </div>
      </div>
    </div>
  )
}

