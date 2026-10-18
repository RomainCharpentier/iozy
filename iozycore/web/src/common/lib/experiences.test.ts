import { describe, expect, it } from 'vitest'
import { libelleExperienceType, libelleSectionExperiences } from './experiences'

describe('libelleExperienceType', () => {
  it('translates the codes shipped by the catalog', () => {
    expect(libelleExperienceType('READ')).toBe('Lu')
    expect(libelleExperienceType('PLAYED')).toBe('Joué')
    expect(libelleExperienceType('FINISHED')).toBe('Terminé')
    expect(libelleExperienceType('IN_PROGRESS')).toBe('En cours')
    expect(libelleExperienceType('ABANDONED')).toBe('Abandonné')
  })

  it('returns an unknown code as it is rather than guessing', () => {
    expect(libelleExperienceType('COLLECTED')).toBe('COLLECTED')
  })
})

describe('libelleSectionExperiences', () => {
  it('speaks of readings for what is read, of games for what is played', () => {
    expect(libelleSectionExperiences(['IN_PROGRESS', 'READ', 'ABANDONED'])).toBe('Lectures')
    expect(libelleSectionExperiences(['PLAYED'])).toBe('Parties')
    expect(libelleSectionExperiences(['IN_PROGRESS', 'FINISHED', 'ABANDONED'])).toBe('Parties')
  })

  it('stays neutral when the type does not say what is done with it', () => {
    expect(libelleSectionExperiences([])).toBe('Expériences')
    expect(libelleSectionExperiences(['COLLECTED'])).toBe('Expériences')
  })
})
