import { useEffect, useRef, useState } from 'react'
import Soundwave from '../Soundwave'

interface VideoPlayerProps {
  mediaUrl: string
  autoPlay?: boolean
  showVideo?: boolean
  shouldPause?: boolean
  restartVideo?: boolean
  onVideoRestarted?: () => void
  onMediaReady?: () => void
  onMediaStart?: () => void
}

export default function VideoPlayer({
  mediaUrl,
  autoPlay = false,
  showVideo = false,
  shouldPause = false,
  restartVideo = false,
  onVideoRestarted,
  onMediaReady,
  onMediaStart
}: VideoPlayerProps) {
  const audioVideoRef = useRef<HTMLVideoElement>(null) // Vidéo pour l'audio (toujours présente, invisible)
  const displayVideoRef = useRef<HTMLVideoElement>(null) // Vidéo pour l'affichage (visible seulement en reveal)
  const hasStartedRef = useRef(false)
  const [isPlaying, setIsPlaying] = useState(false)

  // Gérer les événements de la vidéo audio
  useEffect(() => {
    const video = audioVideoRef.current
    if (!video) return

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

    video.addEventListener('canplay', handleCanPlay)
    video.addEventListener('play', handlePlay)
    video.addEventListener('pause', handlePause)
    video.addEventListener('ended', handleEnded)

    return () => {
      video.removeEventListener('canplay', handleCanPlay)
      video.removeEventListener('play', handlePlay)
      video.removeEventListener('pause', handlePause)
      video.removeEventListener('ended', handleEnded)
    }
  }, [onMediaReady, onMediaStart])

  // Gérer play/pause de la vidéo audio
  useEffect(() => {
    const audioVideo = audioVideoRef.current
    if (!audioVideo) return

    if (shouldPause) {
      audioVideo.pause()
    } else if (autoPlay) {
      audioVideo.play().catch((error) => {
        console.error('Error playing audio video:', error)
      })
    }
  }, [shouldPause, autoPlay])

  // Gérer restartVideo pour la vidéo audio
  useEffect(() => {
    const audioVideo = audioVideoRef.current
    if (!audioVideo || !restartVideo) return

    if (!showVideo) {
      audioVideo.currentTime = 0
      audioVideo.play().catch((error) => {
        console.error('Error restarting audio video:', error)
      })
      if (onVideoRestarted) {
        onVideoRestarted()
      }
    }
  }, [restartVideo, showVideo, onVideoRestarted])

  // Quand on passe en phase reveal, relancer la vidéo d'affichage depuis le début
  useEffect(() => {
    const displayVideo = displayVideoRef.current
    if (!displayVideo) return

    if (showVideo) {
      // En phase reveal, relancer la vidéo d'affichage depuis le début
      displayVideo.currentTime = 0
      displayVideo.play().catch((error) => {
        console.error('Error playing display video in reveal:', error)
      })
    } else {
      // En phase guess, s'assurer que la vidéo d'affichage est en pause
      displayVideo.pause()
    }
  }, [showVideo])

  useEffect(() => {
    // Réinitialiser hasStarted quand le média change
    hasStartedRef.current = false
  }, [mediaUrl])

  // Pendant la phase de devinette (showVideo = false), cacher la vidéo mais jouer l'audio et afficher les soundwaves
  // Pendant la phase de révélation (showVideo = true), montrer la vidéo
  return (
    <div className="video-player" style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative', gap: '20px' }}>
      {!showVideo && (
        // Phase de devinette : afficher seulement les soundwaves
        <Soundwave isPlaying={isPlaying && !shouldPause} />
      )}
      {/* Vidéo d'affichage - visible seulement en phase reveal */}
      {showVideo && (
        <div style={{ 
          width: '100%', 
          height: '100%', 
          display: 'flex',
          alignItems: 'center', 
          justifyContent: 'center'
        }}>
          <video
            ref={displayVideoRef}
            src={mediaUrl}
            controls={true}
            style={{ 
              width: '100%',
              height: '100%',
              maxHeight: '500px',
              objectFit: 'contain',
              borderRadius: '0.5rem'
            }}
            preload="auto"
          />
        </div>
      )}
      {/* Vidéo audio - toujours présente mais invisible */}
      <video
        ref={audioVideoRef}
        src={mediaUrl}
        controls={false}
        style={{ 
          position: 'absolute',
          left: '-9999px',
          top: '-9999px',
          width: '1px',
          height: '1px',
          opacity: 0,
          pointerEvents: 'none'
        }}
        preload="auto"
      />
    </div>
  )
}
