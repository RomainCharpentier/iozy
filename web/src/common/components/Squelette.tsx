/**
 * Ce qu'un écran montre en attendant ses données : la forme de ce qui vient.
 *
 * <h2>Le défaut</h2>
 * Vingt-neuf écrans écrivaient « Chargement... » en gris, seul au milieu de
 * la page. Le mot est honnête, mais il fait attendre devant du vide, et
 * chaque arrivée de données faisait sauter la mise en page d'un coup. Un
 * squelette occupe la place exacte de ce qui va s'afficher : l'œil sait où
 * regarder, et rien ne saute.
 *
 * <h2>Annoncé une fois</h2>
 * Le bloc porte `role="status"` et un « Chargement… » pour lecteur d'écran ;
 * les formes elles-mêmes sont décoratives (`aria-hidden`).
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

/** Un rail d'accueil en attente : son en-tête, puis des tuiles au format jaquette. */
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

/** Une grille de tuiles en attente (rayon, tomes). */
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

/** Une liste de lignes en attente (catalogue, historique, comptes). */
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

/** La fiche d'une œuvre en attente : jaquette, titre, puis une grille. */
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
