import { useState, type ReactNode } from 'react'
import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'

/** One thing the guide says: a sentence built from real data, and where it leads. */
export interface Conseil {
  cle: string
  texte: ReactNode
  to: string
  action: string
}

/**
 * Izy, the guide of the home page: a small character that says, one at a time,
 * what deserves attention this week. It invents nothing: every sentence comes
 * from the collection (what is almost done, the next release, the last
 * arrival), and each one leads somewhere. A click on Izy shows the next one.
 */
export function Guide({ conseils }: { conseils: Conseil[] }) {
  const [rang, setRang] = useState(0)
  if (conseils.length === 0) return null
  const conseil = conseils[rang % conseils.length]
  const plusieurs = conseils.length > 1

  return (
    <section aria-label="Izy, ton guide" className="flex items-center gap-4">
      <button
        type="button"
        onClick={() => setRang((r) => r + 1)}
        disabled={!plusieurs}
        aria-label={plusieurs ? 'Izy : conseil suivant' : 'Izy'}
        title={plusieurs ? 'Conseil suivant' : undefined}
        className="guide h-16 w-16 shrink-0 rounded-full focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent disabled:cursor-default"
      >
        <Izy />
      </button>
      <div key={conseil.cle} aria-live="polite" className="guide__bulle tuile flex min-w-0 flex-wrap items-center gap-x-5 gap-y-2 rounded-[22px] rounded-bl-md px-5 py-3.5">
        <p className="min-w-0 font-display text-lg leading-snug font-semibold text-textPrimary [&_em]:text-accentText [&_em]:not-italic">
          {conseil.texte}
        </p>
        <Link to={conseil.to} className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold whitespace-nowrap text-accentText hover:underline">
          {conseil.action} <ArrowRight size={15} aria-hidden="true" />
        </Link>
        {plusieurs && (
          <span aria-hidden="true" className="flex gap-1.5">
            {conseils.map((c, i) => (
              <span key={c.cle} className={`h-1.5 w-1.5 rounded-full ${i === rang % conseils.length ? 'bg-accent' : 'bg-muted'}`} />
            ))}
          </span>
        )}
      </div>
    </section>
  )
}

/** The character: a small rounded volume with a bookmark, two eyes and a smile. */
function Izy() {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" className="h-full w-full">
      <ellipse cx="32" cy="59" rx="15" ry="3" className="fill-textPrimary opacity-15" />
      <path d="M42 6h9v15l-4.5-3.5L42 21z" className="fill-textPrimary" />
      <rect x="9" y="9" width="46" height="46" rx="15" className="fill-accent" />
      <rect x="9" y="9" width="9" height="46" rx="4.5" className="fill-textPrimary opacity-15" />
      <g className="guide__yeux">
        <ellipse cx="27" cy="30" rx="5" ry="6" fill="#fff" />
        <ellipse cx="43" cy="30" rx="5" ry="6" fill="#fff" />
        <circle cx="28" cy="31" r="2.6" fill="#1c1714" />
        <circle cx="44" cy="31" r="2.6" fill="#1c1714" />
        <circle cx="29" cy="29.8" r="0.9" fill="#fff" />
        <circle cx="45" cy="29.8" r="0.9" fill="#fff" />
      </g>
      <path d="M30 41q5 4.5 10 0" fill="none" stroke="#1c1714" strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="21" cy="39" r="2.6" fill="#fff" opacity="0.28" />
      <circle cx="49" cy="39" r="2.6" fill="#fff" opacity="0.28" />
    </svg>
  )
}
