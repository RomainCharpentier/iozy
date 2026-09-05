import { Suspense, lazy, type ComponentType, type ReactNode } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { PageIntrouvable } from '@/pages/not-found/PageIntrouvable'
import { AppShell } from '@/common/components/layout/AppShell'
import { ShelfPage } from '@/pages/collection/ShelfPage'
import { AuthPage } from '@/pages/auth/AuthPage'
import { useAuth } from '@/common/hooks/useAuth'
import { estReserveeAuxComptes } from '@/common/lib/accesInvite'
import { useDocumentTitleFromHeading } from '@/common/hooks/useDocumentTitle'
import { useScrollToTopOnNavigation } from '@/common/hooks/useScrollToTop'
import { definirPreferencesCollection } from '@/common/lib/preferencesCollection'

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
const SearchPage = page(() => import('@/pages/add/SearchPage'), 'SearchPage')
const EntityDetailPage = page(() => import('@/pages/entity/EntityDetailPage'), 'EntityDetailPage')
const ApercuOeuvrePage = page(() => import('@/pages/entity/apercu/ApercuOeuvrePage'), 'ApercuOeuvrePage')
const DiscoverPage = page(() => import('@/pages/discover/DiscoverPage'), 'DiscoverPage')
const TierListsScreen = page(() => import('@/pages/tier-lists/TierListsScreen'), 'TierListsScreen')
const GeneralTierBoardPage = page(() => import('@/pages/tier-lists/board/GeneralTierBoardPage'), 'GeneralTierBoardPage')
const CustomTierBoardPage = page(() => import('@/pages/tier-lists/board/CustomTierBoardPage'), 'CustomTierBoardPage')
const CategoryPage = page(() => import('@/pages/collection/category/CategoryPage'), 'CategoryPage')
const PurchaseAnalysisPage = page(() => import('@/pages/purchase-analysis/PurchaseAnalysisPage'), 'PurchaseAnalysisPage')
const AnalysisHistoryPage = page(() => import('@/pages/purchase-analysis/history/AnalysisHistoryPage'), 'AnalysisHistoryPage')
const AnalysisHistoryDetailPage = page(
  () => import('@/pages/purchase-analysis/history/AnalysisHistoryDetailPage'), 'AnalysisHistoryDetailPage')
const ProfilePage = page(() => import('@/pages/profile/ProfilePage'), 'ProfilePage')
const ImportBggPage = page(() => import('@/pages/profile/import-bgg/ImportBggPage'), 'ImportBggPage')
const AdministrationPage = page(() => import('@/pages/profile/administration/AdministrationPage'), 'AdministrationPage')
const ComptesPage = page(() => import('@/pages/profile/administration/ComptesPage'), 'ComptesPage')
const TagsPage = page(() => import('@/pages/profile/administration/TagsPage'), 'TagsPage')
const SuggestionsPage = page(() => import('@/pages/suggestions/SuggestionsPage'), 'SuggestionsPage')
const CollectionRecapPage = page(() => import('@/pages/recap/CollectionRecapPage'), 'CollectionRecapPage')
const ScanPage = page(() => import('@/pages/scan/ScanPage'), 'ScanPage')
const StatsPage = page(() => import('@/pages/stats/StatsPage'), 'StatsPage')
const EditionsPage = page(() => import('@/pages/editions/EditionsPage'), 'EditionsPage')
const EntityTypesPage = page(() => import('@/pages/entity-types/EntityTypesPage'), 'EntityTypesPage')
const SettingsPage = page(() => import('@/pages/settings/SettingsPage'), 'SettingsPage')
const ImportPage = page(() => import('@/pages/settings/import/ImportPage'), 'ImportPage')
const QuestionPage = page(() => import('@/pages/profile/question/QuestionPage'), 'QuestionPage')
const SharedSpacePage = page(() => import('@/pages/share/SharedSpacePage'), 'SharedSpacePage')

/**
 * EntityTypeFormPage prend une prop : `lazy` rend un composant, pas un
 * élément, donc la prop se passe normalement à l'usage.
 */
