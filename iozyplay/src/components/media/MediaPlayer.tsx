import { useState, useRef, useEffect } from 'react'
import { MediaType } from '../../types'
import { isYouTubeUrl } from '../../utils/youtube'
import YouTubePlayer from './YouTubePlayer' // Même dossier

interface MediaPlayerProps {
  type: MediaType
  mediaUrl: string
  autoPlay?: boolean
  showVideo?: boolean
  restartVideo?: boolean
  onVideoRestarted?: () => void
  timeLimit?: number // Durée du timer pour faire boucler la vidéo si nécessaire
  shouldPause?: boolean
  onMediaReady?: () => void
}

export default function MediaPlayer({ 
  type, 
  mediaUrl, 
  autoPlay = false,
  showVideo = false,
  restartVideo = false,
  onVideoRestarted,
  timeLimit,
  shouldPause = false,
  onMediaReady
}: MediaPlayerProps) {
  // Si c'est une URL YouTube, utiliser le composant YouTube
  if (isYouTubeUrl(mediaUrl)) {
    return (
      <YouTubePlayer 
        mediaUrl={mediaUrl} 
        autoPlay={autoPlay}
        showVideo={showVideo}
        restartVideo={restartVideo}
        onVideoRestarted={onVideoRestarted}
        timeLimit={timeLimit}
        shouldPause={shouldPause}
        onMediaReady={onMediaReady}
      />
    )
  }
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const audioRef = useRef<HTMLAudioElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    if (restartVideo && type === 'video' && videoRef.current) {
      setIsLoading(true)
      videoRef.current.currentTime = 0
      videoRef.current.play().catch(() => {
        setIsLoading(false)
      })
    }
  }, [restartVideo, type])

  useEffect(() => {
    if (shouldPause) {
      if (type === 'video' && videoRef.current) {
        videoRef.current.pause()
        setIsPlaying(false)
      } else if (type === 'audio' && audioRef.current) {
        audioRef.current.pause()
        setIsPlaying(false)
      }
      return
    }
    
    if (autoPlay && type === 'audio' && audioRef.current) {
      audioRef.current.play()
      setIsPlaying(true)
    } else if (autoPlay && type === 'video' && videoRef.current) {
      videoRef.current.play()
      setIsPlaying(true)
    }
  }, [autoPlay, type, shouldPause])

  const togglePlayPause = () => {
    if (type === 'audio' && audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause()
      } else {
        audioRef.current.play()
      }
      setIsPlaying(!isPlaying)
    } else if (type === 'video' && videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause()
      } else {
        videoRef.current.play()
      }
      setIsPlaying(!isPlaying)
    }
  }

  const handleTimeUpdate = () => {
    if (type === 'audio' && audioRef.current) {
      setCurrentTime(audioRef.current.currentTime)
      setDuration(audioRef.current.duration)
    } else if (type === 'video' && videoRef.current) {
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

  if (type === 'image') {
    return (
      <div className="media-player image-player" style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <img src={mediaUrl} alt="Blindtest" className="blindtest-image" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: '0.5rem' }} />
      </div>
    )
  }

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value)
    if (type === 'audio' && audioRef.current) {
      audioRef.current.currentTime = newTime
      setCurrentTime(newTime)
    } else if (type === 'video' && videoRef.current) {
      videoRef.current.currentTime = newTime
      setCurrentTime(newTime)
    }
  }

  if (type === 'audio') {
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
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={() => {
            if (audioRef.current) {
              setDuration(audioRef.current.duration)
            }
          }}
          onCanPlay={() => {
            setIsLoading(false)
            if (onMediaReady && !shouldPause) {
              setTimeout(() => {
                onMediaReady()
              }, 100)
            }
          }}
          onLoadStart={() => setIsLoading(true)}
          onWaiting={() => setIsLoading(true)}
          onPlaying={() => setIsLoading(false)}
          onEnded={() => setIsPlaying(false)}
          onPlay={() => setIsPlaying(true)}
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

  if (type === 'video') {
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
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={() => {
            if (videoRef.current) {
              setDuration(videoRef.current.duration)
            }
          }}
          onCanPlay={() => {
            setIsLoading(false)
            if (onMediaReady && !shouldPause) {
              setTimeout(() => {
                onMediaReady()
              }, 100)
            }
          }}
          onLoadStart={() => setIsLoading(true)}
          onWaiting={() => setIsLoading(true)}
          onPlaying={() => setIsLoading(false)}
          onEnded={() => setIsPlaying(false)}
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

  return null
}

