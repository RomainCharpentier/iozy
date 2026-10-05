/**
 * <b>The month as a grid.</b> What breaks silently: a week that no longer
 * starts on Monday, today that is no longer marked, a busy day
 * that can no longer be chosen - or an empty day that can.
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
  it('lays out the month in weeks, marks today, and only makes clickable the days that have a release', async () => {
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
    // The header, then five weeks: from Monday 31 August to Sunday 4 October.
    expect(screen.getAllByRole('row')).toHaveLength(6)
    expect(screen.getByText('10').closest('[aria-current="date"]')).not.toBeNull()

    // Only one day has something: one single button, which says how many and shows two covers then "+1".
    expect(screen.getAllByRole('button')).toHaveLength(1)
    const jour = screen.getByRole('button', { name: 'mercredi 30 septembre, 3 sorties' })
    expect(within(jour).getByRole('presentation', { hidden: true })).toHaveAttribute('src', 'https://img/72.jpg')
    expect(within(jour).getByText('+1')).toBeInTheDocument()
    expect(jour).toHaveAttribute('aria-pressed', 'false')

    await userEvent.click(jour)
    expect(onChoisir).toHaveBeenCalledWith('2026-09-30')
  })

  it('a chosen day is visible, and is released by a second click', async () => {
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
