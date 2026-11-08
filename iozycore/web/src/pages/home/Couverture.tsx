import { Jaquette } from '@/common/components/Jaquette'

/**
 * A cover of the home page. With no image, or a broken one, the title on a
 * pane of the vivid tone: never a hole. Decorative: the title is always written
 * next to it.
 */
export function Couverture({
  url,
  titre,
  className = '',
  loading,
}: {
  url: string | null
  titre: string
  /** Size and aspect ratio. */
  className?: string
  loading?: 'lazy' | 'eager'
}) {
  return (
    <span aria-hidden="true" className={`relative block shrink-0 overflow-hidden rounded-lg bg-accentTint shadow-token-sm ${className}`}>
      <Jaquette
        src={url}
        loading={loading}
        className="absolute inset-0 h-full w-full object-cover"
        repli={
          <span className="absolute inset-0 flex items-end p-2 font-display text-xs font-bold leading-tight text-accentText">
            {titre}
          </span>
        }
      />
    </span>
  )
}
