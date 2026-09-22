import { describe, expect, it } from 'vitest'
import { libelleExperienceType, libelleSectionExperiences } from './experiences'

describe('libelleExperienceType', () => {
  it('traduit les codes livrés par le catalogue', () => {
    expect(libelleExperienceType('READ')).toBe('Lu')
    expect(libelleExperienceType('PLAYED')).toBe('Joué')
    expect(libelleExperienceType('FINISHED')).toBe('Terminé')
    expect(libelleExperienceType('IN_PROGRESS')).toBe('En cours')
    expect(libelleExperienceType('ABANDONED')).toBe('Abandonné')
  })

  it('rend un code inconnu tel quel plutôt que de deviner', () => {
    expect(libelleExperienceType('COLLECTED')).toBe('COLLECTED')
  })
})

describe('libelleSectionExperiences', () => {
  it('parle de lectures pour ce qui se lit, de parties pour ce qui se joue', () => {
    expect(libelleSectionExperiences(['IN_PROGRESS', 'READ', 'ABANDONED'])).toBe('Lectures')
    expect(libelleSectionExperiences(['PLAYED'])).toBe('Parties')
    expect(libelleSectionExperiences(['IN_PROGRESS', 'FINISHED', 'ABANDONED'])).toBe('Parties')
  })

  it('reste neutre quand le type ne dit pas ce qu\'on en fait', () => {
    expect(libelleSectionExperiences([])).toBe('Expériences')
    expect(libelleSectionExperiences(['COLLECTED'])).toBe('Expériences')
  })
})
