/**
 * Cache pour les métadonnées YouTube
 */
import type { YouTubeMetadata } from './youtube'

interface CacheEntry {
  metadata: YouTubeMetadata
  timestamp: number
}

const CACHE_DURATION = 24 * 60 * 60 * 1000 // 24 heures
const cache = new Map<string, CacheEntry>()

/**
 * Récupère les métadonnées depuis le cache si disponibles et valides
 */
export function getCachedMetadata(url: string): YouTubeMetadata | null {
  const entry = cache.get(url)
  if (!entry) return null
  
  const now = Date.now()
  if (now - entry.timestamp > CACHE_DURATION) {
    cache.delete(url)
    return null
  }
  
  return entry.metadata
}

/**
 * Met en cache les métadonnées YouTube
 */
export function setCachedMetadata(url: string, metadata: YouTubeMetadata): void {
  cache.set(url, {
    metadata,
    timestamp: Date.now()
  })
}

/**
 * Vide le cache
 */
export function clearCache(): void {
  cache.clear()
}












