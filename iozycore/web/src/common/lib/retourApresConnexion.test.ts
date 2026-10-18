import { describe, expect, it } from 'vitest'
import { destinationApresConnexion } from './retourApresConnexion'

describe('destinationApresConnexion', () => {
  it('accepts a path of the site, with its query string', () => {
    expect(destinationApresConnexion('?next=%2Fplay%2F')).toBe('/play/')
    expect(destinationApresConnexion('?next=%2Fplay%2Froom%2Fjoin%3Froom%3DAB12')).toBe('/play/room/join?room=AB12')
  })

  it('refuses anything that could leave the site', () => {
    expect(destinationApresConnexion('?next=https%3A%2F%2Fevil.example')).toBeNull()
    expect(destinationApresConnexion('?next=%2F%2Fevil.example')).toBeNull()
    expect(destinationApresConnexion('?next=%2F%5Cevil.example')).toBeNull()
    expect(destinationApresConnexion('?next=javascript%3Aalert(1)')).toBeNull()
  })

  it('has nowhere to go without the parameter', () => {
    expect(destinationApresConnexion('')).toBeNull()
    expect(destinationApresConnexion('?next=')).toBeNull()
  })
})
