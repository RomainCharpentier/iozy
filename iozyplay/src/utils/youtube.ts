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
    const urlWithProtocol =
      url.startsWith('http://') || url.startsWith('https://') ? url : `https://${url}`
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
    /youtube\.com\/watch\?.*v=([^&\n?#]+)/,
  ]

  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match && match[1]) {
      return match[1]
    }
  }

  return null
}

/**
 * Convertit une valeur de paramètre temporel YouTube en secondes.
 * Formats acceptés : « 90 », « 90s », « 1m30s », « 1h2m3s ». Retourne null si invalide.
 */
function parseYouTubeTimeParam(raw: string): number | null {
  const value = raw.trim().toLowerCase()
  if (/^\d+$/.test(value)) return Number(value)
  const match = value.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/)
  if (!match || (!match[1] && !match[2] && !match[3])) return null
  return Number(match[1] ?? 0) * 3600 + Number(match[2] ?? 0) * 60 + Number(match[3] ?? 0)
}

/**
 * Extrait le point de départ (en secondes) d'une URL YouTube : paramètre `t=` ou `start=`
 * dans la query, ou `#t=` dans le fragment. Retourne null si absent ou invalide.
 */
export function extractYouTubeStartTime(url: string): number | null {
  if (!url || !isYouTubeUrl(url)) return null

  let parsed: URL
  try {
    parsed = new URL(
      url.startsWith('http://') || url.startsWith('https://') ? url : `https://${url}`
    )
  } catch {
    return null
  }

  const hashParams = new URLSearchParams(parsed.hash.replace(/^#/, ''))
  const raw =
    parsed.searchParams.get('t') ?? parsed.searchParams.get('start') ?? hashParams.get('t')
  if (raw === null) return null

  const seconds = parseYouTubeTimeParam(raw)
  return seconds !== null && Number.isSafeInteger(seconds) ? seconds : null
}

/**
 * Vérifie si une URL YouTube est une playlist
 */
export function isYouTubePlaylistUrl(url: string): boolean {
  if (!isYouTubeUrl(url)) {
    return false
  }
  return url.includes('playlist') || url.includes('list=')
}

/**
 * Extrait l'ID de playlist d'une URL YouTube
 */
export function extractPlaylistId(url: string): string | null {
  if (!isYouTubePlaylistUrl(url)) {
    return null
  }

  const patterns = [/[?&]list=([^&\n?#]+)/, /playlist\?list=([^&\n?#]+)/]

  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match && match[1]) {
      return match[1]
    }
  }

  return null
}

/**
 * Interface pour une vidéo de playlist
 */
export interface PlaylistVideo {
  videoId: string
  videoUrl: string
  title: string
  thumbnailUrl: string
}

/**
 * Récupère les vidéos d'une playlist YouTube via le backend
 */
export async function getPlaylistVideos(playlistUrl: string): Promise<PlaylistVideo[]> {
  const playlistId = extractPlaylistId(playlistUrl)
  if (!playlistId) {
    throw new Error('URL de playlist invalide')
  }

  try {
    // Utiliser l'endpoint backend pour récupérer les vidéos
    const API_BASE_URL =
      import.meta.env.VITE_SOCKET_URL ||
      import.meta.env.VITE_API_URL ||
      (import.meta.env.DEV ? 'http://localhost:3001' : '')
    const response = await fetch(
      `${API_BASE_URL}/api/youtube/playlist/${encodeURIComponent(playlistId)}`
    )

    if (!response.ok) {
      const error = await response
        .json()
        .catch(() => ({ error: 'Erreur lors de la récupération de la playlist' }))
      throw new Error(error.error || 'Erreur lors de la récupération de la playlist')
    }

    const data = await response.json()

    if (!Array.isArray(data.videos)) {
      throw new Error('Format de réponse invalide')
    }

    return data.videos.map((video: any) => ({
      videoId: video.videoId,
      videoUrl: `https://www.youtube.com/watch?v=${video.videoId}`,
      title: video.title || 'Sans titre',
      thumbnailUrl: getYouTubeThumbnailUrl(video.videoId),
    }))
  } catch (error) {
    console.error('Error fetching playlist videos:', error)
    throw error
  }
}

export function getYouTubeEmbedUrl(
  videoId: string,
  autoplay: boolean = false,
  showControls: boolean = false,
  loop: boolean = false
): string {
  // Note: YouTube ne permet pas de désactiver les publicités via les paramètres d'embed
  // Les publicités dépendent de la monétisation de la vidéo et sont gérées par YouTube
  // Les bloqueurs de publicités (uBlock, AdBlock, etc.) peuvent bloquer les pubs côté client
  const params: Record<string, string> = {
    enablejsapi: '1',
    origin: window.location.origin,
    autoplay: autoplay ? '1' : '0',
    controls: showControls ? '1' : '0',
    rel: '0', // Ne pas afficher de vidéos suggérées à la fin
    modestbranding: '1', // Logo YouTube minimal
    disablekb: '1', // Désactiver le clavier
    fs: '0', // Désactiver le plein écran
    iv_load_policy: '3', // Masquer les annotations
    playsinline: '1', // Lecture inline sur mobile
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
export async function getYouTubeMetadata(
  url: string,
  useCache: boolean = true
): Promise<YouTubeMetadata | null> {
  if (!isYouTubeUrl(url)) {
    return null
  }

  const videoId = extractYouTubeId(url)
  if (!videoId) {
    return null
  }

  // Vérifier le cache d'abord
  if (useCache) {
    const { getCachedMetadata } = await import('./youtubeCache')
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
      videoId: videoId,
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
