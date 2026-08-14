import { Route, Routes } from 'react-router-dom'
import { AppShell } from './components/layout/AppShell'
import { ShelfPage } from './routes/Shelf/ShelfPage'
import { QuickAddPage } from './routes/QuickAdd/QuickAddPage'
import { EntityDetailPage } from './routes/EntityDetail/EntityDetailPage'
import { WishlistPage } from './routes/Wishlist/WishlistPage'
import { SharedWishlistPage } from './routes/Wishlist/SharedWishlistPage'
import { StatsPage } from './routes/Stats/StatsPage'
import { EntityTypesPage } from './routes/EntityTypes/EntityTypesPage'
import { EntityTypeFormPage } from './routes/EntityTypes/EntityTypeFormPage'
import { SettingsPage } from './routes/Settings/SettingsPage'
import { PurchaseAnalysisPage } from './routes/PurchaseAnalysis/PurchaseAnalysisPage'
import { ProfilePage } from './routes/Profile/ProfilePage'
import { ImportBggPage } from './routes/Profile/ImportBggPage'
import { LoansPage } from './routes/Loans/LoansPage'
import { EditionUpgradesPage } from './routes/EditionUpgrades/EditionUpgradesPage'
import { SuggestionsPage } from './routes/Suggestions/SuggestionsPage'
import { CollectionRecapPage } from './routes/Recap/CollectionRecapPage'
import { ScanPage } from './routes/Scan/ScanPage'
import { AnalysisHistoryPage } from './routes/PurchaseAnalysis/AnalysisHistoryPage'
import { AnalysisHistoryDetailPage } from './routes/PurchaseAnalysis/AnalysisHistoryDetailPage'

/** /public/wishlist/:token vit hors AppShell (voir SharedWishlistPage) :
 * quelqu'un qui ouvre un lien de partage n'a pas de compte et ne doit
 * jamais voir la barre d'onglets privée ni pouvoir y naviguer. Tout le
 * reste de l'app reste dans AppShell, inchangé. */
export default function App() {
  return (
    <Routes>
      <Route path="/public/wishlist/:token" element={<SharedWishlistPage />} />
      <Route
        path="/*"
        element={
          <AppShell>
            <Routes>
              <Route path="/" element={<ShelfPage />} />
              <Route path="/add" element={<QuickAddPage />} />
              <Route path="/entity/:id" element={<EntityDetailPage />} />
              <Route path="/purchase-analysis" element={<PurchaseAnalysisPage />} />
              <Route path="/purchase-analysis/history" element={<AnalysisHistoryPage />} />
              <Route path="/purchase-analysis/history/:id" element={<AnalysisHistoryDetailPage />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/import-bgg" element={<ImportBggPage />} />
              <Route path="/loans" element={<LoansPage />} />
              <Route path="/edition-upgrades" element={<EditionUpgradesPage />} />
              <Route path="/suggestions" element={<SuggestionsPage />} />
              <Route path="/recap" element={<CollectionRecapPage />} />
              <Route path="/scan" element={<ScanPage />} />
              <Route path="/wishlist" element={<WishlistPage />} />
              <Route path="/stats" element={<StatsPage />} />
              <Route path="/types" element={<EntityTypesPage />} />
              <Route path="/types/new" element={<EntityTypeFormPage mode="create" />} />
              <Route path="/types/:id/edit" element={<EntityTypeFormPage mode="edit" />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Routes>
          </AppShell>
        }
      />
    </Routes>
  )
}
