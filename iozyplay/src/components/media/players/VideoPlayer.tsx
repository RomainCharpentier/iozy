import styles from '@/components/media/MediaPlayer.module.scss'
import { useEffect, useRef, useState } from 'react'
import Soundwave from '@/components/media/Soundwave'
import { seekToStart } from '@/components/media/players/mediaStart'
import { normalizeStartTime } from '@/utils/timecode'

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
  startSeconds?: number // Point de départ de l'extrait (secondes)
  muted?: boolean // Son coupé localement
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
  startSeconds = 0,
  muted = false,
}: VideoPlayerProps) {
  const audioVideoRef = useRef<HTMLVideoElement>(null) // Vidéo pour l'audio (toujours présente, invisible)
  const displayVideoRef = useRef<HTMLVideoElement>(null) // Vidéo pour l'affichage (visible seulement en reveal)
  const hasStartedRef = useRef(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const revealStartedRef = useRef(false) // Flag pour éviter de relancer la vidéo plusieurs fois en phase reveal
  const revealVideoStartCalledRef = useRef(false) // Flag pour éviter d'appeler onRevealVideoStart plusieurs fois

  // Callbacks, phase et point de départ lus via des refs : les écouteurs ne sont branchés qu'une fois
  const callbacksRef = useRef({ onMediaReady, onMediaStart, onRevealVideoStart })
  callbacksRef.current = { onMediaReady, onMediaStart, onRevealVideoStart }
  const showVideoRef = useRef(showVideo)
  showVideoRef.current = showVideo
  const startAtRef = useRef(normalizeStartTime(startSeconds))
  startAtRef.current = normalizeStartTime(startSeconds)

  // Gérer les événements de la vidéo audio
  useEffect(() => {
    const video = audioVideoRef.current
    const displayVideo = displayVideoRef.current
    if (!video) return

    let timeoutId: number | null = null

    const cleanup = () => {
      if (timeoutId) {
        clearTimeout(timeoutId)
        timeoutId = null
      }
    }

    const onMediaReady = () => callbacksRef.current.onMediaReady?.()

    // Pré-positionnement au point de départ dès les métadonnées connues,
    // pour que le buffering se fasse avant game:ready
    const handleLoadedMetadata = () => {
      if (!hasStartedRef.current) seekToStart(video, startAtRef.current)
    }
    const handleDisplayLoadedMetadata = () => {
      if (displayVideo && !revealStartedRef.current) seekToStart(displayVideo, startAtRef.current)
    }

    const handleCanPlay = () => {
      cleanup()
      onMediaReady()
    }

    const handlePlay = () => {
      setIsPlaying(true)
      if (!hasStartedRef.current) {
        hasStartedRef.current = true
        // Le chrono de devinette démarre au premier play, jamais pendant le reveal
        if (!showVideoRef.current) {
          callbacksRef.current.onMediaStart?.()
        }
      }
    }

    const handlePause = () => {
      setIsPlaying(false)
    }

    const handleEnded = () => {
      setIsPlaying(false)
    }

    const handleError = () => {
      cleanup()
      onMediaReady()
    }

    video.addEventListener('loadedmetadata', handleLoadedMetadata)
    video.addEventListener('canplay', handleCanPlay)
    video.addEventListener('play', handlePlay)
    video.addEventListener('pause', handlePause)
    video.addEventListener('ended', handleEnded)
    video.addEventListener('error', handleError)
    displayVideo?.addEventListener('loadedmetadata', handleDisplayLoadedMetadata)

    // Métadonnées déjà chargées avant le branchement des écouteurs
    handleLoadedMetadata()
    handleDisplayLoadedMetadata()

    // Timeout de 30 secondes pour le chargement
    timeoutId = window.setTimeout(() => {
      cleanup()
      onMediaReady()
    }, 30000)

    return () => {
      cleanup()
      video.removeEventListener('loadedmetadata', handleLoadedMetadata)
      video.removeEventListener('canplay', handleCanPlay)
      video.removeEventListener('play', handlePlay)
      video.removeEventListener('pause', handlePause)
      video.removeEventListener('ended', handleEnded)
      video.removeEventListener('error', handleError)
      displayVideo?.removeEventListener('loadedmetadata', handleDisplayLoadedMetadata)
    }
  }, [])

  // Gérer play/pause : la vidéo audio pendant la devinette, la vidéo d'affichage pendant le reveal
  useEffect(() => {
    const audioVideo = audioVideoRef.current
    const displayVideo = displayVideoRef.current
    if (!audioVideo) return

    if (shouldPause) {
      audioVideo.pause()
      displayVideo?.pause()
      return
    }

    if (!autoPlay) return

    if (showVideoRef.current && revealStartedRef.current) {
      // Reprise après une pause pendant le reveal : continuer à la position courante
      if (displayVideo?.paused && !displayVideo.ended) {
        displayVideo.play().catch((error) => {
          console.error('Error resuming display video:', error)
        })
      }
      return
    }

    if (!showVideoRef.current) {
      // Premier démarrage : partir du point de départ ; ensuite, reprendre où on en était
      if (!hasStartedRef.current) seekToStart(audioVideo, startAtRef.current)
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
      audioVideo.currentTime = startAtRef.current
      audioVideo.play().catch((error) => {
        console.error('Error restarting audio video:', error)
      })
      if (onVideoRestarted) {
        onVideoRestarted()
      }
    }
  }, [restartVideo, showVideo, onVideoRestarted])

  // Passage en phase reveal : la vidéo d'affichage prend le relais de la vidéo audio
  // à la même position (continuité), puis la vidéo audio est coupée (pas de double son)
  useEffect(() => {
    const displayVideo = displayVideoRef.current
    const audioVideo = audioVideoRef.current
    if (!displayVideo) return

    if (!showVideo) {
      if (!displayVideo.paused) {
        displayVideo.pause()
      }
      return
    }

    if (revealStartedRef.current) return
    revealStartedRef.current = true

    const position =
      audioVideo && hasStartedRef.current ? audioVideo.currentTime : startAtRef.current
    try {
      displayVideo.currentTime = position
    } catch (error) {
      console.error('Error seeking display video in reveal:', error)
    }

    if (shouldPause) {
      audioVideo?.pause()
      return
    }

    displayVideo
      .play()
      .then(() => {
        // Couper le son de la vidéo audio seulement une fois la vidéo d'affichage lancée
        if (showVideoRef.current) audioVideo?.pause()
      })
      .catch((error) => {
        // Échec (ex. autoplay bloqué) : la vidéo audio continue, le son n'est pas interrompu
        console.error('Error playing display video in reveal:', error)
      })
  }, [showVideo])

  useEffect(() => {
    const displayVideo = displayVideoRef.current
    if (!displayVideo) return

    const handlePlay = () => {
      if (showVideoRef.current && !revealVideoStartCalledRef.current) {
        revealVideoStartCalledRef.current = true
        callbacksRef.current.onRevealVideoStart?.()
      }
    }

    displayVideo.addEventListener('play', handlePlay)
    return () => {
      displayVideo.removeEventListener('play', handlePlay)
    }
  }, [])

  // Son coupé localement : propriété DOM (l'attribut seul n'est lu qu'au montage).
  // La vidéo d'affichage reste muette pendant la devinette (c'est la vidéo audio qui joue le son)
  useEffect(() => {
    if (audioVideoRef.current) audioVideoRef.current.muted = muted
    if (displayVideoRef.current) displayVideoRef.current.muted = muted || !showVideo
  }, [muted, showVideo])

  useEffect(() => {
    hasStartedRef.current = false
    revealStartedRef.current = false
    revealVideoStartCalledRef.current = false
  }, [mediaUrl])

  // Pendant la phase de devinette (showVideo = false), cacher la vidéo mais jouer l'audio et afficher les soundwaves
  // Pendant la phase de révélation (showVideo = true), montrer la vidéo
  return (
    <div
      className={styles.videoPlayer}
      style={{
        width: '100%',
        height: '100%',
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        gap: 0,
        boxSizing: 'border-box',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          opacity: showVideo ? 0 : 1,
          visibility: showVideo ? 'hidden' : 'visible',
          transition: 'opacity 0.4s ease-in-out, visibility 0s linear 0.4s',
          transitionDelay: showVideo ? '0.4s' : '0s',
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
          pointerEvents: showVideo ? 'none' : 'auto',
          zIndex: showVideo ? 0 : 5,
          willChange: 'opacity',
          padding: '0.5rem',
          boxSizing: 'border-box',
        }}
      >
        <Soundwave isPlaying={isPlaying && !shouldPause} />
      </div>
      {/* Vidéo d'affichage - toujours présente pour préchargement, visible seulement en phase reveal */}
      <div
        style={{
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
          visibility: showVideo ? 'visible' : 'hidden',
          pointerEvents: showVideo ? 'auto' : 'none',
          transition: showVideo
            ? 'opacity 0.6s ease-out, transform 0.6s ease-out, filter 0.6s ease-out, visibility 0s'
            : 'opacity 0.3s ease-in, transform 0.3s ease-in, filter 0.3s ease-in, visibility 0s linear 0.3s',
          zIndex: showVideo ? 10 : 0,
          transform: showVideo ? 'scale(1)' : 'scale(0.94)',
          filter: showVideo ? 'brightness(1) contrast(1)' : 'brightness(0.6) contrast(0.8)',
          willChange: showVideo ? 'opacity, transform, filter' : 'auto',
          padding: '0.5rem',
          boxSizing: 'border-box',
        }}
      >
        <video
          ref={displayVideoRef}
          src={mediaUrl}
          controls={showVideo}
          muted={muted || !showVideo}
          style={{
            width: '100%',
            height: '100%',
            maxHeight: '100%',
            maxWidth: '100%',
            objectFit: 'contain',
            borderRadius: '0.5rem',
            boxShadow: showVideo ? '0 8px 32px rgba(0, 0, 0, 0.3)' : 'none',
            transition: 'transform 0.6s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.6s ease-in-out',
            boxSizing: 'border-box',
          }}
          preload="auto"
        />
      </div>
      {/* Vidéo audio - toujours présente mais invisible */}
      <video
        ref={audioVideoRef}
        src={mediaUrl}
        controls={false}
        muted={muted}
        style={{
          position: 'absolute',
          left: '-9999px',
          top: '-9999px',
          width: '1px',
          height: '1px',
          opacity: 0,
          pointerEvents: 'none',
        }}
        preload="auto"
      />
    </div>
  )
}
