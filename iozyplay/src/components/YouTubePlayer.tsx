import { useState, useRef, useEffect } from 'react'
import { extractYouTubeId, getYouTubeEmbedUrl } from '../utils/youtube'

interface YouTubePlayerProps {
  mediaUrl: string
  autoPlay?: boolean
  showVideo?: boolean
  restartVideo?: boolean
  onVideoRestarted?: () => void
  timeLimit?: number // Durée du timer pour faire boucler la vidéo si nécessaire
}

export default function YouTubePlayer({ 
  mediaUrl, 
  autoPlay = false, 
  showVideo: externalShowVideo = false,
  restartVideo = false,
  onVideoRestarted,
  timeLimit
}: YouTubePlayerProps) {
  const [videoId, setVideoId] = useState<string | null>(null)
  const [showVideo, setShowVideo] = useState(externalShowVideo)
  const [isPlaying, setIsPlaying] = useState(false)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const hasRestartedRef = useRef<boolean>(false)
  const restartKeyRef = useRef<number>(0) // Clé pour forcer le rechargement de l'iframe

  useEffect(() => {
    const id = extractYouTubeId(mediaUrl)
    setVideoId(id)
    hasRestartedRef.current = false
    restartKeyRef.current = 0
  }, [mediaUrl])

  useEffect(() => {
    // Synchroniser showVideo avec la prop externe
    setShowVideo(externalShowVideo)
  }, [externalShowVideo])

  // Gérer le restart de la vidéo
  useEffect(() => {
    if (restartVideo && videoId && !hasRestartedRef.current) {
      hasRestartedRef.current = true
      
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
    <div className="youtube-player" style={{ minHeight: '400px', position: 'relative', width: '100%' }}>
      {/* Container pour la vidéo - toujours présent et chargé, juste caché visuellement */}
      <div 
        className="youtube-video-container" 
        style={{ 
          position: showVideo ? 'relative' : 'absolute',
          left: showVideo ? 'auto' : '-9999px',
          width: '100%',
          height: '400px',
          minHeight: '400px',
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
              height: '400px',
              border: 'none',
              display: 'block'
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
                    } catch (error) {
                      console.error('Erreur lors du démarrage de la vidéo:', error)
                    }
                  }
                }, 500)
              } else if (showVideo && restartVideo) {
                // En mode reveal, la vidéo démarre automatiquement via autoplay dans l'URL
                setIsPlaying(true)
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
        <div className="youtube-audio-mode">
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
          <div className="youtube-audio-info">
            <p className="audio-mode-label">🎵 Mode audio uniquement</p>
            <p className="audio-mode-hint">La vidéo YouTube est chargée en arrière-plan</p>
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
