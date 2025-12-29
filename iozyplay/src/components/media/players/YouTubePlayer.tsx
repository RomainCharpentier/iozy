import { useEffect, useRef, useState } from 'react'
import { extractYouTubeId } from '../../../utils/youtube'
import Soundwave from '../Soundwave'
import { useYouTubeAPI } from '../../../hooks/useYouTubeAPI'

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
  startTime
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
        origin: window.location.origin
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
        onStateChange: (event: YT.OnStateChangeEvent) => {
          const player = event.target
          const state = event.data

          if (state === YT.PlayerState.PLAYING) {
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
          } else if (state === YT.PlayerState.PAUSED) {
            setIsPlaying(false)
          } else if (state === YT.PlayerState.ENDED) {
            setIsPlaying(false)
            hasStartedRef.current = false
          }
        },
        onError: (event: YT.OnErrorEvent) => {
          console.error('YouTube Player Error:', event.data)
        }
      }
    }

    try {
      const player = new YT.Player(playerIdRef.current, playerConfig)
      playerRef.current = player
    } catch (err) {
      console.error('Error creating YouTube player:', err)
    }

    // Cleanup
    return () => {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
              const playResult = playerRef.current.playVideo()
              // playVideo() peut retourner une Promise ou undefined selon l'API
              if (playResult && typeof playResult.catch === 'function') {
                playResult.catch((error: any) => {
                  console.error('Error playing video in reveal phase:', error)
                })
              }
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
        const playResult = playerRef.current.playVideo()
        if (playResult && typeof playResult.catch === 'function') {
          playResult.catch((error: any) => {
            console.error('Error playing video:', error)
          })
        }
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
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div>Chargement de l'API YouTube...</div>
      </div>
    )
  }

  return (
    <div className="youtube-player" style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative', gap: '20px' }}>
      {!showVideo && (
        // Phase de devinette : afficher seulement les soundwaves
        <Soundwave isPlaying={isPlaying && !shouldPause} />
      )}
      {/* Container pour le player YouTube - toujours présent pour l'audio, masqué visuellement si showVideo est false */}
      <div 
        ref={containerRef}
        style={{ 
          width: '100%',
          height: '100%',
          position: showVideo ? 'relative' : 'absolute',
          left: showVideo ? 'auto' : '-9999px',
          top: showVideo ? 'auto' : '-9999px',
          opacity: showVideo ? 1 : 0,
          visibility: showVideo ? 'visible' : 'hidden',
          pointerEvents: showVideo ? 'auto' : 'none',
          transition: 'opacity 0.5s ease-out, transform 0.5s ease-out',
          transform: showVideo ? 'scale(1)' : 'scale(0.96)'
        }}
      >
        <div id={playerIdRef.current} style={{ width: '100%', height: '100%' }} />
      </div>
    </div>
  )
}

