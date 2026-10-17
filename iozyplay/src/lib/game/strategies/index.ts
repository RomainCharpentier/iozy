import type { GameMode } from '@/lib/game/types'
import { isSolo } from '@/lib/game/gameMode'
import type { GameModeStrategy } from '@/lib/game/strategies/GameModeStrategy'
import { SoloGameStrategy } from '@/lib/game/strategies/SoloGameStrategy'
import type { SoloGameStrategyDeps } from '@/lib/game/strategies/SoloGameStrategy'
import { OnlineGameStrategy } from '@/lib/game/strategies/OnlineGameStrategy'
import type { OnlineGameStrategyDeps } from '@/lib/game/strategies/OnlineGameStrategy'

export type { GameModeStrategy, ValidateAnswersContext } from '@/lib/game/strategies/GameModeStrategy'
export { SoloGameStrategy } from '@/lib/game/strategies/SoloGameStrategy'
export { OnlineGameStrategy } from '@/lib/game/strategies/OnlineGameStrategy'

export type GameModeStrategyDeps = SoloGameStrategyDeps | OnlineGameStrategyDeps

export function getGameModeStrategy(
  mode: GameMode,
  deps: GameModeStrategyDeps
): GameModeStrategy {
  return isSolo(mode)
    ? new SoloGameStrategy(deps as SoloGameStrategyDeps)
    : new OnlineGameStrategy(deps as OnlineGameStrategyDeps)
}
