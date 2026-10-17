import { useCallback, useState } from 'react'
import { settingsService } from '@/services/settingsService'

/**
 * Son des extraits (YouTube, audio, vidéo) coupé ou non, localement.
 * Le choix est mémorisé dans les réglages (settingsService) pour les parties suivantes.
 * N'affecte pas les effets sonores de l'interface (soundManager / soundEnabled).
 */
export function useMediaMuted(): [boolean, () => void] {
  const [muted, setMuted] = useState<boolean>(() => settingsService.getSetting('mediaMuted'))

  const toggleMuted = useCallback(() => {
    setMuted((prev) => {
      const next = !prev
      settingsService.updateSetting('mediaMuted', next)
      return next
    })
  }, [])

  return [muted, toggleMuted]
}
