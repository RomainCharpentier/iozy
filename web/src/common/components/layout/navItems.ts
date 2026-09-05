import { Compass, Library, Scale, Search } from 'lucide-react'

export interface NavItem {
  to: string
  /** Le libellé complet, celui de la barre desktop. */
  label: string
  /** Ce que la barre du pouce affiche - le même mot quand il tient, un mot
   *  plus court sinon. Quatre onglets sur 375 px ne laissent pas la place
   *  d'écrire « Analyser une annonce ». */
  labelCourt: string

  icon: typeof Library
  /** Routes additionnelles qui doivent aussi allumer cette entrée - ex: la
   *  fiche d'une série reste sous « Ma collection », l'historique d'analyses
   *  sous « Analyser une annonce ». `NavLink` seul ne sait comparer qu'un
   *  préfixe de route. */
  activeWhen: (pathname: string) => boolean
}

/**
 * Les destinations globales de l'application - **une seule liste**, lue par la
 * barre desktop et par la barre du pouce.
 *
 * <h2>Pourquoi elle vit ici et plus dans chaque barre</h2>
 * Les deux barres portaient chacune sa copie, « gardée manuellement
 * synchronisée » : c'est-à-dire garantie de diverger. Ajouter une quatrième
 * entrée à l'une et pas à l'autre aurait rendu un parcours entier
 * inatteignable au pouce - exactement ce qui était déjà arrivé aux Envies et
 * au Profil (voir GlobalShortcuts).
 *
 * <h2>Quatre entrées, pas trois (étude produit du 2026-08-27, §4)</h2>
 * « Analyser une annonce » était cachée sous « Rechercher ». C'est un parcours
 * indépendant, qui commence par une URL d'annonce et ne crée ni possession ni
 * envie : il ne partage avec la recherche que le fait de parler d'œuvres qu'on
 * ne possède pas encore.
 *
 * <p>Les Envies n'y sont pas : ce sont une lecture de Ma collection, pas une
 * destination (§16, décision close).
 */
export const NAV_ITEMS: NavItem[] = [
  {
    to: '/',
    label: 'Ma collection',
    labelCourt: 'Collection',
    icon: Library,
    activeWhen: (p) => p === '/' || p.startsWith('/entity/') || p.startsWith('/collection/'),
  },
  {
    to: '/add',
    // « Catalogue » et non « Rechercher » : l'onglet ne mène plus à une page
    // vide qu'une saisie remplit, il montre les œuvres que l'instance connaît.
    // Chercher chez un fournisseur y reste possible - c'est devenu la seconde
    // moitié de l'écran, pas sa raison d'être. C'est aussi la seule
    // destination d'un visiteur, à qui « Rechercher » n'aurait rien promis.
    label: 'Catalogue',
    labelCourt: 'Catalogue',
    icon: Search,
    // `/scan` reste sous Rechercher : scanner, c'est identifier une œuvre -
    // le même pipeline, une autre saisie.
    activeWhen: (p) => p === '/add' || p === '/scan' || p === '/apercu',
  },
  {
    to: '/discover',
    label: 'Découvrir',
    labelCourt: 'Découvrir',
    icon: Compass,
    activeWhen: (p) => p.startsWith('/discover') || p.startsWith('/tier-lists'),
  },
  {
    to: '/purchase-analysis',
    label: 'Analyser une annonce',
    labelCourt: 'Annonce',
    icon: Scale,
    activeWhen: (p) => p.startsWith('/purchase-analysis'),
  },
]
