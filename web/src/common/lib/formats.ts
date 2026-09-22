/**
 * Les nombres tels qu'on les lit en français.
 *
 * <h2>Le défaut</h2>
 * Vingt-trois endroits écrivaient un montant avec `toFixed(2)` suivi de « € » :
 * « 901.65 € », « 1234.50 € » - le point décimal et l'absence de séparateur de
 * milliers d'une interface anglophone, au milieu de phrases françaises. Une
 * note moyenne s'écrivait « 4.7/10 » de la même façon.
 *
 * <h2>Une seule écriture</h2>
 * `Intl.NumberFormat` en `fr-FR` donne « 901,65 € » et « 1 234,50 € », avec
 * l'espace fine insécable devant le symbole : c'est ce qu'un lecteur français
 * attend, et c'est le navigateur qui le sait, pas une expression régulière
 * maison. Le formateur est construit une fois : en construire un par appel
 * coûte cher dans une liste de cent lignes.
 */
const EUROS = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 })

/**
 * « 7,20 € », « 1 234,50 € ».
 *
 * L'espace fine insécable (U+202F) que produit `fr-FR` est presque invisible
 * dans les polices de l'interface : « 1695,10 € » se lisait sans séparateur.
 * Une insécable ordinaire garde le groupe soudé et se voit.
 */
export function formaterEuros(valeur: number): string {
  return EUROS.format(valeur).replace(/\u202f/g, '\u00a0')
}

/** « 4,7 » - une note, une moyenne : virgule décimale, nombre de décimales fixé. */
export function formaterDecimal(valeur: number, decimales = 1): string {
  return valeur.toLocaleString('fr-FR', { minimumFractionDigits: decimales, maximumFractionDigits: decimales })
}

const DATE_COURTE = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })

/**
 * « 12 août 2026 » depuis une date ISO (`YYYY-MM-DD`), lue comme une date
 * locale : la même chaîne interprétée en UTC reculerait d'un jour à l'ouest
 * de Greenwich.
 */
export function formaterDateCourte(iso: string): string {
  const [annee, mois, jour] = iso.slice(0, 10).split('-').map(Number)
  if (!annee || !mois || !jour) return iso
  return DATE_COURTE.format(new Date(annee, mois - 1, jour))
}
