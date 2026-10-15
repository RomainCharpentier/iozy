import styles from '@/components/media/MediaPlayer.module.scss'
import { useEffect, useRef, useState } from 'react'
import { extractYouTubeId } from '@/utils/youtube'
import { normalizeStartTime } from '@/utils/timecode'
import { forceGenericIframeTitle, guardIframeTitle } from '@/utils/iframeTitle'
import Soundwave from '@/components/media/Soundwave'
import { useYouTubeAPI } from '@/hooks/useYouTubeAPI'

// États du lecteur YouTube (YT.PlayerState)
const YT_STATE = {
  UNSTARTED: -1,
  ENDED: 0,
  PLAYING: 1,
  PAUSED: 2,
  BUFFERING: 3,
  CUED: 5,
} as const

interface YouTubePlayerProps {
  mediaUrl: string
  autoPlay?: boolean
  showVideo?: boolean
  restartVideo?: boolean
  onVideoRestarted?: () => void
  timeLimit?: number
  shouldPause?: boolean
  onMediaReady?: () => void
  onMediaStart?: () => void
  onRevealVideoStart?: () => void // Callback appelé quand la vidéo display démarre en phase reveal
  startTime?: number // Timestamp serveur pour synchroniser le démarrage
  startSeconds?: number // Point de départ de l'extrait dans la vidéo (secondes)
  muted?: boolean // Son coupé localement
}

