import type { ReactNode } from 'react'
import { AlignLeft, Download, UserRound } from 'lucide-react'
import { tonDe } from '../../lib/useTeinteJaquette'

/**
 * Le pied de la maquette « multi-éditions » : un seul panneau découpé en
 * trois colonnes — PERSONNEL, ŒUVRE, SOURCE.
 *
 * <h2>Trois colonnes, et c'est la même distinction que d'habitude</h2>
 * Ce sont les trois axes que ce dépôt répète depuis le début, simplement
 * posés côte à côte au lieu d'être empilés : ce que J'EN FAIS (rang, note,
 * lectures, tags), ce que l'œuvre EST (mangaka, statut, éditeur), et D'OÙ
 * ÇA VIENT (identifiants et titres recopiés d'un fournisseur). La troisième
 * colonne porte un fond légèrement teinté, comme dans la maquette : ce sont
 * des rouages, pas des informations qu'on lit tous les jours.
 *
 * <h2>Pourquoi un panneau et pas trois cartes</h2>
 * Trois cartes séparées auraient trois hauteurs différentes — le défaut
 * exact que les lots précédents ont passé leur temps à rattraper. Ici les
 * colonnes d'une même grille s'étirent ensemble, et ce sont des filets
 * intérieurs (et non des espaces) qui les séparent.
 */
export function InspecteurFiche({
  teinte,
  personnel,
  oeuvre,
  source,
}: {
  teinte: [number, number, number]
  personnel: ReactNode
  oeuvre: ReactNode
  source: ReactNode
}) {
  return (
    <div
      className="overflow-hidden rounded-2xl shadow-token-sm ring-1 ring-line ring-inset"
      style={{
        background:
          'linear-gradient(180deg, color-mix(in srgb, var(--color-surface) 92%, transparent),' +
          ' color-mix(in srgb, var(--color-surface) 82%, transparent)),' +
          ` linear-gradient(180deg, ${tonDe(teinte, 7)}, ${tonDe(teinte, 4)})`,
      }}
    >
      <div className="grid [grid-template-columns:repeat(auto-fit,minmax(240px,1fr))]">
        <ColonneInspecteur
          titre="Personnel"
          icone={<UserRound size={16} className="text-accentText" />}
          souligne="bg-accent/30"
        >
          {personnel}
        </ColonneInspecteur>
        <ColonneInspecteur titre="Œuvre" icone={<AlignLeft size={16} className="text-textDim" />} souligne="bg-line">
          {oeuvre}
        </ColonneInspecteur>
        <ColonneInspecteur
          titre="Source"
          icone={<Download size={16} className="text-faint" />}
          souligne="bg-line"
          fond={tonDe(teinte, 5)}
          derniere
        >
          {source}
        </ColonneInspecteur>
      </div>
    </div>
  )
}

function ColonneInspecteur({
  titre,
  icone,
  souligne,
  fond,
  derniere = false,
  children,
}: {
  titre: string
  icone: ReactNode
  souligne: string
  fond?: string
  derniere?: boolean
  children: ReactNode
}) {
  return (
    <section
      // Le filet vertical est une BORDURE et non un `box-shadow: inset` comme
      // dans la maquette : quand la grille `auto-fit` retombe à une colonne,
      // une bordure de droite disparaît toute seule en dernière position,
      // là où une ombre intérieure resterait plaquée au milieu de l'écran.
      className={`flex min-w-0 flex-col gap-3.5 px-5 py-[18px] ${derniere ? '' : 'border-r border-line'}`}
      style={fond ? { background: fond } : undefined}
    >
      <div className="flex items-center gap-2.5 pb-3">
        {icone}
        <h2 className="text-[11px] font-semibold tracking-[0.14em] text-textPrimary uppercase">{titre}</h2>
        <span aria-hidden="true" className={`ml-0 h-0.5 flex-1 rounded-full ${souligne}`} />
      </div>
      {children}
    </section>
  )
}

/** Une rangée « libellé à gauche, valeur à droite » séparée par un filet -
 *  la forme des colonnes ŒUVRE et SOURCE. */
export function RangeeInspecteur({
  libelle,
  children,
  compact = false,
}: {
  libelle: string
  children: ReactNode
  compact?: boolean
}) {
  return (
    <div
      className={`flex items-baseline justify-between gap-3.5 border-b border-line last:border-0 ${
        compact ? 'py-1.5' : 'py-[7px]'
      }`}
    >
      <span className="text-[12.5px] text-faint">{libelle}</span>
      <span className={`text-right font-medium text-textPrimary ${compact ? 'text-[13px]' : 'text-[13.5px]'}`}>
        {children}
      </span>
    </div>
  )
}

/** Un bloc « intitulé discret puis valeur » - la forme de la colonne
 *  PERSONNEL, qui n'aligne pas des paires mais des relevés. */
export function ReleveInspecteur({ libelle, children }: { libelle: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-faint">{libelle}</span>
      {children}
    </div>
  )
}
