import { Suspense, lazy, type ComponentType } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { PageIntrouvable } from './routes/PageIntrouvable'
import { AppShell } from './components/layout/AppShell'
import { ShelfPage } from './routes/Shelf/ShelfPage'
import { useDocumentTitleFromHeading } from './lib/useDocumentTitle'
import { useScrollToTopOnNavigation } from './lib/useScrollToTop'
import { definirPreferencesCollection } from './lib/preferencesCollection'

/**
 * `/wishlist` menait à un écran qui n'existe plus : les envies sont une
 * LECTURE de Ma collection (étude produit du 2026-08-27, §5). Le filtre est
 * posé au passage, sinon la redirection déposerait sur « Tout » quelqu'un qui
 * demandait justement ses envies.
 *
 * <p>`replace` : revenir en arrière doit ramener d'où l'on vient, pas à une
 * URL qui redirigerait aussitôt (même règle qu'à l'aperçu, Lot 36).
 */
function RedirectionEnvies() {
  definirPreferencesCollection({ filtre: 'envies' })
  return <Navigate to="/" replace />
}

/**
 * Charge une page à la demande, à partir d'un export NOMMÉ.
 *
 * `React.lazy` attend un module dont l'export est `default` ; toutes les pages
 * de ce dépôt exportent leur composant par son nom, ce qui se lit bien mieux à
 * l'import. Ce petit adaptateur évite d'avoir à changer vingt-six fichiers
 * pour satisfaire une contrainte d'API.
 */
function page<M extends Record<string, unknown>, K extends keyof M>(
  charger: () => Promise<M>,
  nom: K,
) {
  return lazy(() => charger().then((m) => ({ default: m[nom] as ComponentType })))
}

// Chargées à la demande. Seul ShelfPage reste dans le lot initial : c'est la
// page d'accueil, et la charger en différé ne ferait qu'ajouter une attente
// là où il n'y a rien à économiser.
const SearchPage = page(() => import('./routes/QuickAdd/SearchPage'), 'SearchPage')
const EntityDetailPage = page(() => import('./routes/EntityDetail/EntityDetailPage'), 'EntityDetailPage')
const ApercuOeuvrePage = page(() => import('./routes/EntityDetail/ApercuOeuvrePage'), 'ApercuOeuvrePage')
const DiscoverPage = page(() => import('./routes/Discover/DiscoverPage'), 'DiscoverPage')
const TierListsScreen = page(() => import('./routes/TierLists/TierListsScreen'), 'TierListsScreen')
const GeneralTierBoardPage = page(() => import('./routes/TierLists/GeneralTierBoardPage'), 'GeneralTierBoardPage')
const CustomTierBoardPage = page(() => import('./routes/TierLists/CustomTierBoardPage'), 'CustomTierBoardPage')
const CategoryPage = page(() => import('./routes/Shelf/CategoryPage'), 'CategoryPage')
const PurchaseAnalysisPage = page(() => import('./routes/PurchaseAnalysis/PurchaseAnalysisPage'), 'PurchaseAnalysisPage')
const AnalysisHistoryPage = page(() => import('./routes/PurchaseAnalysis/AnalysisHistoryPage'), 'AnalysisHistoryPage')
const AnalysisHistoryDetailPage = page(
  () => import('./routes/PurchaseAnalysis/AnalysisHistoryDetailPage'), 'AnalysisHistoryDetailPage')
const ProfilePage = page(() => import('./routes/Profile/ProfilePage'), 'ProfilePage')
const ImportBggPage = page(() => import('./routes/Profile/ImportBggPage'), 'ImportBggPage')
const AdministrationPage = page(() => import('./routes/Profile/AdministrationPage'), 'AdministrationPage')
const SuggestionsPage = page(() => import('./routes/Suggestions/SuggestionsPage'), 'SuggestionsPage')
const CollectionRecapPage = page(() => import('./routes/Recap/CollectionRecapPage'), 'CollectionRecapPage')
const ScanPage = page(() => import('./routes/Scan/ScanPage'), 'ScanPage')
const StatsPage = page(() => import('./routes/Stats/StatsPage'), 'StatsPage')
const EditionsPage = page(() => import('./routes/Editions/EditionsPage'), 'EditionsPage')
const EntityTypesPage = page(() => import('./routes/EntityTypes/EntityTypesPage'), 'EntityTypesPage')
const SettingsPage = page(() => import('./routes/Settings/SettingsPage'), 'SettingsPage')
const SharedSpacePage = page(() => import('./routes/Share/SharedSpacePage'), 'SharedSpacePage')

/**
 * EntityTypeFormPage prend une prop : `lazy` rend un composant, pas un
 * élément, donc la prop se passe normalement à l'usage.
 */
const EntityTypeFormPage = lazy(() =>
  import('./routes/EntityTypes/EntityTypeFormPage').then((m) => ({ default: m.EntityTypeFormPage })),
)

