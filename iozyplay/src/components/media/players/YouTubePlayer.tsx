import { useEffect, useRef, useState } from 'react'
import { extractYouTubeId } from '@/utils/youtube'
import Soundwave from '@/components/media/Soundwave'
import { useYouTubeAPI } from '@/hooks/useYouTubeAPI'

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
}

export default function YouTubePlayer({
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

    // Créer le player avec l'API YouTube
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
      },
      events: {
        onReady: (event: YT.PlayerEvent) => {
          const player = event.target
          playerRef.current = player
          setIsPlayerReady(true)

          // Appeler onMediaReady
          if (onMediaReady) {
            onMediaReady()
          }
        },
        onError: (event: YT.OnErrorEvent) => {
          console.error('YouTube Player Error:', event.data)
          // Même en cas d'erreur, signaler que le média est "prêt" pour ne pas bloquer
          if (onMediaReady) {
            onMediaReady()
          }
        },
        onStateChange: (event: YT.OnStateChangeEvent) => {
          const state = event.data

          // YT.PlayerState.PLAYING = 1
          if (state === 1) {
            setIsPlaying(true)
            if (!hasStartedRef.current && onMediaStart) {
              hasStartedRef.current = true
              onMediaStart()
            }
            // Si on est en phase reveal et que la vidéo démarre, appeler onRevealVideoStart
            if (showVideo && onRevealVideoStart && !revealVideoStartCalledRef.current) {
              revealVideoStartCalledRef.current = true
              onRevealVideoStart()
            }
          } else if (state === 2) {
            // YT.PlayerState.PAUSED = 2
            setIsPlaying(false)
          } else if (state === 0) {
            // YT.PlayerState.ENDED = 0
            setIsPlaying(false)
            hasStartedRef.current = false
          }
        },
      },
    }

    // Timeout de 30 secondes pour le chargement
    timeoutId = window.setTimeout(() => {
      cleanup()
      if (onMediaReady) {
        onMediaReady()
      }
    }, 30000)

    try {
      const player = new YT.Player(playerIdRef.current, playerConfig)
      playerRef.current = player
    } catch (err) {
      console.error('Error creating YouTube player:', err)
      cleanup()
      if (onMediaReady) {
        onMediaReady()
      }
    }

    // Cleanup
    return () => {
      cleanup()
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

  // Gérer le changement de showVideo : relancer la vidéo à 0 quand on passe en phase reveal
  useEffect(() => {
    if (!isPlayerReady || !playerRef.current) {
      return
    }

    // Détecter le passage de false à true (transition vers reveal)
    if (showVideo && !previousShowVideoRef.current) {
      // Réinitialiser le flag pour permettre l'appel de onRevealVideoStart
      revealVideoStartCalledRef.current = false

      // Relancer la vidéo à 0 et forcer la lecture
      if (videoId) {
        // Petit délai pour s'assurer que le player est prêt
        setTimeout(() => {
          if (playerRef.current) {
            playerRef.current.seekTo(0, true)
            // Forcer la lecture
            try {
              playerRef.current.playVideo()
            } catch (error) {
              console.error('Error playing video in reveal phase:', error)
            }
          }
        }, 100)
      }
    }

    // Si on sort de la phase reveal, réinitialiser le flag
    if (!showVideo && previousShowVideoRef.current) {
      revealVideoStartCalledRef.current = false
    }

    previousShowVideoRef.current = showVideo
  }, [showVideo, isPlayerReady, videoId])

  // Gérer le pause/play
  useEffect(() => {
    if (!isPlayerReady || !playerRef.current) {
      return
    }

    if (shouldPause) {
      playerRef.current.pauseVideo()
    } else if (autoPlay && !hasStartedRef.current) {
      try {
        playerRef.current.playVideo()
      } catch (error) {
        console.error('Error playing video:', error)
      }
    }
  }, [shouldPause, autoPlay, isPlayerReady])

  // Gérer le redémarrage
  useEffect(() => {
    if (!isPlayerReady || !playerRef.current || !restartVideo) {
      return
    }

    if (videoId) {
      playerRef.current.loadVideoById(videoId, 0)
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
      playerRef.current.loadVideoById(videoId, 0)
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
      className="youtube-player"
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
