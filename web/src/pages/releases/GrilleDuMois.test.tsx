/**
 * <b>Le mois en grille.</b> Ce qui se casse en silence : une semaine qui ne
 * commence plus le lundi, aujourd'hui qui n'est plus marqué, un jour chargé
 * qu'on ne peut plus choisir - ou un jour vide qu'on peut.
 */
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { GrilleDuMois } from './GrilleDuMois'
import type { ReleaseEntryDto } from '@/common/types/api'

function sortie(label: string, coverImageUrl: string | null = null): ReleaseEntryDto {
  return {
    date: '2026-09-30',
    precision: 'DAY',
    entityId: 'naruto',
    entityTitle: 'Naruto',
    entityTypeId: 'manga',
    label,
    volumeNumber: null,
    editionName: 'Kana',
    coverImageUrl,
    relation: 'MISSING',
    source: 'GOOGLE_BOOKS',
  }
}

describe('GrilleDuMois', () => {
  it('range le mois en semaines, marque aujourd’hui, et ne rend cliquables que les jours qui ont une sortie', async () => {
    const onChoisir = vi.fn()
    render(
      <GrilleDuMois
        mois="2026-09"
        parJour={new Map([['2026-09-30', [sortie('Tome 72', 'https://img/72.jpg'), sortie('Tome 73'), sortie('Tome 74')]]])}
        jourChoisi={null}
        onChoisir={onChoisir}
        aujourdHui="2026-09-10"
      />,
    )

    expect(screen.getByRole('table', { name: 'Grille de septembre 2026' })).toBeInTheDocument()
    expect(screen.getAllByRole('columnheader').map((th) => th.textContent)).toEqual(['lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.', 'dim.'])
    // L'en-tête, puis cinq semaines : du lundi 31 août au dimanche 4 octobre.
    expect(screen.getAllByRole('row')).toHaveLength(6)
    expect(screen.getByText('10').closest('[aria-current="date"]')).not.toBeNull()

    // Un seul jour a quelque chose : un seul bouton, qui dit combien et montre deux jaquettes puis « +1 ».
    expect(screen.getAllByRole('button')).toHaveLength(1)
    const jour = screen.getByRole('button', { name: 'mercredi 30 septembre, 3 sorties' })
    expect(within(jour).getByRole('presentation', { hidden: true })).toHaveAttribute('src', 'https://img/72.jpg')
    expect(within(jour).getByText('+1')).toBeInTheDocument()
    expect(jour).toHaveAttribute('aria-pressed', 'false')

    await userEvent.click(jour)
    expect(onChoisir).toHaveBeenCalledWith('2026-09-30')
  })

  it('un jour choisi se voit, et se relâche d’un second clic', async () => {
    const onChoisir = vi.fn()
    render(
      <GrilleDuMois
        mois="2026-09"
        parJour={new Map([['2026-09-30', [sortie('Tome 72')]]])}
        jourChoisi="2026-09-30"
        onChoisir={onChoisir}
        aujourdHui="2026-09-10"
      />,
    )

    const jour = screen.getByRole('button', { name: 'mercredi 30 septembre, 1 sortie' })
    expect(jour).toHaveAttribute('aria-pressed', 'true')

    await userEvent.click(jour)
    expect(onChoisir).toHaveBeenCalledWith(null)
  })
})
