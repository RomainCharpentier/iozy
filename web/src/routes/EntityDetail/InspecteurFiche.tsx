import type { ReactNode } from 'react'
import { AlignLeft, Download, PenLine, UserRound } from 'lucide-react'
import { tonDe } from '../../lib/useTeinteJaquette'
import { CLES_SOURCE, libelleDe, type BrouillonAttributs } from './useBrouillonInspecteur'

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
 *  la forme des colonnes ŒUVRE et SOURCE.
 *
 *  <p>En mode édition la MÊME rangée porte un champ de saisie à la place de
 *  la valeur (`saisie`), et une pastille « saisi » quand la valeur en base a
 *  été tapée à la main - la source ne l'écrasera plus (Lot 130). C'est la
 *  demande de l'utilisateur : transformer les champs, pas les dupliquer. */
export function RangeeInspecteur({
  libelle,
  children,
  compact = false,
  saisie = false,
  saisi = false,
}: {
  libelle: string
  children: ReactNode
  compact?: boolean
  /** Le contenu est un champ de saisie, pas une valeur à aligner à droite. */
  saisie?: boolean
  saisi?: boolean
}) {
  return (
    <div
      className={`flex gap-3.5 border-b border-line last:border-0 ${
        saisie ? 'items-center' : 'items-baseline justify-between'
      } ${compact ? 'py-1.5' : 'py-[7px]'}`}
    >
      <span className={`flex items-center gap-1.5 text-[12.5px] text-faint ${saisie ? 'w-[38%] shrink-0' : ''}`}>
        {libelle}
        {saisi && <PastilleSaisi />}
      </span>
      {saisie ? (
        <span className="min-w-0 flex-1">{children}</span>
      ) : (
        <span className={`text-right font-medium text-textPrimary ${compact ? 'text-[13px]' : 'text-[13.5px]'}`}>
          {children}
        </span>
      )}
    </div>
  )
}

/** « Saisi à la main » : un rechargement depuis la source ne l'écrase pas.
 *  Vider le champ retire la marque et rend la place à la source. */
export function PastilleSaisi() {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full bg-softBtn px-1.5 py-0.5 text-[10.5px] font-medium text-textDim"
      title="Saisi à la main : un rechargement depuis la source ne l'écrase pas. Vide le champ pour rendre la place à la source."
    >
      <PenLine size={10} aria-hidden="true" />
      saisi
    </span>
  )
}

/** Le champ d'une rangée en mode édition - assez compact pour une colonne
 *  de 240 px, assez haut pour le doigt. */
export function ChampInspecteur({
  id,
  valeur,
  onChange,
  placeholder,
  type = 'text',
}: {
  id: string
  valeur: string
  onChange: (valeur: string) => void
  placeholder?: string
  type?: 'text' | 'number'
}) {
  return (
    <input
      id={id}
      type={type}
      min={type === 'number' ? 1 : undefined}
      value={valeur}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded-lg bg-surface px-2.5 py-1.5 text-[13px] text-textPrimary placeholder:text-faint focus:ring-2 focus:ring-accent/50 focus:outline-none"
    />
  )
}

/**
 * Un bloc « intitulé discret puis valeur » - la forme de la colonne PERSONNEL,
 * qui n'aligne pas des paires mais des relevés.
 *
 * <h2>Un seul « Éditer » pour toute la page</h2>
 * Chaque relevé portait son propre « Modifier » (classement, note, remarques,
 * lectures, tags) : cinq petits boutons dans une colonne, et un « Éditer »
 * en haut qui n'ouvrait que le catalogue. L'utilisateur a tranché le
 * 2026-09-04 : un seul geste pour toute la page. Le relevé n'affiche donc
 * plus que l'information ; ses éditeurs s'ouvrent avec le mode édition de la
 * fiche (voir EntityDetailPage).
 */
export function ReleveInspecteur({ libelle, children }: { libelle: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-faint">{libelle}</span>
      {children}
    </div>
  )
}

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
export function ColonneSource({
  attributs,
  brouillon,
}: {
  attributs: Record<string, unknown>
  /** En mode édition : les mêmes rangées, en champs - toutes, même vides,
   *  puisque c'est là qu'on complète ce que la source n'a pas donné. */
  brouillon?: BrouillonAttributs
}) {
  if (brouillon) {
    return (
      <div className="flex flex-col">
        {brouillon.clesSource.map((cle) => (
          <RangeeInspecteur key={cle} libelle={libelleDe(cle)} compact saisie saisi={brouillon.saisi(cle)}>
            <ChampInspecteur id={`source-${cle}`} valeur={brouillon.valeur(cle)} onChange={(v) => brouillon.saisir(cle, v)} />
          </RangeeInspecteur>
        ))}
      </div>
    )
  }
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
