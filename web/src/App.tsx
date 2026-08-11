import { Route, Routes } from 'react-router-dom'
import { AppShell } from './components/layout/AppShell'
import { ShelfPage } from './routes/Shelf/ShelfPage'
import { QuickAddPage } from './routes/QuickAdd/QuickAddPage'
import { EntityDetailPage } from './routes/EntityDetail/EntityDetailPage'
import { WishlistPage } from './routes/Wishlist/WishlistPage'
import { StatsPage } from './routes/Stats/StatsPage'
import { EntityTypesPage } from './routes/EntityTypes/EntityTypesPage'
import { EntityTypeFormPage } from './routes/EntityTypes/EntityTypeFormPage'
import { SettingsPage } from './routes/Settings/SettingsPage'
import { PurchaseAnalysisPage } from './routes/PurchaseAnalysis/PurchaseAnalysisPage'
import { ProfilePage } from './routes/Profile/ProfilePage'
import { LoansPage } from './routes/Loans/LoansPage'
import { EditionUpgradesPage } from './routes/EditionUpgrades/EditionUpgradesPage'
import { SuggestionsPage } from './routes/Suggestions/SuggestionsPage'
import { CollectionRecapPage } from './routes/Recap/CollectionRecapPage'

export default function App() {
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<ShelfPage />} />
        <Route path="/add" element={<QuickAddPage />} />
        <Route path="/entity/:id" element={<EntityDetailPage />} />
        <Route path="/purchase-analysis" element={<PurchaseAnalysisPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/loans" element={<LoansPage />} />
        <Route path="/edition-upgrades" element={<EditionUpgradesPage />} />
        <Route path="/suggestions" element={<SuggestionsPage />} />
        <Route path="/recap" element={<CollectionRecapPage />} />
        <Route path="/wishlist" element={<WishlistPage />} />
        <Route path="/stats" element={<StatsPage />} />
        <Route path="/types" element={<EntityTypesPage />} />
        <Route path="/types/new" element={<EntityTypeFormPage mode="create" />} />
        <Route path="/types/:id/edit" element={<EntityTypeFormPage mode="edit" />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Routes>
    </AppShell>
  )
}
