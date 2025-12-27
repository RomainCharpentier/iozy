import { useEffect, useRef, useState } from 'react'
import Soundwave from '../Soundwave'
import { soundManager } from '../../../utils/sounds'

interface VideoPlayerProps {
  mediaUrl: string
  autoPlay?: boolean
  showVideo?: boolean
  shouldPause?: boolean
  restartVideo?: boolean
  onVideoRestarted?: () => void
  onMediaReady?: () => void
  onMediaStart?: () => void
  onRevealVideoStart?: () => void // Callback appelé quand la vidéo display démarre en phase reveal
  startTime?: number // Timestamp serveur pour synchroniser le démarrage (phase guess si showVideo=false, phase reveal si showVideo=true)
  timeLimit?: number // Durée en secondes pour limiter la vidéo en phase reveal
}

export default function VideoPlayer({
  mediaUrl,
  autoPlay = false,
  showVideo = false,
  shouldPause = false,
  restartVideo = false,
  onVideoRestarted,
  onMediaReady,
  onMediaStart,
  onRevealVideoStart,
  startTime,
  timeLimit
}: VideoPlayerProps) {
  const audioVideoRef = useRef<HTMLVideoElement>(null) // Vidéo pour l'audio (toujours présente, invisible)
  const displayVideoRef = useRef<HTMLVideoElement>(null) // Vidéo pour l'affichage (visible seulement en reveal)
  const hasStartedRef = useRef(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const revealStartedRef = useRef(false) // Flag pour éviter de redémarrer la vidéo plusieurs fois en phase reveal
  const previousShowVideoRef = useRef<boolean>(false) // Pour détecter le changement de showVideo
  const revealVideoStartCalledRef = useRef(false) // Flag pour éviter d'appeler onRevealVideoStart plusieurs fois

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

  // Gérer play/pause de la vidéo audio avec synchronisation précise
  useEffect(() => {
    const audioVideo = audioVideoRef.current
    if (!audioVideo) return

    if (shouldPause) {
      audioVideo.pause()
    } else if (autoPlay) {
      // Démarrer immédiatement (pas de synchronisation complexe)
      audioVideo.currentTime = 0
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

  // Détecter la transition guess -> reveal et jouer le son
  useEffect(() => {
    // Détecter le changement de showVideo de false à true
    if (showVideo && !previousShowVideoRef.current) {
      // Transition vers la phase reveal - jouer le son
      soundManager.playReveal()
    }
    
    previousShowVideoRef.current = showVideo
  }, [showVideo])

  useEffect(() => {
    const displayVideo = displayVideoRef.current
    if (!displayVideo) return

    if (!showVideo) {
      if (!displayVideo.paused) {
        displayVideo.pause()
      }
      return
    }

    if (!revealStartedRef.current) {
      revealStartedRef.current = true
      displayVideo.currentTime = 0
      displayVideo.play().catch((error) => {
        console.error('Error playing display video in reveal:', error)
      })
    }
  }, [showVideo])

  useEffect(() => {
    const displayVideo = displayVideoRef.current
    if (!displayVideo) return

    const handlePlay = () => {
      if (showVideo && onRevealVideoStart && !revealVideoStartCalledRef.current) {
        revealVideoStartCalledRef.current = true
        onRevealVideoStart()
      }
    }

    displayVideo.addEventListener('play', handlePlay)
    return () => {
      displayVideo.removeEventListener('play', handlePlay)
    }
  }, [showVideo, onRevealVideoStart])

  useEffect(() => {
    hasStartedRef.current = false
    revealStartedRef.current = false
    previousShowVideoRef.current = false
    revealVideoStartCalledRef.current = false
  }, [mediaUrl])

  // Pendant la phase de devinette (showVideo = false), cacher la vidéo mais jouer l'audio et afficher les soundwaves
  // Pendant la phase de révélation (showVideo = true), montrer la vidéo
  return (
    <div className="video-player" style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative', gap: '20px' }}>
      {!showVideo && (
        // Phase de devinette : afficher seulement les soundwaves
        <Soundwave isPlaying={isPlaying && !shouldPause} />
      )}
      {/* Vidéo d'affichage - toujours présente pour préchargement, visible seulement en phase reveal */}
      <div style={{ 
        width: '100%', 
        height: '100%', 
        display: 'flex',
        alignItems: 'center', 
        justifyContent: 'center',
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        opacity: showVideo ? 1 : 0,
        pointerEvents: showVideo ? 'auto' : 'none',
        transition: 'opacity 0.5s ease-in-out',
        zIndex: showVideo ? 10 : 0
      }}>
        <video
          ref={displayVideoRef}
          src={mediaUrl}
          controls={showVideo}
          muted={!showVideo}
          style={{ 
            width: '100%',
            height: '100%',
            maxHeight: '500px',
            objectFit: 'contain',
            borderRadius: '0.5rem',
            transform: showVideo ? 'scale(1)' : 'scale(0.95)',
            transition: 'transform 0.5s ease-in-out'
          }}
          preload="auto"
        />
      </div>
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
