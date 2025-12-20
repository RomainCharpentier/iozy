import { useState, useRef, useEffect } from 'react'
import { MediaType } from '../types'
import { isYouTubeUrl } from '../utils/youtube'
import YouTubePlayer from './YouTubePlayer'

interface MediaPlayerProps {
  type: MediaType
  mediaUrl: string
  autoPlay?: boolean
  showVideo?: boolean
  restartVideo?: boolean
  onVideoRestarted?: () => void
  timeLimit?: number // Durée du timer pour faire boucler la vidéo si nécessaire
}

export default function MediaPlayer({ 
  type, 
  mediaUrl, 
  autoPlay = false,
  showVideo = false,
  restartVideo = false,
  onVideoRestarted,
  timeLimit
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
      />
    )
  }
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const audioRef = useRef<HTMLAudioElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    if (autoPlay && type === 'audio' && audioRef.current) {
      audioRef.current.play()
      setIsPlaying(true)
    } else if (autoPlay && type === 'video' && videoRef.current) {
      videoRef.current.play()
      setIsPlaying(true)
    }
  }, [autoPlay, type])

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
      <div className="media-player image-player">
        <img src={mediaUrl} alt="Blindtest" className="blindtest-image" />
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
      <div className="media-player audio-player">
        <audio
          ref={audioRef}
          src={mediaUrl}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={() => {
            if (audioRef.current) {
              setDuration(audioRef.current.duration)
            }
          }}
          onEnded={() => setIsPlaying(false)}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
        />
        <div className="audio-visualizer">
          <div className="audio-waves">
            {[...Array(20)].map((_, i) => (
              <div
                key={i}
                className={`wave-bar ${isPlaying ? 'active' : ''}`}
                style={{
                  animationDelay: `${i * 0.1}s`,
                  height: isPlaying ? `${Math.random() * 60 + 20}%` : '20%'
                }}
              />
            ))}
          </div>
        </div>
        <div className="audio-controls">
          <button className="play-pause-button" onClick={togglePlayPause}>
            {isPlaying ? '⏸️' : '▶️'}
          </button>
          <div className="audio-progress-container">
            <div className="time-display start-time">{formatTime(currentTime)}</div>
            <input
              type="range"
              min="0"
              max={duration || 0}
              value={currentTime}
              onChange={handleSeek}
              className="audio-progress"
            />
            <div className="time-display end-time">{formatTime(duration)}</div>
          </div>
        </div>
      </div>
    )
  }

  if (type === 'video') {
    return (
      <div className="media-player video-player">
        <video
          ref={videoRef}
          src={mediaUrl}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={() => {
            if (videoRef.current) {
              setDuration(videoRef.current.duration)
            }
          }}
          onEnded={() => setIsPlaying(false)}
          className="blindtest-video"
        />
        <div className="video-controls">
          <button className="play-pause-button" onClick={togglePlayPause}>
            {isPlaying ? '⏸️' : '▶️'}
          </button>
          <div className="time-display">
            {formatTime(currentTime)} / {formatTime(duration)}
          </div>
        </div>
      </div>
    )
  }

  return null
}

