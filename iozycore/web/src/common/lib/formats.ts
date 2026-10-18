/**
 * Numbers as they are read in French.
 *
 * <h2>The flaw</h2>
 * Twenty-three places wrote an amount with `toFixed(2)` followed by "€":
 * "901.65 €", "1234.50 €" - the decimal point and the missing thousands
 * separator of an English interface, in the middle of French sentences. An
 * average rating was written "4.7/10" in the same way.
 *
 * <h2>One single way of writing</h2>
 * `Intl.NumberFormat` in `fr-FR` gives "901,65 €" and "1 234,50 €", with
 * the narrow no-break space before the symbol: this is what a French reader
 * expects, and it is the browser that knows it, not a home-made regular
 * expression. The formatter is built once: building one per call is
 * expensive in a list of a hundred rows.
 */
const EUROS = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 })

/**
 * "7,20 €", "1 234,50 €".
 *
 * The narrow no-break space (U+202F) that `fr-FR` produces is almost invisible
 * in the fonts of the interface: "1695,10 €" read as having no separator. An
 * ordinary no-break space keeps the group together and can be seen.
 */
export function formaterEuros(valeur: number): string {
  return EUROS.format(valeur).replace(/\u202f/g, '\u00a0')
}

/** "4,7" - a rating, an average: decimal comma, fixed number of decimals. */
export function formaterDecimal(valeur: number, decimales = 1): string {
  return valeur.toLocaleString('fr-FR', { minimumFractionDigits: decimales, maximumFractionDigits: decimales })
}

const DATE_COURTE = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })

/**
 * "12 août 2026" from an ISO date (`YYYY-MM-DD`), read as a local date:
 * the same string interpreted in UTC would go back one day west of
 * Greenwich.
 */
export function formaterDateCourte(iso: string): string {
  const [annee, mois, jour] = iso.slice(0, 10).split('-').map(Number)
  if (!annee || !mois || !jour) return iso
  return DATE_COURTE.format(new Date(annee, mois - 1, jour))
}
