import { useEffect } from 'react'

const BASE = 'IozyCore'

/**
 * Fait suivre au titre du document le titre de la page affichée.
 *
 * <h2>Ce que son absence coûtait</h2>
 * Les dix-sept routes portaient toutes le titre « IozyCore », alors que
 * chacune affiche un `<h1>` distinct. Trois conséquences, dont une
 * d'accessibilité :
 * <ul>
 *   <li>l'historique du navigateur devenait illisible - dix entrées
 *       « IozyCore » ne permettent de revenir nulle part ;</li>
 *   <li>un onglet gardé ouvert ne disait pas sur quoi ;</li>
 *   <li><b>une navigation SPA n'annonce rien</b> à un lecteur d'écran : la
 *       page ne se recharge pas, il n'y a donc aucun événement à annoncer. La
 *       mise à jour du titre est le remède conventionnel.</li>
 * </ul>
 *
 * <h2>Pourquoi lire le `h1` plutôt que déclarer une liste</h2>
 * Une table « route → libellé » aurait dupliqué des textes déjà écrits dans
 * les pages, et ce dépôt s'est déjà fait mordre plusieurs fois par deux listes
 * qui divergent. Le `h1` <b>est</b> le titre de la page, au sens sémantique :
 * le lire évite d'en tenir un second.
 *
 * <p>Bénéfice inattendu : les routes dynamiques suivent gratuitement. La fiche
 * d'une série affiche « Naruto · IozyCore » sans qu'aucune table n'ait à
 * connaître les œuvres du catalogue.
 *
 * <h2>Le titre arrive parfois après le premier rendu</h2>
 * Une page qui attend ses données affiche un squelette sans `h1`. Un simple
 * `querySelector` au moment de la navigation le manquerait. Un
 * {@link MutationObserver} attend donc son apparition, se débranche dès qu'il
 * l'a trouvé, et abandonne après un délai plutôt que d'observer indéfiniment.
 */
/**
 * @param cle ce qui, en changeant, peut changer le `h1` affiché. La route,
 *            évidemment - mais pas seulement : la porte d'authentification
 *            remplace tout l'écran <b>sans</b> changer d'URL, et le titre
 *            restait alors celui de l'écran de connexion (« IozyCore ») une
 *            fois la collection affichée. Une clé, pas un chemin.
 */
export function useDocumentTitleFromHeading(cle: string): void {
  useEffect(() => {
    const appliquer = (titre: string | null | undefined) => {
      const propre = (titre ?? '').replace(/\s+/g, ' ').trim()
      // « IozyCore · IozyCore » : le titre d'un écran qui porte le nom de
      // l'application ne se suffixe pas de lui-même.
      document.title = !propre || propre === BASE ? BASE : `${propre} · ${BASE}`
    }

    // `main h1` d'abord, puis n'importe quel `h1` : la page de partage public
    // vit hors du shell et n'a pas de `<main>`. Sans ce repli elle gardait le
    // titre de base alors qu'elle affiche bien un titre.
    const lire = () =>
      (document.querySelector('main h1') ?? document.querySelector('h1'))?.textContent

    // « … » est le titre d'attente d'une page dont le libellé arrive après
    // (un rayon, un classement général) : ce n'est pas un titre, on attend le
    // vrai - sinon l'onglet restait « … · IozyCore » (lot 148).
    const utilisable = (titre: string | null | undefined) => !!titre && !/^[\s.…]*$/.test(titre)

    const immediat = lire()
    if (utilisable(immediat)) {
      appliquer(immediat)
      return
    }

    // Pas encore de titre : la page charge. On repart de la base pour ne pas
    // laisser celui de la page précédente, qui serait faux.
    appliquer(null)

    // Même repli pour l'observation : sans `<main>`, on surveille le corps.
    const cible = document.querySelector('main') ?? document.body
    if (!cible) return

    const observateur = new MutationObserver(() => {
      const trouve = lire()
      if (utilisable(trouve)) {
        appliquer(trouve)
        observateur.disconnect()
      }
    })
    // `characterData` : React remplace le TEXTE d'un h1 déjà rendu (« … » puis
    // « Manga ») sans toucher à ses nœuds - une observation limitée aux enfants
    // ne le verrait jamais.
    observateur.observe(cible, { childList: true, subtree: true, characterData: true })

    // Une page qui n'a pas de h1 du tout ne doit pas laisser un observateur
    // vivant derrière elle.
    const abandon = setTimeout(() => observateur.disconnect(), 5000)

    return () => {
      observateur.disconnect()
      clearTimeout(abandon)
    }
  }, [cle])
}
