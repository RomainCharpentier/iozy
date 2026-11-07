/**
 * Tests de la plage du timer par question
 */
import { GameService, TIMING } from '@/services/gameService'

describe('TIMING', () => {
  it('timer par défaut de 20 s, entre 10 et 60 s par pas de 5', () => {
    expect(TIMING.DEFAULT_TIME_LIMIT).toBe(20)
    expect(TIMING.MIN_TIME_LIMIT).toBe(10)
    expect(TIMING.MAX_TIME_LIMIT).toBe(60)
    expect(TIMING.TIME_LIMIT_STEP).toBe(5)
    expect((TIMING.DEFAULT_TIME_LIMIT - TIMING.MIN_TIME_LIMIT) % TIMING.TIME_LIMIT_STEP).toBe(0)
    expect((TIMING.MAX_TIME_LIMIT - TIMING.MIN_TIME_LIMIT) % TIMING.TIME_LIMIT_STEP).toBe(0)
  })
})

describe('GameService.validateTimeLimit', () => {
  it('valeur absente ou invalide → défaut', () => {
    for (const value of [undefined, null, 0, -3, NaN]) {
      expect(GameService.validateTimeLimit(value)).toBe(TIMING.DEFAULT_TIME_LIMIT)
    }
  })

  it('borne les valeurs hors plage (ex. ancien défaut de 5 s)', () => {
    expect(GameService.validateTimeLimit(5)).toBe(TIMING.MIN_TIME_LIMIT)
    expect(GameService.validateTimeLimit(120)).toBe(TIMING.MAX_TIME_LIMIT)
    expect(GameService.validateTimeLimit(25)).toBe(25)
  })
})
