import type { ReactNode } from 'react'
import { AlignLeft, Download, Pencil, UserRound } from 'lucide-react'
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

/**
 * Un bloc « intitulé discret puis valeur » - la forme de la colonne PERSONNEL,
 * qui n'aligne pas des paires mais des relevés.
 *
 * <h2>On modifie une information là où elle s'affiche</h2>
 * `onModifier` accroche au relevé son propre point d'entrée. Ces informations
 * - classement, note, lectures, tags - relèvent de l'intention « juger », qui
 * est celle d'un utilisateur normal (étude produit du 2026-08-27, §2) : elles
 * n'ont rien à faire derrière « Éditer », qui est l'espace du CATALOGUE. Et
 * les rassembler ailleurs en un mur d'éditeurs, c'était les afficher à un
 * endroit pour les modifier à un autre.
 *
 * <p>Le geste est discret mais TOUJOURS visible. Le révéler au survol
 * obligerait à deviner si l'appareil en a un, et une largeur d'écran ne le dit
 * pas : un écran tactile large n'a pas de survol, un petit écran avec souris
 * en a un. Plutôt que de parier sur `md:`, le bouton reste là, petit et calme -
 * un contrôle qu'on ne voit pas n'existe pas.
 */
export function ReleveInspecteur({
  libelle,
  onModifier,
  ouvert = false,
  children,
}: {
  libelle: string
  onModifier?: () => void
  ouvert?: boolean
  children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <span className="text-xs text-faint">{libelle}</span>
        {onModifier && (
          <button
            type="button"
            onClick={onModifier}
            aria-expanded={ouvert}
            aria-label={`Modifier : ${libelle}`}
            className={`flex h-6 items-center gap-1 rounded-full px-2 text-[11px] font-medium transition-colors ${
              ouvert ? 'bg-accent text-accentInk' : 'text-faint hover:bg-softBtn hover:text-textPrimary'
            }`}
          >
            <Pencil size={11} />
            {ouvert ? 'Fermer' : 'Modifier'}
          </button>
        )}
      </div>
      {children}
    </div>
  )
}

/** Les rouages recopiés d'un fournisseur - colonne SOURCE de la maquette.
 *  Liste fermée et ORDONNÉE : c'est l'ordre de la maquette, pas celui,
 *  imprévisible, des clés du sac d'attributs. */
const CLES_SOURCE: { cle: string; libelle: string }[] = [
  { cle: 'malId', libelle: 'malId' },
  { cle: 'titleRomaji', libelle: 'Titre romaji' },
  { cle: 'titleJapanese', libelle: 'Titre japonais' },
  { cle: 'seriesStatus', libelle: 'Statut source' },
  { cle: 'totalVolumes', libelle: 'Nb de tomes source' },
  { cle: 'endYear', libelle: 'Année de fin' },
]

/**
 * La colonne SOURCE, identique sur la fiche et sur l'aperçu d'une œuvre qu'on
 * ne possède pas.
 *
 * <p>La liste ET son rendu vivaient en double, avec pour seul lien un
 * commentaire disant « mêmes clés, même ordre que la colonne SOURCE de la
 * fiche ». Deux listes gardées synchronisées à la main sont deux listes vouées
 * à diverger (voir Lot 39, où le même montage avait déjà lâché sur la
 * navigation) - et c'est la même provenance, qu'elle soit déjà enregistrée
 * ou non.
 */
export function ColonneSource({ attributs }: { attributs: Record<string, unknown> }) {
  return (
    <div className="flex flex-col">
      {CLES_SOURCE.map(({ cle, libelle }) => {
        const valeur = attributs[cle]
        if (valeur === null || valeur === undefined || valeur === '') return null
        return (
          <RangeeInspecteur key={cle} libelle={libelle} compact>
            {String(valeur)}
          </RangeeInspecteur>
        )
      })}
    </div>
  )
}
