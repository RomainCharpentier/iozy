import { useEffect, useState } from 'react'
import type { Category } from '@/types'
import { connectSocket } from '@/utils/socket'

/**
 * Thèmes actuels du salon, pour pré-remplir la popup « Changer les thèmes ».
 *
 * Les props ne suffisent pas en ligne : elles ne sont pas mises à jour après une relance
 * avec d'autres thèmes, et un invité devenu hôte n'en a pas. On suit donc
 * `room:state.settings.categories` (diffusé par le serveur), avec repli sur les props.
 */
export function useRoomCategories(roomCode: string | null | undefined, fallback: Category[]) {
  const [roomCategories, setRoomCategories] = useState<Category[] | null>(null)

  useEffect(() => {
    if (!roomCode) return
    // Idempotent : réutilise le singleton déjà créé par Game
    const socket = connectSocket()
    const handleRoomState = (state: { settings?: { categories?: unknown } }) => {
      const categories = state?.settings?.categories
      if (
        Array.isArray(categories) &&
        categories.length > 0 &&
        categories.every((c) => typeof c === 'string')
      ) {
        setRoomCategories(categories as Category[])
      }
    }
    socket.on('room:state', handleRoomState)
    return () => {
      socket.off('room:state', handleRoomState)
    }
  }, [roomCode])

  return roomCategories ?? fallback
}
