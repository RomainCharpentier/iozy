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
 * `/wishlist` led to a screen that no longer exists: wishes are now a
 * VIEW of My collection (product study of 2026-08-27, section 5). The filter is
 * set on the way, otherwise the redirect would land on "All" someone who
 * was asking for their wishes.
 *
 * <p>`replace`: going back must return to where the user came from, not to a
 * URL that would redirect at once (same rule as the preview, Batch 36).
 */
function RedirectionEnvies() {
  definirPreferencesCollection({ filtre: 'envies' })
  return <Navigate to="/" replace />
}

/**
 * Loads a page on demand, from a NAMED export.
 *
 * `React.lazy` expects a module whose export is `default`; all the pages
 * of this repository export their component by name, which reads much better at
 * the import. This small adapter avoids changing twenty-six files
 * to satisfy an API constraint.
 */
function page<M extends Record<string, unknown>, K extends keyof M>(
  charger: () => Promise<M>,
  nom: K,
) {
  return lazy(() => charger().then((m) => ({ default: m[nom] as ComponentType })))
}

// Loaded on demand. Only ShelfPage stays in the initial bundle: it is the
// home page, and loading it later would only add a wait
// where there is nothing to save.
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
const ReleasesPage = page(() => import('@/pages/releases/ReleasesPage'), 'ReleasesPage')
const CollectionRecapPage = page(() => import('@/pages/recap/CollectionRecapPage'), 'CollectionRecapPage')
const ScanPage = page(() => import('@/pages/scan/ScanPage'), 'ScanPage')
const ImportPhotoPage = page(() => import('@/pages/import-photo/ImportPhotoPage'), 'ImportPhotoPage')
const StatsPage = page(() => import('@/pages/stats/StatsPage'), 'StatsPage')
const EditionsPage = page(() => import('@/pages/editions/EditionsPage'), 'EditionsPage')
const EntityTypesPage = page(() => import('@/pages/entity-types/EntityTypesPage'), 'EntityTypesPage')
const ImportPage = page(() => import('@/pages/profile/import/ImportPage'), 'ImportPage')
const SharedSpacePage = page(() => import('@/pages/share/SharedSpacePage'), 'SharedSpacePage')

/**
 * EntityTypeFormPage takes a prop: `lazy` returns a component, not an
 * element, so the prop is passed normally at the point of use.
 */
const EntityTypeFormPage = lazy(() =>
  import('@/pages/entity-types/form/EntityTypeFormPage').then((m) => ({ default: m.EntityTypeFormPage })),
)

/**
 * What is shown while a page is arriving.
 *
 * Silent on purpose - no "Chargement...", no animation. On a normal
 * connection a route bundle arrives in a few tens of
 * milliseconds: a word that appears and then disappears at once reads as a
 * flicker, not as information. The reserved height stops the
 * footer from going up and then down again.
 */
function EnAttente() {
  return <div className="min-h-[50vh]" aria-hidden="true" />
}

/**
 * Nothing of the private application is shown without an account.
 *
 * <h2>Why here, and not in each screen</h2>
 * The server already refuses every call with a 401 - it is the one that protects
 * the data, and only it. But without this gate, the app would still mount its
 * navigation, its headers and its empty screens on top of a pile of refusals:
 * someone who is signed out would see a collection that looks broken instead of
 * a reason. One single place decides, and it decides before the routing.
 *
 * <p>While the question has no answer, we show <b>neither</b> the app
 * <b>nor</b> the sign-in screen: showing "Se connecter" to someone who has
 * a valid session, for the time of one round trip, would make them doubt at every
 * opening.
 */
function PorteFermee({ children }: { children: ReactNode }) {
  const { compte, enCoursDeVerification } = useAuth()
  if (enCoursDeVerification) return <EnAttente />
  if (!compte) return <AuthPage />
  return <>{children}</>
}

