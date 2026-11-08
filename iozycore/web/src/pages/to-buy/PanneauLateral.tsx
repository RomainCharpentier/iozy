import type { ReactNode } from 'react'
import { X } from 'lucide-react'
import { useModalA11y } from '@/common/hooks/useModalA11y'

/**
 * A panel of strong glass that slides in from the right, over the page it
 * belongs to (the listing analysis over "À acheter", lot 216). Full screen
 * under 640 px. Escape and the close button both close it, and the focus
 * goes back to what opened it.
 */
export function PanneauLateral({
  titre,
  onFermer,
  children,
}: {
  titre: string
  onFermer: () => void
  children: ReactNode
}) {
  const ref = useModalA11y<HTMLDivElement>(true, onFermer)
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        tabIndex={-1}
        aria-hidden="true"
        className="absolute inset-0 bg-scrim"
        onClick={onFermer}
      />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={titre}
        className="entree-douce iozy-verre iozy-verre--fort relative flex h-full w-full flex-col overflow-y-auto sm:w-[560px] sm:rounded-l-3xl"
      >
        <div className="sticky top-0 z-10 flex justify-end p-2">
          <button type="button" onClick={onFermer} aria-label="Fermer l’analyse" className="pilule-icone h-11 w-11">
            <X size={18} />
          </button>
        </div>
        <div className="px-4 pb-8 sm:px-6">{children}</div>
      </div>
    </div>
  )
}
