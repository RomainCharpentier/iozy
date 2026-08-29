/**
 * <b>Le panneau de filtres, et le tag qu'on pouvait poser sans jamais s'en
 * servir.</b>
 *
 * <p>Les tags se créaient et s'attachaient depuis une fiche, et aucun écran ne
 * les relisait ensuite. Ce panneau est l'endroit où ce classement redevient
 * utile - trois règles s'y cassent en silence, parce qu'à chaque fois le
 * panneau <b>s'affiche quand même</b> :
 * <ul>
 *   <li>la section « Tag » apparaît alors qu'aucun tag n'existe : un filtre qui
 *       ne peut rien retenir, qui laisse croire qu'il manque quelque chose ;</li>
 *   <li>« Tous » ne revient pas à l'absence de filtre : plus aucun moyen de
 *       revoir toute la collection sans recharger ;</li>
 *   <li>« Réinitialiser » n'écoute que l'état de la collection : un tag seul
 *       actif, et le bouton reste invisible.</li>
 * </ul>
 */
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { CollectionFilters } from './CollectionFilters'
import { tag } from '../../test/fixtures'

const LU = tag('Lu')
const A_RELIRE = tag('À relire')

function panneau(props: Partial<Parameters<typeof CollectionFilters>[0]> = {}) {
  const onTagChange = vi.fn()
  const onStatusChange = vi.fn()
  const onReset = vi.fn()
  render(
    <CollectionFilters
      open
      onClose={vi.fn()}
      status="ALL"
      onStatusChange={onStatusChange}
      tags={[LU, A_RELIRE]}
      tagId={null}
      onTagChange={onTagChange}
      onReset={onReset}
      {...props}
    />,
  )
  return { onTagChange, onStatusChange, onReset }
}

describe('la section Tag', () => {
  it('liste les tags existants, précédés de « Tous »', () => {
    panneau()

    const groupe = screen.getByRole('radiogroup', { name: 'Tag' })
    expect(groupe).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Tous' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Lu' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'À relire' })).toBeInTheDocument()
  })

  it("n'apparaît pas tant qu'aucun tag n'existe", () => {
    panneau({ tags: [] })

    expect(screen.queryByRole('radiogroup', { name: 'Tag' })).not.toBeInTheDocument()
    // Le filtre d'état, lui, est toujours là : c'est bien la section Tag qui
    // s'efface, pas le panneau.
    expect(screen.getByRole('radiogroup', { name: 'État de la collection' })).toBeInTheDocument()
  })

  it('remonte le tag choisi', async () => {
    const { onTagChange } = panneau()

    await userEvent.click(screen.getByRole('radio', { name: 'Lu' }))

    expect(onTagChange).toHaveBeenCalledWith(LU.id)
  })

  it('« Tous » remonte l’absence de filtre, pas un identifiant', async () => {
    const { onTagChange } = panneau({ tagId: LU.id })

    await userEvent.click(screen.getByRole('radio', { name: 'Tous' }))

    expect(onTagChange).toHaveBeenCalledWith(null)
  })

  it('marque le tag actif, et lui seul', () => {
    panneau({ tagId: LU.id })

    expect(screen.getByRole('radio', { name: 'Lu' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('radio', { name: 'À relire' })).toHaveAttribute('aria-checked', 'false')
    expect(screen.getByRole('radio', { name: 'Tous' })).toHaveAttribute('aria-checked', 'false')
  })
})

describe('« Réinitialiser »', () => {
  it('reste absent quand rien ne filtre', () => {
    panneau()

    expect(screen.queryByRole('button', { name: 'Réinitialiser' })).not.toBeInTheDocument()
  })

  it('apparaît pour un tag seul, sans filtre d’état', async () => {
    const { onReset } = panneau({ tagId: LU.id })

    await userEvent.click(screen.getByRole('button', { name: 'Réinitialiser' }))

    expect(onReset).toHaveBeenCalled()
  })

  it('apparaît pour un filtre d’état seul, sans tag', () => {
    panneau({ status: 'INCOMPLETE' })

    expect(screen.getByRole('button', { name: 'Réinitialiser' })).toBeInTheDocument()
  })
})
