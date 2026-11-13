import type { ReactNode } from 'react'

/**
 * The template of a destination (lot 225, direction "fond nu, un aplat"):
 * a poster column on the left - the figure of the page in its one flat
 * block, then what helps to read the rest - and the content on the right,
 * straight on the backdrop. The home page and "À acheter" were already
 * built this way; Collection and Statistiques now share it.
 *
 * On a phone the poster comes first, then the content: one column.
 */
export function PageAffiche({ affiche, children }: { affiche: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-10 lg:grid lg:grid-cols-[minmax(0,400px)_minmax(0,1fr)] lg:items-start lg:gap-14">
      <aside className="flex min-w-0 flex-col gap-7 lg:sticky lg:top-24">{affiche}</aside>
      <div className="min-w-0">{children}</div>
    </div>
  )
}

/**
 * The one flat block of colour of a screen, and its figure: square corners,
 * the vivid tone of the cover, a giant number. The title of the page sits
 * above the number in small capitals, so the block names the page too.
 */
export function AplatChiffre({
  titre,
  niveau = 1,
  chiffre,
  legende,
  children,
}: {
  titre: ReactNode
  /** 1 when the block heads the page (its title is the page's `<h1>`). */
  niveau?: 1 | 2
  chiffre: ReactNode
  legende: ReactNode
  children?: ReactNode
}) {
  const Titre = niveau === 1 ? 'h1' : 'h2'
  return (
    <section className="aplat flex flex-col gap-3 p-7 lg:p-8">
      <Titre className="text-mention font-bold tracking-[0.16em] uppercase">{titre}</Titre>
      <p className="font-display text-[clamp(5.5rem,12vw,9.5rem)] leading-[0.82] font-bold tracking-[-0.065em] tabular-nums">{chiffre}</p>
      <p className="text-section font-semibold tracking-[-0.01em]">{legende}</p>
      {children}
    </section>
  )
}
