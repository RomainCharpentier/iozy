/**
 * Utilitaires pour gérer les URLs YouTube
 */

export function isYouTubeUrl(url: string): boolean {
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