/**
 * Ce qui s'affiche pendant qu'une page arrive.
 *
 * Volontairement muet - pas de « Chargement… », pas d'animation. Sur une
 * connexion normale un lot de route arrive en quelques dizaines de
 * millisecondes : un mot qui apparaît puis disparaît aussitôt se lit comme un
 * clignotement, pas comme une information. La hauteur réservée évite que le
 * pied de page ne remonte puis redescende.
 */
function EnAttente() {
  return <div className="min-h-[50vh]" aria-hidden="true" />
}

/** La route /public/share/:token vit hors AppShell (voir SharedSpacePage) :
 * quelqu'un qui ouvre un lien de partage n'a pas de
 * compte et ne doit jamais voir la barre d'onglets privée ni pouvoir y
 * naviguer. Tout le reste de l'app reste dans AppShell, inchangé.
 *
 * <p><b>Les pages sont chargées à la demande</b> depuis ce fichier. Tout
 * partait auparavant dans un lot unique de 580 Ko : quelqu'un qui ouvre « Ma
 * collection » téléchargeait la fiche d'une œuvre, l'analyse d'achat, les Tier
 * Lists et l'administration avant de voir sa première jaquette. Les deux plus
 * gros écrans - fiche d'œuvre et analyse d'achat - pèsent à eux seuls plus de
 * la moitié du code de routes, et ni l'un ni l'autre n'est la page d'accueil.
 */
export default function App() {
  // Posé ICI et non dans AppShell : la page de partage public vit hors du
  // shell, et gardait donc le titre de la page précédente - « Manga ·
  // IozyCore » sur un espace partagé. App couvre les deux branches.
  const { pathname } = useLocation()
  useDocumentTitleFromHeading(pathname)
  // Posé ici pour la même raison : App couvre les deux branches de routage, y
  // compris la page de partage public qui vit hors du shell.
  useScrollToTopOnNavigation(pathname)

  return (
    <Suspense fallback={<EnAttente />}>
      <Routes>
        <Route path="/public/share/:token" element={<SharedSpacePage />} />
        <Route
          path="/*"
          element={
            <AppShell>
              <Suspense fallback={<EnAttente />}>
                <Routes>
                  <Route path="/" element={<ShelfPage />} />
                  <Route path="/add" element={<SearchPage />} />
                  <Route path="/entity/:id" element={<EntityDetailPage />} />
                  {/* L'aperçu d'une œuvre qu'on ne possède pas : la même page,
                      lue chez le fournisseur, sans rien écrire en base. */}
                  <Route path="/apercu" element={<ApercuOeuvrePage />} />
                  <Route path="/discover" element={<DiscoverPage />} />
                  <Route path="/tier-lists" element={<TierListsScreen />} />
                  <Route path="/tier-lists/general/:entityTypeId" element={<GeneralTierBoardPage />} />
                  <Route path="/tier-lists/:id" element={<CustomTierBoardPage />} />
                  <Route path="/collection/:entityTypeId" element={<CategoryPage />} />
                  <Route path="/purchase-analysis" element={<PurchaseAnalysisPage />} />
                  <Route path="/purchase-analysis/history" element={<AnalysisHistoryPage />} />
                  <Route path="/purchase-analysis/history/:id" element={<AnalysisHistoryDetailPage />} />
                  <Route path="/profile" element={<ProfilePage />} />
                  <Route path="/import-bgg" element={<ImportBggPage />} />
                  <Route path="/administration" element={<AdministrationPage />} />
                  <Route path="/suggestions" element={<SuggestionsPage />} />
                  <Route path="/recap" element={<CollectionRecapPage />} />
                  <Route path="/scan" element={<ScanPage />} />
                  {/* L'écran Envies a disparu dans Ma collection (lot C) - mais
                      un lien partagé ou un signet peut encore pointer ici :
                      il emmène au bon endroit plutôt qu'à une page introuvable. */}
                  <Route path="/wishlist" element={<RedirectionEnvies />} />
                  <Route path="/stats" element={<StatsPage />} />
                  <Route path="/editions" element={<EditionsPage />} />
                  <Route path="/types" element={<EntityTypesPage />} />
                  <Route path="/types/new" element={<EntityTypeFormPage mode="create" />} />
                  <Route path="/types/:id/edit" element={<EntityTypeFormPage mode="edit" />} />
                  <Route path="/settings" element={<SettingsPage />} />
                  {/* Le repli, en dernier : sans lui une URL inconnue rendait
                      un `<main>` vide avec la navigation autour - un écran qui
                      a l'air cassé plutôt que d'expliquer. */}
                  <Route path="*" element={<PageIntrouvable />} />
                </Routes>
              </Suspense>
            </AppShell>
          }
        />
      </Routes>
    </Suspense>
  )
}
