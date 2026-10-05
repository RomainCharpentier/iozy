/**
 * What a screen shows while waiting for its data: the shape of what is coming.
 *
 * <h2>The flaw</h2>
 * Twenty-nine screens wrote "Chargement..." in gray, alone in the middle of
 * the page. The word is honest, but it makes you wait in front of emptiness, and
 * each arrival of data made the layout jump all at once. A
 * skeleton takes the exact place of what is going to be displayed: the eye knows where to
 * look, and nothing jumps.
 *
 * <h2>Announced once</h2>
 * The block carries `role="status"` and a "Chargement…" for screen readers;
 * the shapes themselves are decorative (`aria-hidden`).
 */
export function Squelette({ lignes = 3, className = '' }: { lignes?: number; className?: string }) {
  const largeurs = ['w-3/4', 'w-full', 'w-5/6', 'w-2/3', 'w-11/12']
  return (
    <div role="status" className={`flex flex-col gap-2.5 ${className}`}>
      <span className="sr-only">Chargement…</span>
      {Array.from({ length: lignes }, (_, i) => (
        <div key={i} aria-hidden="true" className={`squelette h-4 ${largeurs[i % largeurs.length]}`} />
      ))}
    </div>
  )
}

/** A home rail while waiting: its header, then tiles in cover format. */
export function SqueletteRail({ tuiles = 4 }: { tuiles?: number }) {
  return (
    <div role="status" className="flex flex-col gap-3 py-2">
      <span className="sr-only">Chargement…</span>
      <div aria-hidden="true" className="squelette h-5 w-32" />
      <div aria-hidden="true" className="flex gap-3 overflow-hidden">
        {Array.from({ length: tuiles }, (_, i) => (
          <div key={i} className="w-[130px] shrink-0 sm:w-[150px]">
            <div className="squelette aspect-[2/3] w-full rounded-2xl" />
            <div className="squelette mt-2 h-3.5 w-4/5" />
            <div className="squelette mt-1.5 h-3 w-1/2" />
          </div>
        ))}
      </div>
    </div>
  )
}

/** A grid of tiles while waiting (shelf, volumes). */
export function SqueletteGrille({ tuiles = 6, aspect = 'aspect-[2/3]' }: { tuiles?: number; aspect?: string }) {
  return (
    <div role="status" className="grid grid-cols-3 gap-3 md:grid-cols-4 md:gap-5 xl:grid-cols-5 2xl:grid-cols-6">
      <span className="sr-only">Chargement…</span>
      {Array.from({ length: tuiles }, (_, i) => (
        <div key={i} aria-hidden="true">
          <div className={`squelette w-full rounded-2xl ${aspect}`} />
          <div className="squelette mt-2 h-3.5 w-4/5" />
        </div>
      ))}
    </div>
  )
}

/** A list of rows while waiting (catalog, history, accounts). */
export function SqueletteListe({ lignes = 5 }: { lignes?: number }) {
  return (
    <div role="status" className="flex flex-col gap-2">
      <span className="sr-only">Chargement…</span>
      {Array.from({ length: lignes }, (_, i) => (
        <div key={i} aria-hidden="true" className="squelette h-12 w-full" />
      ))}
    </div>
  )
}

/** The detail page of a work while waiting: cover, title, then a grid. */
export function SqueletteFiche() {
  return (
    <div role="status" className="flex flex-col gap-6">
      <span className="sr-only">Chargement…</span>
      <div aria-hidden="true" className="flex gap-5 md:gap-9">
        <div className="squelette aspect-[2/3] w-[clamp(112px,15vw,188px)] shrink-0 rounded-xl" />
        <div className="flex min-w-0 flex-1 flex-col gap-3 pt-2">
          <div className="squelette h-3 w-16" />
          <div className="squelette h-9 w-2/3" />
          <div className="squelette h-4 w-1/3" />
          <div className="squelette mt-3 h-11 w-40" />
        </div>
      </div>
      <SqueletteGrille tuiles={8} />
    </div>
  )
}
