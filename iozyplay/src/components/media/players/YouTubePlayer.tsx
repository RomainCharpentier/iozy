import { useEffect, useRef, useState } from 'react'
import { extractYouTubeId, getYouTubeEmbedUrl } from '../../../utils/youtube'
import Soundwave from '../Soundwave'

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
  onMediaStart
}: YouTubePlayerProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const hasStartedRef = useRef(false)
  const [isPlaying, setIsPlaying] = useState(false)

  useEffect(() => {
    // Simuler onMediaReady après un court délai (l'iframe se charge)
    const timer = setTimeout(() => {
      if (onMediaReady) {
        onMediaReady()
      }
    }, 500)

    return () => clearTimeout(timer)
  }, [mediaUrl, onMediaReady])

  useEffect(() => {
    // Simuler onMediaStart si autoplay est activé
    if (autoPlay && !shouldPause && !hasStartedRef.current) {
      setIsPlaying(true)
      const timer = setTimeout(() => {
        hasStartedRef.current = true
        if (onMediaStart) {
          onMediaStart()
        }
      }, 1000)
      return () => clearTimeout(timer)
    } else if (shouldPause) {
      setIsPlaying(false)
    }
  }, [autoPlay, shouldPause, onMediaStart])

  useEffect(() => {
    if (restartVideo && onVideoRestarted) {
      // Pour redémarrer, on recharge l'iframe
      const iframe = iframeRef.current
      if (iframe) {
        const videoId = extractYouTubeId(mediaUrl)
        if (videoId) {
          const embedUrl = getYouTubeEmbedUrl(videoId, true, showVideo, false)
          iframe.src = embedUrl
          hasStartedRef.current = false
          if (onVideoRestarted) {
            onVideoRestarted()
          }
        }
      }
    }
  }, [restartVideo, mediaUrl, showVideo, onVideoRestarted])

  const videoId = extractYouTubeId(mediaUrl)
  if (!videoId) {
    return <div>URL YouTube invalide</div>
  }

  // Pendant la phase de devinette (showVideo = false), cacher la vidéo mais jouer l'audio et afficher les soundwaves
  // Pendant la phase de révélation (showVideo = true), montrer la vidéo
  const embedUrl = getYouTubeEmbedUrl(videoId, autoPlay && !shouldPause, showVideo, false)

  return (
    <div className="youtube-player" style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative', gap: '20px' }}>
      {!showVideo && (
        // Phase de devinette : afficher seulement les soundwaves
        <Soundwave isPlaying={isPlaying && !shouldPause} />
      )}
      {/* Iframe unique qui change de style selon la phase */}
      {showVideo ? (
        // Phase de révélation : afficher l'iframe YouTube normalement
        <div style={{ 
          width: '100%', 
          height: '100%', 
          position: 'relative'
        }}>
          <iframe
            ref={iframeRef}
            src={embedUrl}
            style={{
              width: '100%',
              height: '100%',
              border: 'none',
              borderRadius: '0.5rem'
            }}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      ) : (
        // Phase de devinette : iframe invisible mais présente pour l'audio
        <iframe
          ref={iframeRef}
          src={embedUrl}
          style={{
            position: 'absolute',
            left: '-9999px',
            width: '1px',
            height: '1px',
            opacity: 0,
            pointerEvents: 'none',
            border: 'none'
          }}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      )}
    </div>
  )
}

