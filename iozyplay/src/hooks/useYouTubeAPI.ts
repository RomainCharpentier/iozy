import { useEffect, useRef, useState } from 'react'

// Types pour l'API YouTube IFrame Player
declare global {
  interface Window {
    YT: {
      Player: new (elementId: string, config: YT.PlayerOptions) => YT.Player
      PlayerState: {
        UNSTARTED: -1
        ENDED: 0
        PLAYING: 1
        PAUSED: 2
        BUFFERING: 3
        CUED: 5
      }
      ready: (callback: () => void) => void
    }
    onYouTubeIframeAPIReady: () => void
  }
}

interface UseYouTubeAPIReturn {
  isReady: boolean
  YT: typeof window.YT | null
  error: Error | null
}

// Gestion globale du callback YouTube API
let apiReadyCallbacks: Set<() => void> = new Set()
let scriptLoading = false
let scriptLoaded = false

/**
 * Hook pour charger l'API YouTube IFrame Player
 * @returns {UseYouTubeAPIReturn} État de chargement de l'API
 */
export function useYouTubeAPI(): UseYouTubeAPIReturn {
  const [isReady, setIsReady] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const callbackRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    // Si l'API est déjà chargée
    if (window.YT && window.YT.Player) {
      setIsReady(true)
      return
    }

    // Créer un callback unique pour ce hook
    const callback = () => {
      if (window.YT && window.YT.Player) {
        setIsReady(true)
      }
    }
    callbackRef.current = callback

    // Si le script est déjà chargé, on attend juste le callback
    if (scriptLoaded) {
      apiReadyCallbacks.add(callback)
      return
    }

    // Si le script est en cours de chargement, ajouter le callback
    if (scriptLoading) {
      apiReadyCallbacks.add(callback)
      return
    }

    // Charger le script de l'API YouTube
    scriptLoading = true
    const script = document.createElement('script')
    script.src = 'https://www.youtube.com/iframe_api'
    script.async = true
    script.defer = true

    script.onerror = () => {
      setError(new Error('Failed to load YouTube IFrame API'))
      scriptLoading = false
    }

    // Callback global quand l'API est prête
    window.onYouTubeIframeAPIReady = () => {
      scriptLoaded = true
      scriptLoading = false
      // Appeler tous les callbacks enregistrés
      apiReadyCallbacks.forEach(cb => cb())
      apiReadyCallbacks.clear()
    }

    apiReadyCallbacks.add(callback)
    document.head.appendChild(script)

    return () => {
      // Retirer le callback quand le composant est démonté
      if (callbackRef.current) {
        apiReadyCallbacks.delete(callbackRef.current)
      }
    }
  }, [])

  return {
    isReady,
    YT: window.YT || null,
    error
  }
}