export default function YouTubePlayer({
  mediaUrl,
  autoPlay = false,
  showVideo = false,
  restartVideo = false,
  onVideoRestarted,
  shouldPause = false,
  onMediaReady,
  onMediaStart,
  onRevealVideoStart,
  startSeconds = 0,
  muted = false,
}: YouTubePlayerProps) {
  const { isReady, YT, error } = useYouTubeAPI()
  const playerRef = useRef<YT.Player | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const playerIdRef = useRef(`youtube-player-${Math.random().toString(36).substr(2, 9)}`)
  const hasStartedRef = useRef(false)
  const revealVideoStartCalledRef = useRef(false) // Flag pour éviter d'appeler onRevealVideoStart plusieurs fois
  const previousShowVideoRef = useRef(false) // Pour détecter le changement de showVideo
  const [isPlaying, setIsPlaying] = useState(false)
  const [isPlayerReady, setIsPlayerReady] = useState(false)
  const videoId = extractYouTubeId(mediaUrl)
  const startAt = normalizeStartTime(startSeconds)

  // Les événements du YT.Player sont branchés une seule fois, à sa création :
  // ils lisent les props via des refs pour ne jamais travailler sur des valeurs figées
  const showVideoRef = useRef(showVideo)
  showVideoRef.current = showVideo
  const startAtRef = useRef(startAt)
  startAtRef.current = startAt
  const mutedRef = useRef(muted)
  mutedRef.current = muted
  const callbacksRef = useRef({ onMediaReady, onMediaStart, onRevealVideoStart })
  callbacksRef.current = { onMediaReady, onMediaStart, onRevealVideoStart }

  // Signale le début de la vidéo en phase reveal (une seule fois par reveal)
  const notifyRevealVideoStart = () => {
    if (revealVideoStartCalledRef.current) return
    revealVideoStartCalledRef.current = true
    callbacksRef.current.onRevealVideoStart?.()
  }

  // Initialiser le player quand l'API est prête
  useEffect(() => {
    if (!isReady || !YT || !videoId) {
      return
    }

    // Si le player existe déjà, ne pas le recréer
    if (playerRef.current) {
      return
    }

    // Attendre que le container soit monté
    if (!containerRef.current) {
      return
    }

    let timeoutId: number | null = null

    const cleanup = () => {
      if (timeoutId) {
        clearTimeout(timeoutId)
        timeoutId = null
      }
    }

    // Anti-triche : titre générique sur l'iframe dès sa création (l'API y écrit le titre de la vidéo)
    const stopTitleGuard = guardIframeTitle(containerRef.current)

    // Créer le player avec l'API YouTube
    const initialStart = startAtRef.current
    const playerConfig: YT.PlayerOptions = {
      videoId: videoId,
      width: '100%',
      height: '100%',
      playerVars: {
        autoplay: autoPlay && !shouldPause ? 1 : 0,
        controls: showVideo ? 1 : 0,
        rel: 0, // Ne pas afficher de vidéos suggérées
        modestbranding: 1, // Logo YouTube minimal
        disablekb: 1, // Désactiver le clavier
        fs: 0, // Désactiver le plein écran
        iv_load_policy: 3, // Masquer les annotations
        playsinline: 1, // Lecture inline sur mobile
        // Paramètres pour minimiser les publicités (ne les bloque pas complètement)
        cc_load_policy: 0, // Pas de sous-titres par défaut
        origin: window.location.origin,
        // Point de départ de l'extrait : la vidéo est chargée directement à cette position
        ...(initialStart > 0 ? { start: initialStart } : {}),
      },
      events: {
        onReady: (event: YT.PlayerEvent) => {
          const player = event.target
          playerRef.current = player
          forceGenericIframeTitle(player.getIframe())
          if (mutedRef.current) player.mute()
          setIsPlayerReady(true)
          callbacksRef.current.onMediaReady?.()
        },
        onError: (event: YT.OnErrorEvent) => {
          console.error('YouTube Player Error:', event.data)
          // Même en cas d'erreur, signaler que le média est "prêt" pour ne pas bloquer
          callbacksRef.current.onMediaReady?.()
        },
        onStateChange: (event: YT.OnStateChangeEvent) => {
          const state = event.data
          // L'API peut réécrire le titre de l'iframe à chaque changement d'état
          forceGenericIframeTitle(event.target.getIframe?.())

          if (state === YT_STATE.PLAYING) {
            setIsPlaying(true)
            if (!hasStartedRef.current) {
              hasStartedRef.current = true
              // Le chrono de devinette démarre au premier PLAYING, jamais pendant le reveal
              if (!showVideoRef.current) {
                callbacksRef.current.onMediaStart?.()
              }
            }
            // Phase reveal : la vidéo (re)joue
            if (showVideoRef.current) {
              notifyRevealVideoStart()
            }
          } else if (state === YT_STATE.PAUSED || state === YT_STATE.ENDED) {
            // hasStartedRef n'est pas réinitialisé à la fin : onMediaStart ne doit partir
            // qu'une fois par question (sinon le chrono de devinette redémarrerait)
            setIsPlaying(false)
          }
        },
      },
    }

    // Timeout de 30 secondes pour le chargement
    timeoutId = window.setTimeout(() => {
      cleanup()
      callbacksRef.current.onMediaReady?.()
    }, 30000)

    try {
      const player = new YT.Player(playerIdRef.current, playerConfig)
      playerRef.current = player
      forceGenericIframeTitle(containerRef.current?.querySelector('iframe'))
    } catch (err) {
      console.error('Error creating YouTube player:', err)
      cleanup()
      callbacksRef.current.onMediaReady?.()
    }

    // Cleanup
    return () => {
      cleanup()
      stopTitleGuard()
      if (playerRef.current) {
        try {
          playerRef.current.destroy()
        } catch (err) {
          console.error('Error destroying YouTube player:', err)
        }
        playerRef.current = null
        setIsPlayerReady(false)
      }
    }
  }, [isReady, YT, videoId]) // Ne recréer que si l'API est prête ou si la vidéo change

  // Passage en phase reveal : la vidéo devient visible et CONTINUE là où le son en était
  // (pas de seekTo : la position de lecture est conservée, le player n'est pas recréé)
  useEffect(() => {
    if (!isPlayerReady || !playerRef.current) {
      return
    }

    // Détecter le passage de false à true (transition vers reveal)
    if (showVideo && !previousShowVideoRef.current) {
      // Réinitialiser le flag pour permettre l'appel de onRevealVideoStart
      revealVideoStartCalledRef.current = false

      try {
        const state = playerRef.current.getPlayerState()
        if (state === YT_STATE.PLAYING) {
          // Déjà en lecture : aucun événement PLAYING ne suivra, signaler le début du reveal ici
          notifyRevealVideoStart()
        } else if (
          !shouldPause &&
          (state === YT_STATE.PAUSED || state === YT_STATE.CUED || state === YT_STATE.UNSTARTED)
        ) {
          // Reprendre la lecture à la position courante (onRevealVideoStart partira au PLAYING)
          playerRef.current.playVideo()
        }
      } catch (error) {
        console.error('Error resuming video in reveal phase:', error)
      }
    }

    // Si on sort de la phase reveal, réinitialiser le flag
    if (!showVideo && previousShowVideoRef.current) {
      revealVideoStartCalledRef.current = false
    }

    previousShowVideoRef.current = showVideo
  }, [showVideo, isPlayerReady])

  // Gérer le pause/play
  useEffect(() => {
    if (!isPlayerReady || !playerRef.current) {
      return
    }

    try {
      if (shouldPause) {
        playerRef.current.pauseVideo()
      } else if (autoPlay && !hasStartedRef.current) {
        // Premier démarrage (game:go) : s'assurer d'être au point de départ de l'extrait
        const start = startAtRef.current
        if (start > 0 && Math.abs(playerRef.current.getCurrentTime() - start) > 1) {
          playerRef.current.seekTo(start, true)
        }
        playerRef.current.playVideo()
      } else if (autoPlay && playerRef.current.getPlayerState() === YT_STATE.PAUSED) {
        // Reprise après une pause (ex. popup de paramètres) : continuer à la position courante
        playerRef.current.playVideo()
      }
    } catch (error) {
      console.error('Error playing video:', error)
    }
  }, [shouldPause, autoPlay, isPlayerReady])

  // Couper / rétablir le son localement (sans toucher à la lecture)
  useEffect(() => {
    if (!isPlayerReady || !playerRef.current) return
    try {
      if (muted) {
        playerRef.current.mute()
      } else if (playerRef.current.isMuted?.()) {
        playerRef.current.unMute()
      }
    } catch (error) {
      console.error('Error toggling YouTube mute:', error)
    }
  }, [muted, isPlayerReady])

  // Gérer le redémarrage
  useEffect(() => {
    if (!isPlayerReady || !playerRef.current || !restartVideo) {
      return
    }

    if (videoId) {
      playerRef.current.loadVideoById(videoId, startAtRef.current)
      hasStartedRef.current = false
      revealVideoStartCalledRef.current = false // Réinitialiser aussi ce flag
      if (onVideoRestarted) {
        onVideoRestarted()
      }
    }
  }, [restartVideo, videoId, isPlayerReady, onVideoRestarted])

  // Gérer le changement de vidéo (seulement si le player est déjà initialisé)
  useEffect(() => {
    if (!isPlayerReady || !playerRef.current || !videoId) {
      return
    }

    // Ne charger la nouvelle vidéo que si elle est différente de celle actuellement chargée
    // On évite de recharger si c'est juste un changement de props
    const currentVideoId = playerRef.current.getVideoUrl()?.match(/[?&]v=([^&]+)/)?.[1]
    if (currentVideoId !== videoId) {
      playerRef.current.loadVideoById(videoId, startAtRef.current)
      hasStartedRef.current = false
      revealVideoStartCalledRef.current = false // Réinitialiser aussi ce flag
    }
  }, [videoId, isPlayerReady])

  if (!videoId) {
    return <div>URL YouTube invalide</div>
  }

  if (error) {
    return <div>Erreur de chargement de l'API YouTube: {error.message}</div>
  }

  if (!isReady) {
    return (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div>Chargement de l'API YouTube...</div>
      </div>
    )
  }

  return (
    <div
      className={styles.youtubePlayer}
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        gap: 0,
        flexShrink: 0,
        boxSizing: 'border-box',
      }}
    >
      {/* Player YouTube - toujours présent pour l'audio, visible seulement si showVideo est true */}
      <div
        ref={containerRef}
        // Pendant la devinette, le lecteur (et le document de l'iframe) est retiré de l'arbre
        // d'accessibilité : il n'y a rien à voir, et cela limite les fuites d'informations
        aria-hidden={showVideo ? undefined : true}
        style={{
          position: showVideo ? 'relative' : 'absolute',
          top: showVideo ? 'auto' : 0,
          left: showVideo ? 'auto' : 0,
          width: showVideo ? '100%' : '1px',
          height: showVideo ? '100%' : '1px',
          overflow: showVideo ? 'visible' : 'hidden',
          clip: showVideo ? 'auto' : 'rect(0, 0, 0, 0)',
          whiteSpace: showVideo ? 'normal' : 'nowrap',
          transition: showVideo ? 'opacity 0.5s ease-out, transform 0.5s ease-out' : 'none',
          transform: showVideo ? 'scale(1)' : 'none',
          flex: showVideo ? '1 1 auto' : 'none',
          minHeight: showVideo ? 0 : 'auto',
          minWidth: showVideo ? 0 : 'auto',
          zIndex: showVideo ? 1 : 0,
        }}
      >
        <div id={playerIdRef.current} style={{ width: '100%', height: '100%' }} />
      </div>
      {/* Soundwaves - affichées seulement si showVideo est false */}
      {!showVideo && (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxSizing: 'border-box',
            flex: '1 1 auto',
            minHeight: 0,
            minWidth: 0,
            position: 'relative',
            zIndex: 2,
          }}
        >
          <Soundwave isPlaying={isPlaying && !shouldPause} />
        </div>
      )}
    </div>
  )
}
