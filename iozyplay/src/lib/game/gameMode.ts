import type { GameMode } from '@/lib/game/types'

export const isSolo = (mode: GameMode | undefined): mode is 'solo' => mode === 'solo'
export const isOnline = (mode: GameMode | undefined): mode is 'online' => mode === 'online'