const EntityTypeFormPage = lazy(() =>
  import('@/pages/entity-types/form/EntityTypeFormPage').then((m) => ({ default: m.EntityTypeFormPage })),
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

/**
 * Rien de l'application privée ne s'affiche sans compte.
 *
 * <h2>Pourquoi ici, et pas dans chaque écran</h2>
 * Le serveur refuse déjà chaque appel en 401 - c'est lui qui protège les
 * données, et lui seul. Mais sans cette porte, l'app monterait quand même sa
 * navigation, ses en-têtes et ses écrans vides par-dessus une pile de refus :
 * quelqu'un de déconnecté verrait une collection qui a l'air cassée plutôt
 * qu'une raison. Un seul endroit décide, et il décide avant le routage.
 *
 * <p>Tant que la question n'a pas de réponse, on ne montre <b>ni</b> l'app
 * <b>ni</b> l'écran de connexion : afficher « Se connecter » à quelqu'un qui a
 * une session valide, le temps d'un aller-retour, le ferait douter à chaque
 * ouverture.
 */
function PorteFermee({ children }: { children: ReactNode }) {
  const { compte, enCoursDeVerification } = useAuth()
  if (enCoursDeVerification) return <EnAttente />
  if (!compte) return <AuthPage />
  return <>{children}</>
}

/**
 * Une visite sans compte ne s'aventure pas dans les écrans d'écriture.
 *
 * <h2>Pourquoi une redirection et pas un écran « interdit »</h2>
 * Aucun de ces chemins n'est ATTEIGNABLE pendant une visite : les barres de
 * navigation ne les proposent pas (voir lib/accesInvite, la même liste). On n'y
 * arrive que par un signet, un lien reçu, ou un rechargement là où l'on était
 * avant de quitter son compte - trois situations où l'on veut voir la
 * collection, pas une explication. Elles mènent donc à l'accueil.
 *
 * <p>`replace` : revenir en arrière doit ramener d'où l'on vient, pas à une URL
 * qui redirigerait aussitôt (même règle que la redirection des Envies).
 *
 * <p>La destination de repli est le CATALOGUE, et surtout pas `/` : « Ma
 * collection » fait partie des écrans fermés à un visiteur - elle ne montre
 * que ce qu'on possède ou souhaite - et l'y renvoyer aurait bouclé la
 * redirection sur elle-même.
 *
 * <p>Ce n'est PAS ce qui protège : le serveur refuse toute écriture à une
 * session de visite, quelle que soit la route (voir SecurityConfig).
 */
function PorteDeVisite({ children }: { children: ReactNode }) {
  const { estInvite } = useAuth()
  const { pathname } = useLocation()
  if (estInvite && estReserveeAuxComptes(pathname)) return <Navigate to="/add" replace />
  return <>{children}</>
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
  // La porte d'authentification remplace tout l'écran SANS changer d'URL : le
  // titre doit donc suivre les deux, sinon l'onglet garde « IozyCore » une
  // fois la collection affichée.
  const { compte } = useAuth()
  useDocumentTitleFromHeading(`${pathname}|${compte ? 'connecte' : 'anonyme'}`)
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
            <PorteFermee>
            <AppShell>
              <Suspense fallback={<EnAttente />}>
                <PorteDeVisite>
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
                  <Route path="/administration/comptes" element={<ComptesPage />} />
                  <Route path="/administration/tags" element={<TagsPage />} />
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
                  <Route path="/settings/import" element={<ImportPage />} />
                  <Route path="/question" element={<QuestionPage />} />
                  {/* Le repli, en dernier : sans lui une URL inconnue rendait
                      un `<main>` vide avec la navigation autour - un écran qui
                      a l'air cassé plutôt que d'expliquer. */}
                  <Route path="*" element={<PageIntrouvable />} />
                </Routes>
                </PorteDeVisite>
              </Suspense>
            </AppShell>
            </PorteFermee>
          }
        />
      </Routes>
    </Suspense>
  )
}
