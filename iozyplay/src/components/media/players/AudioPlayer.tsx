import styles from '@/components/media/MediaPlayer.module.scss'
import { useEffect, useRef, useState } from 'react'
import Soundwave from '@/components/media/Soundwave'
import { seekToStart } from '@/components/media/players/mediaStart'
import { normalizeStartTime } from '@/utils/timecode'

interface AudioPlayerProps {
  mediaUrl: string
  autoPlay?: boolean
  shouldPause?: boolean
  onMediaReady?: () => void
  onMediaStart?: () => void
  startSeconds?: number // Point de départ de l'extrait (secondes)
  startFraction?: number // Départ aléatoire de la partie (voir pickPlayableStart)
  mediaDuration?: number // Durée connue (éditeur), prioritaire sur celle lue par le lecteur
  timeLimit?: number // Durée du chrono : le départ est avancé si l'extrait serait trop court
  muted?: boolean // Son coupé localement
}

export default function AudioPlayer({
  mediaUrl,
  autoPlay = false,
  shouldPause = false,
  onMediaReady,
  onMediaStart,
  startSeconds = 0,
  startFraction,
  mediaDuration,
  timeLimit,
  muted = false,
}: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const hasStartedRef = useRef(false)
  const [isPlaying, setIsPlaying] = useState(false)

  // Callbacks et point de départ lus via des refs : les écouteurs ne sont branchés qu'une fois
  const callbacksRef = useRef({ onMediaReady, onMediaStart })
  callbacksRef.current = { onMediaReady, onMediaStart }
  const startAtRef = useRef(normalizeStartTime(startSeconds))
  startAtRef.current = normalizeStartTime(startSeconds)
  const timeLimitRef = useRef(timeLimit)
  timeLimitRef.current = timeLimit
  const startFractionRef = useRef(startFraction)
  startFractionRef.current = startFraction
  const mediaDurationRef = useRef(mediaDuration)
  mediaDurationRef.current = mediaDuration

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

    const onMediaReady = () => callbacksRef.current.onMediaReady?.()

    // Pré-positionnement au point de départ dès les métadonnées connues,
    // pour que le buffering se fasse avant game:ready
    const handleLoadedMetadata = () => {
      if (!hasStartedRef.current)
        seekToStart(
          audio,
          startAtRef.current,
          timeLimitRef.current,
          startFractionRef.current,
          mediaDurationRef.current
        )
    }

    const handleCanPlay = () => {
      cleanup()
      onMediaReady()
    }

    const handlePlay = () => {
      setIsPlaying(true)
      if (!hasStartedRef.current) {
        hasStartedRef.current = true
        callbacksRef.current.onMediaStart?.()
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

    audio.addEventListener('loadedmetadata', handleLoadedMetadata)
    audio.addEventListener('canplay', handleCanPlay)
    audio.addEventListener('play', handlePlay)
    audio.addEventListener('pause', handlePause)
    audio.addEventListener('ended', handleEnded)
    audio.addEventListener('error', handleError)

    // Métadonnées déjà chargées avant le branchement des écouteurs
    handleLoadedMetadata()

    // Timeout de 30 secondes pour le chargement
    timeoutId = window.setTimeout(() => {
      cleanup()
      onMediaReady()
    }, 30000)

    return () => {
      cleanup()
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata)
      audio.removeEventListener('canplay', handleCanPlay)
      audio.removeEventListener('play', handlePlay)
      audio.removeEventListener('pause', handlePause)
      audio.removeEventListener('ended', handleEnded)
      audio.removeEventListener('error', handleError)
    }
  }, [])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    if (shouldPause) {
      audio.pause()
    } else if (autoPlay) {
      // Premier démarrage : partir du point de départ ; ensuite, reprendre où on en était
      if (!hasStartedRef.current)
        seekToStart(
          audio,
          startAtRef.current,
          timeLimitRef.current,
          startFractionRef.current,
          mediaDurationRef.current
        )
      audio.play().catch((error) => {
        console.error('Error playing audio:', error)
      })
    }
  }, [shouldPause, autoPlay])

  // Son coupé localement : propriété DOM (l'attribut seul n'est lu qu'au montage)
  useEffect(() => {
    if (audioRef.current) audioRef.current.muted = muted
  }, [muted])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    // Réinitialiser hasStarted quand le média change
    hasStartedRef.current = false
  }, [mediaUrl])

  return (
    <div
      className={styles.audioPlayer}
      style={{
        width: '100%',
        height: 'auto',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '1.5rem',
        padding: '1.5rem',
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'visible',
        }}
      >
        <Soundwave isPlaying={isPlaying && !shouldPause} />
      </div>
      <audio
        ref={audioRef}
        src={mediaUrl}
        // Extrait plus court que le chrono : lecture en boucle depuis le début
        loop
        controls
        style={{ width: '100%', maxWidth: '500px', flexShrink: 0 }}
        preload="auto"
      />
    </div>
  )
}
