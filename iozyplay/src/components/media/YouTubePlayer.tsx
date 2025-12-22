import { useState, useRef, useEffect } from 'react'
import { extractYouTubeId, getYouTubeEmbedUrl } from '../../utils/youtube'

interface YouTubePlayerProps {
  mediaUrl: string
  autoPlay?: boolean
  showVideo?: boolean
  restartVideo?: boolean
  onVideoRestarted?: () => void
  timeLimit?: number // Durée du timer pour faire boucler la vidéo si nécessaire
  shouldPause?: boolean
  onMediaReady?: () => void
}

export default function YouTubePlayer({ 
  mediaUrl, 
  autoPlay = false, 
  showVideo: externalShowVideo = false,
  restartVideo = false,
  onVideoRestarted,
  timeLimit,
  shouldPause = false,
  onMediaReady
}: YouTubePlayerProps) {
  const [videoId, setVideoId] = useState<string | null>(null)
  const [showVideo, setShowVideo] = useState(externalShowVideo)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const hasRestartedRef = useRef<boolean>(false)
  const restartKeyRef = useRef<number>(0) // Clé pour forcer le rechargement de l'iframe

  useEffect(() => {
    const id = extractYouTubeId(mediaUrl)
    setVideoId(id)
    hasRestartedRef.current = false
    restartKeyRef.current = 0
    setIsLoading(true)
  }, [mediaUrl])

  useEffect(() => {
    // Synchroniser showVideo avec la prop externe
    setShowVideo(externalShowVideo)
  }, [externalShowVideo])

  // Gérer le restart de la vidéo
  useEffect(() => {
    if (restartVideo && videoId && !hasRestartedRef.current) {
      hasRestartedRef.current = true
      setIsLoading(true)
      
      // Forcer le rechargement de l'iframe avec une nouvelle URL (sans loop)
      restartKeyRef.current += 1
      
      // Afficher la vidéo après un court délai pour laisser l'iframe se charger
      setTimeout(() => {
        setShowVideo(true)
      }, 100)
    } else if (!restartVideo && !externalShowVideo) {
      // Reset quand restartVideo redevient false ET qu'on n'est plus en mode reveal
      hasRestartedRef.current = false
      setShowVideo(false)
    }
  }, [restartVideo, videoId, externalShowVideo])

  useEffect(() => {
    if (shouldPause && iframeRef.current?.contentWindow) {
      try {
        iframeRef.current.contentWindow.postMessage(
          JSON.stringify({ event: 'command', func: 'pauseVideo', args: '' }),
          'https://www.youtube.com'
        )
        setIsPlaying(false)
      } catch (error) {
        console.error('Erreur lors de la mise en pause de la vidéo YouTube:', error)
      }
    }
  }, [shouldPause])

  useEffect(() => {
    if (shouldPause && iframeRef.current) {
      iframeRef.current.contentWindow?.postMessage(
        JSON.stringify({ event: 'command', func: 'pauseVideo', args: '' }),
        'https://www.youtube.com'
      )
    }
  }, [shouldPause])

  if (!videoId) {
    return (
      <div className="youtube-error">
        <p>URL YouTube invalide</p>
      </div>
    )
  }

  // URL différente selon si on est en mode reveal (showVideo) ou en mode audio
  const embedUrl = showVideo 
    ? getYouTubeEmbedUrl(videoId, true, false, false) // Pas de loop en mode reveal
    : getYouTubeEmbedUrl(videoId, true, false, true)  // Loop en mode audio

  return (
    <div className="youtube-player" style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', margin: 0, padding: 0 }}>
      {isLoading && (
        <div className="media-loading" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', margin: 0, padding: 0 }}>
          <div className="loading-spinner" style={{ margin: '0 0 16px 0', display: 'block' }}></div>
          <p style={{ margin: 0, textAlign: 'center' }}>Chargement de la vidéo YouTube...</p>
        </div>
      )}
      {/* Container pour la vidéo - toujours présent et chargé, juste caché visuellement */}
      <div 
        className="youtube-video-container" 
        style={{ 
          position: showVideo ? 'relative' : 'absolute',
          left: showVideo ? 'auto' : '-9999px',
          width: '100%',
          flex: showVideo ? '1 1 auto' : '0 0 auto',
          minHeight: showVideo ? '0' : '400px',
          overflow: 'hidden',
          opacity: showVideo ? 1 : 0,
          visibility: showVideo ? 'visible' : 'hidden',
          transition: 'opacity 0.3s ease-in-out',
          zIndex: showVideo ? 10 : -1,
          pointerEvents: showVideo ? 'auto' : 'none'
        }}
      >
        {videoId && (
          <iframe
            key={`${videoId}-${restartKeyRef.current}`}
            ref={iframeRef}
            src={embedUrl}
            className="youtube-iframe"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen={false}
            style={{
              width: '100%',
              height: '100%',
              border: 'none',
              display: 'block',
              position: 'absolute',
              top: 0,
              left: 0
            }}
            onLoad={() => {
              // Auto-play seulement en mode audio initial
              if (!showVideo && !restartVideo) {
                setTimeout(() => {
                  if (iframeRef.current?.contentWindow) {
                    try {
                      iframeRef.current.contentWindow.postMessage(
                        JSON.stringify({ event: 'command', func: 'playVideo', args: '' }),
                        'https://www.youtube.com'
                      )
                      setIsPlaying(true)
                      setIsLoading(false)
                      // Signaler que le média est prêt après le démarrage de la vidéo
                      if (onMediaReady) {
                        setTimeout(() => {
                          onMediaReady()
                        }, 300)
                      }
                    } catch (error) {
                      console.error('Erreur lors du démarrage de la vidéo:', error)
                    }
                  }
                }, 500)
              } else if (showVideo && restartVideo) {
                // En mode reveal, la vidéo démarre automatiquement via autoplay dans l'URL
                // Attendre un peu pour que la vidéo démarre réellement
                setTimeout(() => {
                  setIsPlaying(true)
                  setIsLoading(false)
                }, 500)
              }
            }}
            onError={(e) => {
              console.error('Erreur lors du chargement de l\'iframe YouTube:', e)
            }}
          />
        )}
      </div>

      {/* Mode audio uniquement */}
      {!showVideo && (
        <div className="youtube-audio-mode" style={{ flex: '1 1 auto', display: 'grid', gridTemplateRows: '1fr auto', minHeight: '300px', position: 'relative' }}>
          <div className="audio-visualizer-wrapper" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', margin: 0, padding: 0, position: 'relative', minHeight: 0 }}>
            <div className="audio-visualizer" style={{ width: '100%', maxWidth: '600px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', margin: '0 auto' }}>
              <div className="audio-waves" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', height: '120px', width: '100%', margin: '0 auto', position: 'relative' }}>
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
          <div className="youtube-audio-info" style={{ textAlign: 'center' }}>
            <p className="audio-mode-label" style={{ fontSize: 'var(--font-size-lg)', fontWeight: 600, marginBottom: 'var(--spacing-xs)', color: 'var(--text-primary)' }}>🎵 Mode audio uniquement</p>
            <p className="audio-mode-hint" style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)' }}>La vidéo YouTube est chargée en arrière-plan</p>
          </div>
        </div>
      )}
    </div>
  )
}

// Déclaration pour TypeScript
declare global {
  interface Window {
    YT: any
  }
}
