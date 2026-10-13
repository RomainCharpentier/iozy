import { RELEASE_DATE_ATTRIBUTE_KEY, formatReleaseDate } from '@/common/lib/releaseDate'
import type { ReactNode } from 'react'
import { AlignLeft, Download, PenLine, UserRound } from 'lucide-react'
import { tonDe } from './useTeinteJaquette'
import { CLES_SOURCE, libelleDe, type BrouillonAttributs } from './useBrouillonInspecteur'
import { libelleStatutSerie } from './seriesInfo'

/**
 * The footer of the "multi-éditions" mockup: a single panel split into
 * three columns - PERSONAL, WORK, SOURCE.
 *
 * <h2>Three columns, and it is the usual distinction</h2>
 * These are the three axes that this repository has repeated from the start, simply
 * placed side by side instead of stacked: what I DO WITH IT (rank, rating,
 * readings, tags), what the work IS (mangaka, status, publisher), and WHERE
 * IT COMES FROM (ids and titles copied from a provider). The third
 * column has a slightly tinted background, as in the mockup: these are
 * internals, not information one reads every day.
 *
 * <h2>Why one panel and not three cards</h2>
 * Three separate cards would have three different heights - the exact defect
 * that the previous batches spent their time fixing. Here the
 * columns of one grid stretch together, and inner rules
 * (not gaps) separate them.
 */
export function InspecteurFiche({
  teinte,
  personnel,
  oeuvre,
  source,
}: {
  teinte: [number, number, number]
  /** Absent for a visitor: they have no rating, no readings, no ranking, and
   *  the column told them "Pas encore notée" - nothing to rate, nobody. */
  personnel?: ReactNode
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
        {personnel !== undefined && (
          <ColonneInspecteur
            titre="Personnel"
            icone={<UserRound size={16} className="text-accentText" />}
            souligne="bg-accent/30"
          >
            {personnel}
          </ColonneInspecteur>
        )}
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
      // The vertical rule is a BORDER and not an `box-shadow: inset` as
      // in the mockup: when the `auto-fit` grid falls back to one column,
      // a right border disappears by itself in last position,
      // where an inner shadow would stay stuck in the middle of the screen.
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

/** A "label on the left, value on the right" row separated by a rule -
 *  the shape of the WORK and SOURCE columns.
 *
 *  <p>In edit mode the SAME row carries an input field in place of
 *  the value (`saisie`), and a "saisi" pill when the value in the database
 *  was typed by hand - the source will no longer overwrite it (Batch 130). This is
 *  the user's request: transform the fields, do not duplicate them. */
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
  /** The content is an input field, not a value to align on the right. */
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

/** "Saisi à la main": a reload from the source does not overwrite it.
 *  Emptying the field removes the mark and gives the place back to the source. */
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

/** The field of a row in edit mode - compact enough for a column
 *  of 240 px, tall enough for a finger. */
export function ChampInspecteur({
  id,
  valeur,
  onChange,
  placeholder,
  type = 'text',
  ariaLabel,
}: {
  id: string
  valeur: string
  onChange: (valeur: string) => void
  placeholder?: string
  /** `date` for the release date (batch 146): the browser picker writes the ISO value expected by the server. */
  type?: 'text' | 'number' | 'date'
  /** The accessible name of the field, when the label of the row is only a neighboring text. */
  ariaLabel?: string
}) {
  return (
    <input
      id={id}
      type={type}
      min={type === 'number' ? 1 : undefined}
      value={valeur}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      aria-label={ariaLabel}
      className="champ w-full"
    />
  )
}

/** The release date entered on the detail page, readable ("14 octobre 2026") - absent when nothing is entered (batch 146). */
export function RangeeDateDeSortie({ attributs }: { attributs: Record<string, unknown> }) {
  const libelle = formatReleaseDate(attributs[RELEASE_DATE_ATTRIBUTE_KEY])
  if (!libelle) return null
  return <RangeeInspecteur libelle="Date de sortie">{libelle}</RangeeInspecteur>
}

/**
 * A block "discreet heading then value" - the shape of the PERSONAL column,
 * which does not align pairs but readouts.
 *
 * <h2>A single "Éditer" for the whole page</h2>
 * Each readout carried its own "Modifier" (ranking, rating, remarks,
 * readings, tags): five small buttons in a column, and an "Éditer"
 * at the top that only opened the catalog. The user decided on
 * 2026-09-04: a single gesture for the whole page. The readout therefore only shows
 * the information; its editors open with the edit mode of the
 * detail page (see EntityDetailPage).
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
 * The SOURCE column, identical on the detail page and on the preview of a work one
 * does not own.
 *
 * <p>The list AND its rendering existed twice, with only a comment as
 * link saying "same keys, same order as the SOURCE column of the
 * detail page". Two lists kept in sync by hand are two lists bound
 * to diverge (see Batch 39, where the same setup had already failed on
 * navigation) - and it is the same provenance, whether already saved
 * or not.
 */
export function ColonneSource({
  attributs,
  brouillon,
}: {
  attributs: Record<string, unknown>
  /** In edit mode: the same rows, as fields - all of them, even empty,
   *  since this is where one completes what the source did not give. */
  brouillon?: BrouillonAttributs
}) {
  if (brouillon) {
    return (
      <div className="flex flex-col">
        {brouillon.clesSource.map((cle) => (
          <RangeeInspecteur key={cle} libelle={libelleDe(cle)} compact saisie saisi={brouillon.saisi(cle)}>
            <ChampInspecteur
              id={`source-${cle}`}
              valeur={brouillon.valeur(cle)}
              onChange={(v) => brouillon.saisir(cle, v)}
              ariaLabel={libelleDe(cle)}
            />
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
            {/* The status is the provider's word ("FINISHED"): translated
                for reading, never rewritten in the attributes. */}
            {cle === 'seriesStatus' ? libelleStatutSerie(valeur) : String(valeur)}
          </RangeeInspecteur>
        )
      })}
    </div>
  )
}
