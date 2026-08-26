import { useRef, type ReactNode } from 'react'

/** Les trois façons de regarder une œuvre. Ce ne sont pas des groupes
 *  inventés pour la mise en page : ce sont les trois axes du modèle, ceux que
 *  ce dépôt répète depuis le début - Possession != Expérience != Catalogue.
 *  Ranger la fiche selon eux, c'est montrer la règle plutôt que la brouiller. */
export type SectionFiche = 'tomes' | 'suivi' | 'oeuvre'

export interface DefinitionSection {
  cle: SectionFiche
  libelle: string
  /** La ligne sous le libellé. Toujours une donnée réelle et calculée
   *  (« 1 sur 6 possédés », « Rang B · 7/10 »), jamais un slogan : c'est ce
   *  qui permet de savoir ce qu'il y a dans une section sans l'ouvrir. */
  resume: string
}

/**
 * La barre de sections de la fiche - collante, à TOUTES les largeurs.
 *
 * <h2>Ce qui change par rapport aux onglets précédents</h2>
 * Ils n'existaient qu'en dessous de 900px : au-delà, la fiche montrait tout à
 * la fois sur deux colonnes. La maquette v4 tranche l'inverse - une section à
 * la fois, quelle que soit la largeur - et le fait pour une raison qui tient :
 * les trois axes ne se lisent pas ensemble. Ce que je possède, ce que j'en
 * pense et ce que l'œuvre EST sont trois questions séparées ; les afficher
 * côte à côte demandait au lecteur de faire lui-même le tri à chaque coup
 * d'œil, et donnait deux colonnes dont l'une était systématiquement plus
 * courte que l'autre.
 *
 * <h2>Un vrai `tablist`, cette fois</h2>
 * L'ancienne barre s'en tenait à des `aria-pressed` parce que les panneaux
 * coexistaient en grand : annoncer `role="tab"` aurait été faux la moitié du
 * temps. Ils s'excluent maintenant partout, le motif ARIA « tabs » décrit donc
 * exactement ce qui se passe - avec ce qu'il exige vraiment : un seul onglet
 * atteignable au Tab (tabindex mobile), et les flèches pour circuler entre
 * eux.
 */
export function BarreSectionsFiche({
  sections,
  actif,
  onChange,
  assistant,
  barreRef,
}: {
  sections: DefinitionSection[]
  actif: SectionFiche
  onChange: (section: SectionFiche) => void
  /** La pastille « Demander à l'assistant » et ses questions, posées par la
   *  page : l'assistant répond sur la série entière, pas sur une section. */
  assistant?: ReactNode
  barreRef?: React.RefObject<HTMLDivElement | null>
}) {
  const ongletsRef = useRef<(HTMLButtonElement | null)[]>([])

  function auClavier(event: React.KeyboardEvent, index: number) {
    const dernier = sections.length - 1
    let cible: number | null = null
    if (event.key === 'ArrowRight') cible = index === dernier ? 0 : index + 1
    else if (event.key === 'ArrowLeft') cible = index === 0 ? dernier : index - 1
    else if (event.key === 'Home') cible = 0
    else if (event.key === 'End') cible = dernier
    if (cible === null) return
    event.preventDefault()
    onChange(sections[cible].cle)
    ongletsRef.current[cible]?.focus()
  }

  return (
    // `top-14` / `md:top-16` : exactement la hauteur de MobileHeader puis de
    // DesktopHeader, qui sont eux-mêmes collants en haut. `z-[9]`, juste sous
    // leur `z-10` - la barre doit glisser SOUS l'en-tête, jamais par-dessus.
    //
    // `-mx-4 px-4` puis `md:mx-0 md:px-0` : en dessous du point de bascule, le
    // conteneur de page porte 16px de marge (voir AppShell) et la barre doit
    // les reprendre pour que son filet traverse tout l'écran ; au-dessus, le
    // conteneur n'a plus de marge et le même débord la ferait dépasser du
    // contenu de 16px de chaque côté.
    <div
      ref={barreRef}
      className="sticky top-14 z-[9] -mx-4 mt-6 border-y border-line bg-background/90 px-4 backdrop-blur-lg md:top-16 md:mx-0 md:px-0"
    >
      <div className="flex items-center justify-between gap-4 overflow-x-auto py-2.5">
        <div role="tablist" aria-label="Sections de la fiche" className="flex shrink-0 items-stretch gap-2">
          {sections.map((section, index) => {
            const estActif = section.cle === actif
            return (
              <button
                key={section.cle}
                ref={(noeud) => {
                  ongletsRef.current[index] = noeud
                }}
                type="button"
                role="tab"
                id={`onglet-${section.cle}`}
                aria-selected={estActif}
                aria-controls={`panneau-${section.cle}`}
                tabIndex={estActif ? 0 : -1}
                onKeyDown={(event) => auClavier(event, index)}
                onClick={() => onChange(section.cle)}
                className={`flex shrink-0 items-center gap-2.5 rounded-[14px] py-2 pr-4 pl-3 text-left transition-colors ${
                  estActif
                    ? 'border-l-[3px] border-accent bg-surface shadow-token-md'
                    : 'border-l-[3px] border-transparent text-textDim'
                }`}
              >
                <span
                  className={`font-display text-[11px] font-bold tracking-[0.06em] ${
                    estActif ? 'text-accentText' : 'text-faint'
                  }`}
                >
                  {String(index + 1).padStart(2, '0')}
                </span>
                <span className="flex flex-col leading-tight whitespace-nowrap">
                  <span className={`text-sm ${estActif ? 'font-semibold text-textPrimary' : 'font-medium'}`}>
                    {section.libelle}
                  </span>
                  <span className={`text-[11.5px] ${estActif ? 'text-accentText' : 'text-faint'}`}>
                    {section.resume}
                  </span>
                </span>
              </button>
            )
          })}
        </div>

        {assistant ? <div className="flex shrink-0 items-center gap-2">{assistant}</div> : null}
      </div>
    </div>
  )
}