/**
 * A visit without an account does not go into the writing screens.
 *
 * <h2>Why a redirect and not a "forbidden" screen</h2>
 * None of these paths is REACHABLE during a visit: the navigation bars
 * do not offer them (see lib/accesInvite, the same list). The user only
 * gets there from a bookmark, a received link, or a reload where they were
 * before leaving their account - three situations where the user wants to see the
 * collection, not an explanation. They therefore lead to the home page.
 *
 * <p>`replace`: going back must return to where the user came from, not to a URL
 * that would redirect at once (same rule as the Wishes redirect).
 *
 * <p>The fallback destination is the CATALOG, and above all not `/`: "Ma
 * collection" is one of the screens closed to a visitor - it shows only
 * what one owns or wishes for - and sending the visitor there would have looped the
 * redirect on itself.
 *
 * <p>This is NOT what protects: the server refuses every write from a
 * visit session, whatever the route (see SecurityConfig).
 */
function PorteDeVisite({ children }: { children: ReactNode }) {
  const { estInvite } = useAuth()
  const { pathname } = useLocation()
  if (estInvite && estReserveeAuxComptes(pathname)) return <Navigate to="/add" replace />
  return <>{children}</>
}

/** The route /public/share/:token lives outside AppShell (see SharedSpacePage):
 * someone who opens a share link has no
 * account and must never see the private tab bar nor be able to
 * navigate in it. All the rest of the app stays in AppShell, unchanged.
 *
 * <p><b>Pages are loaded on demand</b> from this file. Everything
 * used to go in a single 580 KB bundle: someone who opened "Ma
 * collection" downloaded the work detail page, the purchase analysis, the Tier
 * Lists and the administration before seeing their first cover. The two biggest
 * screens - work detail page and purchase analysis - alone weigh more than
 * half of the route code, and neither of them is the home page.
 */
export default function App() {
  // Placed HERE and not in AppShell: the public share page lives outside the
  // shell, and so kept the title of the previous page - "Manga ·
  // IozyCore" on a shared space. App covers both branches.
  const { pathname } = useLocation()
  // The authentication gate replaces the whole screen WITHOUT changing the URL: the
  // title must therefore follow both, otherwise the tab keeps "IozyCore" once
  // the collection is shown.
  const { compte } = useAuth()
  useDocumentTitleFromHeading(`${pathname}|${compte ? 'connecte' : 'anonyme'}`)
  // Placed here for the same reason: App covers both routing branches,
  // including the public share page that lives outside the shell.
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
                  {/* The preview of a work that is not owned: the same page,
                      read from the provider, without writing anything to the database. */}
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
                  <Route path="/releases" element={<ReleasesPage />} />
                  <Route path="/recap" element={<CollectionRecapPage />} />
                  <Route path="/scan" element={<ScanPage />} />
                  <Route path="/import-photo" element={<ImportPhotoPage />} />
                  {/* The Wishes screen disappeared into My collection (batch C) - but
                      a shared link or a bookmark can still point here:
                      it takes the user to the right place instead of a not found page. */}
                  <Route path="/wishlist" element={<RedirectionEnvies />} />
                  <Route path="/stats" element={<StatsPage />} />
                  <Route path="/editions" element={<EditionsPage />} />
                  <Route path="/types" element={<EntityTypesPage />} />
                  <Route path="/types/new" element={<EntityTypeFormPage mode="create" />} />
                  <Route path="/types/:id/edit" element={<EntityTypeFormPage mode="edit" />} />
                  {/* Settings are ON Profile since batch 140; the
                      old addresses lead there - a bookmark must not
                      land on "page introuvable" because one screen
                      merged with its neighbour. */}
                  <Route path="/settings" element={<Navigate to="/profile" replace />} />
                  <Route path="/settings/import" element={<Navigate to="/profile/import" replace />} />
                  <Route path="/profile/import" element={<ImportPage />} />
                  {/* The fallback, last: without it an unknown URL rendered
                      an empty `<main>` with the navigation around it - a screen that
                      looks broken instead of explaining. */}
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
