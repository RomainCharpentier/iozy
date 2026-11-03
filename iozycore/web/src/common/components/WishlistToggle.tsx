import { useState } from 'react'
import { Heart, HeartOff } from 'lucide-react'
import { useWishlist } from '@/common/hooks/useWishlist'
import { useCollecteParTome } from '@/common/lib/typeDeCollection'
import type { WishlistTarget } from '@/common/api/wishlist'

/**
 * The only "Envies" button of the application - same state, same label and same
 * visual feedback everywhere (local or external search result, scan
 * menu). All the logic lives in useWishlist.
 *
 * <h2>It applies to the WORK, so it is not displayed everywhere</h2>
 * This button only makes sense for a type that is owned as a single piece (video
 * game, board game). For a manga, the wanted object is the VOLUME, and the
 * only place where it can be designated is the grid of the detail page - the button
 * then disappears by itself (see lib/typeDeCollection).
 *
 * The button accepts both natures of work:
 * - `entityId`: the work already has an IozyCore detail page;
 * - `external`: it comes from an external source and does not have one yet. The
 *   backend resolves or creates its detail page on add and returns its internal identity,
 *   which we keep here so we can then display the real state and offer
 *   removal. No ownership is created: wanting is not owning.
 *
 * Two sizes: `inline` for a list row, where the button must not
 * weigh more than the title next to which it lives; `default` for a detail page, where
 * it is a full action.
 */
export function WishlistToggle({
  entityId,
  entityTypeId,
  external,
  variant = 'default',
}: {
  entityId?: string
  /** The type of the work. Required: it is what says whether the work is an object
   *  or a group, and therefore whether this button should exist. */
  entityTypeId: string
  external?: { entityTypeId: string; title: string; attributes?: Record<string, unknown> }
  variant?: 'default' | 'inline' | 'icone'
}) {
  const parTome = useCollecteParTome(entityTypeId)
  const wishlist = useWishlist()
  // Internal identity learned by adding an external work. As long as it is
  // unknown, the button cannot know whether the work is in the wishes - which
  // is accurate: a work without a detail page cannot be there.
  const [resoluEntityId, setResoluEntityId] = useState<string | undefined>()
  const idConnu = entityId ?? resoluEntityId
  const entry = idConnu ? wishlist.entryFor(idConnu) : undefined
  const dedans = !!entry

  // Nothing at all on a work that is collected by volume: the series there
  // is a GROUP, and wanting a group means nothing - it is volume 47 that one
  // wants, from the grid of the detail page. The rule lives here rather than at each
  // call: three surfaces placed this heart, a fourth would have placed it again.
  if (parTome) return null

  const base = 'flex items-center gap-1.5 font-semibold transition-colors disabled:opacity-50'
  // `icone` (lot 198): the heart alone, a 44 px square at the foot of a
  // cover tile, where a word would cover the title it lives next to.
  const taille =
    variant === 'inline'
      ? 'min-h-11 rounded-lg px-2 text-xs'
      : variant === 'icone'
        ? 'h-11 w-11 justify-center rounded-xl'
        : 'min-h-12 rounded-[14px] px-4 text-sm'
  // Outside a list row, this is a REAL secondary action, with its
  // own surface (mockup v4): placed bare next to a filled button, it no longer
  // read as a button at all - just as gray text.
  const couleur = dedans
    ? 'bg-accentTint text-accentText hover:bg-accent/25'
    : variant === 'default'
      ? 'bg-softBtn text-textPrimary hover:bg-softPress'
      : 'text-textDim hover:bg-rowHover hover:text-textPrimary'

  async function basculer() {
    if (entry && idConnu) {
      wishlist.remove(entry.id, { entityId: idConnu })
      return
    }
    const cible: WishlistTarget | undefined = entityId
      ? { entityId }
      : resoluEntityId
        ? { entityId: resoluEntityId }
        : external
    if (!cible) return
    const creee = await wishlist.addAsync(cible)
    setResoluEntityId(creee.entityId)
  }

  return (
    <button
      type="button"
      disabled={wishlist.isPending || (!entityId && !external && !resoluEntityId)}
      onClick={(e) => {
        // These buttons often live INSIDE a clickable row (search
        // result, scan menu): without this, the click would also open the detail page.
        e.stopPropagation()
        void basculer()
      }}
      // The visible label says the STATE; the accessible name says the ACTION, without
      // which a screen reader announces "Dans tes envies" on a button that,
      // in fact, removes.
      aria-label={dedans ? 'Retirer de mes envies' : 'Ajouter à mes envies'}
      className={`${base} ${taille} ${couleur}`}
    >
      {variant === 'icone' ? (
        // The state is the heart itself: filled once wanted, like the ring of
        // the tile it sits on. The accessible name still says the action.
        <Heart size={16} fill={dedans ? 'currentColor' : 'none'} />
      ) : dedans ? (
        <HeartOff size={variant === 'inline' ? 13 : 16} />
      ) : (
        <Heart size={variant === 'inline' ? 13 : 16} />
      )}
      {/* Inline on a phone, the heart is enough: the text took the place of the
          title next to which it lives. The accessible name always says the action. */}
      {variant !== 'icone' && (
        <span className={variant === 'inline' ? 'hidden sm:inline' : undefined}>
          {dedans ? 'Dans tes envies' : 'Ajouter aux envies'}
        </span>
      )}
    </button>
  )
}
