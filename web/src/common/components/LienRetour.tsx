import { useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { retourDepuis, type Retour } from '@/common/lib/retour'

/**
 * The way back, at the top of a screen that was necessarily opened from
 * elsewhere.
 *
 * <h2>Two sources, and the first one wins</h2>
 * If whoever opened this screen <b>named</b> their origin (see
 * {@code lib/retour}), that is what we offer: a shelf opened from
 * Discover goes back there, not to Ma collection. Otherwise - received link, reload,
 * typed URL - we offer the <b>natural parent</b>, the one that really
 * contains this screen in the application.
 *
 * <p>The second case is the reason this component exists: ten screens had
 * <b>no</b> way back. They are all reachable from somewhere, and
 * from nowhere else - "Comptes" from Administration, "Bilan
 * annuel" from Discover. Without a link, the only exit was the browser's Back
 * button, which does not exist in an app installed in full
 * screen (see the PWA manifest, {@code display: standalone}).
 *
 * <h2>The label NAMES the destination</h2>
 * Never "Retour" alone. A "Retour" without a destination lies one time in
 * two, and that is exactly what {@code navigate(-1)} would do: opening two
 * screens in a row would take you back to the previous one, not to the one that contains.
 *
 * <h2>44 px tall</h2>
 * The first interactive element of the page, and the most likely to be aimed at
 * with a thumb at the top of the screen. The manual copies of this link did without it
 * (their text is 20 px): this is also what this extraction fixes.
 */
export function LienRetour({ parDefaut }: { parDefaut: Retour }) {
  const navigate = useNavigate()
  const retour = retourDepuis(useLocation().state) ?? parDefaut

  return (
    <button
      type="button"
      onClick={() => navigate(retour.to)}
      className="flex min-h-11 w-fit items-center gap-1.5 text-sm font-semibold text-textDim hover:text-textPrimary"
    >
      <ArrowLeft size={15} />
      {retour.libelle}
    </button>
  )
}
