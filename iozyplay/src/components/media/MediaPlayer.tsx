import { useEffect } from 'react'
import type { MediaType } from '@/types'
import { isYouTubeUrl } from '@/utils/youtube'
import YouTubePlayer from './players/YouTubePlayer'
import AudioPlayer from './players/AudioPlayer'
import VideoPlayer from './players/VideoPlayer'

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
  onMediaStart?: () => void // Appelé quand le média commence vraiment à jouer
  onRevealVideoStart?: () => void // Callback appelé quand la vidéo display démarre en phase reveal
  startTime?: number // Timestamp serveur pour synchroniser le démarrage
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
  onMediaReady,
  onMediaStart,
  onRevealVideoStart,
  startTime,
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
        onMediaStart={onMediaStart}
        onRevealVideoStart={onRevealVideoStart}
        startTime={startTime}
      />
    )
  }

  if (type === 'image') {
    // Pour les images, appeler onMediaReady dès que l'image est chargée
    useEffect(() => {
      if (onMediaReady) {
        // Pour les images, considérer qu'elles sont prêtes immédiatement
        // car elles chargent très rapidement
        const img = new Image()
        let timeoutId: number | null = null

        const cleanup = () => {
          if (timeoutId) {
            clearTimeout(timeoutId)
            timeoutId = null
          }
        }

        img.onload = () => {
          cleanup()
          if (onMediaReady) {
            onMediaReady()
          }
        }
        img.onerror = () => {
          cleanup()
          // Même en cas d'erreur, signaler que le média est "prêt" pour ne pas bloquer
          if (onMediaReady) {
            onMediaReady()
          }
        }

        // Timeout de 30 secondes pour le chargement
        timeoutId = window.setTimeout(() => {
          cleanup()
          if (onMediaReady) {
            onMediaReady()
          }
        }, 30000)

        img.src = mediaUrl

        return cleanup
      }
    }, [mediaUrl, onMediaReady])

    return (
      <div
        className="media-player image-player"
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <img
          src={mediaUrl}
          alt="Blindtest"
          className="blindtest-image"
          style={{
            maxWidth: '100%',
            maxHeight: '100%',
            objectFit: 'contain',
            borderRadius: '0.5rem',
          }}
        />
      </div>
    )
  }

  if (type === 'audio') {
    return (
      <AudioPlayer
        mediaUrl={mediaUrl}
        autoPlay={autoPlay}
        shouldPause={shouldPause}
        onMediaReady={onMediaReady}
        onMediaStart={onMediaStart}
      />
    )
  }

  if (type === 'video') {
    return (
      <VideoPlayer
        mediaUrl={mediaUrl}
        autoPlay={autoPlay}
        showVideo={showVideo}
        shouldPause={shouldPause}
        restartVideo={restartVideo}
        onVideoRestarted={onVideoRestarted}
        onMediaReady={onMediaReady}
        onMediaStart={onMediaStart}
        onRevealVideoStart={onRevealVideoStart}
        startTime={startTime}
        timeLimit={timeLimit}
      />
    )
  }

  return null
}
