/**
 * Utilitaires pour gérer les URLs YouTube
 */

/**
 * Vérifie si une chaîne est un format URL valide
 * @param url La chaîne à vérifier
 * @returns true si c'est un format URL valide
 */
export function isValidUrlFormat(url: string): boolean {
  if (!url || url.trim() === '') {
    return false
  }
  
  try {
    // Essayer de créer un objet URL pour valider le format
    // On accepte les URLs avec ou sans protocole
    const urlWithProtocol = url.startsWith('http://') || url.startsWith('https://') 
      ? url 
      : `https://${url}`
    new URL(urlWithProtocol)
    return true
  } catch {
    return false
  }
}

export function isYouTubeUrl(url: string): boolean {
  // D'abord vérifier que c'est un format URL valide
  if (!isValidUrlFormat(url)) {
    return false
  }
  
  const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+/
  return youtubeRegex.test(url)
}

export function extractYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    /youtube\.com\/watch\?.*v=([^&\n?#]+)/
  ]
  
  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match && match[1]) {
      return match[1]
    }
  }
  
  return null
}

export function getYouTubeEmbedUrl(videoId: string, autoplay: boolean = false, showControls: boolean = false, loop: boolean = false): string {
  const params: Record<string, string> = {
    enablejsapi: '1',
    origin: window.location.origin,
    autoplay: autoplay ? '1' : '0',
    controls: showControls ? '1' : '0',
    rel: '0',
    modestbranding: '1',
    disablekb: '1', // Désactiver le clavier
    fs: '0', // Désactiver le plein écran
    iv_load_policy: '3', // Masquer les annotations
    playsinline: '1'
  }
  
  // Ajouter loop et playlist seulement si loop est activé
  if (loop) {
    params.loop = '1'
    params.playlist = videoId // Nécessaire pour que loop fonctionne
  }
  
  const urlParams = new URLSearchParams(params)
  return `https://www.youtube.com/embed/${videoId}?${urlParams.toString()}`
}

/**
 * Génère l'URL de la miniature YouTube
 * @param videoId L'ID de la vidéo YouTube
 * @returns L'URL de la miniature (format mqdefault = 320x180)
 */
export function getYouTubeThumbnailUrl(videoId: string): string {
  return `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`
}

/**
 * Génère l'URL de la miniature YouTube depuis une URL YouTube
 * @param url L'URL YouTube complète
 * @returns L'URL de la miniature ou null si l'URL n'est pas valide
 */
export function getYouTubeThumbnailFromUrl(url: string): string | null {
  const videoId = extractYouTubeId(url)
  if (!videoId) return null
  return getYouTubeThumbnailUrl(videoId)
}

/**
 * Interface pour les métadonnées YouTube
 */
export interface YouTubeMetadata {
  title: string
  thumbnailUrl: string
  videoId: string
}

/**
 * Récupère les métadonnées d'une vidéo YouTube via l'API oEmbed
 * Utilise un cache pour éviter les appels répétés
 * @param url L'URL YouTube
 * @param useCache Si true, utilise le cache (défaut: true)
 * @returns Les métadonnées ou null si l'URL n'est pas valide
 */
export async function getYouTubeMetadata(url: string, useCache: boolean = true): Promise<YouTubeMetadata | null> {
  if (!isYouTubeUrl(url)) {
    return null
  }

  const videoId = extractYouTubeId(url)
  if (!videoId) {
    return null
  }

  // Vérifier le cache d'abord
  if (useCache) {
    const { getCachedMetadata, setCachedMetadata } = await import('./youtubeCache')
    const cached = getCachedMetadata(url)
    if (cached) {
      return cached
    }
  }

  try {
    // Utiliser l'API oEmbed de YouTube (gratuite, pas besoin de clé API)
    const oEmbedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`
    const response = await fetch(oEmbedUrl)
    
    // Si la réponse n'est pas OK (404 = vidéo n'existe pas, etc.)
    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('VIDEO_NOT_FOUND')
      }
      throw new Error(`HTTP ${response.status}: Failed to fetch YouTube metadata`)
    }

    const data = await response.json()
    
    // Vérifier que les données sont valides
    if (!data || !data.title) {
      throw new Error('Invalid metadata response')
    }
    
    const metadata: YouTubeMetadata = {
      title: data.title || '',
      thumbnailUrl: getYouTubeThumbnailUrl(videoId),
      videoId: videoId
    }

    // Mettre en cache
    if (useCache) {
      const { setCachedMetadata } = await import('./youtubeCache')
      setCachedMetadata(url, metadata)
    }
    
    return metadata
  } catch (error) {
    console.error('Error fetching YouTube metadata:', error)
    // Retourner null pour indiquer que la vidéo n'existe pas ou qu'il y a eu une erreur
    return null
  }
}
