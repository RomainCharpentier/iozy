import { Route, Routes } from 'react-router-dom'
import { AppShell } from './components/layout/AppShell'
import { ShelfPage } from './routes/Shelf/ShelfPage'
import { SearchPage } from './routes/Search/SearchPage'
import { QuickAddPage } from './routes/QuickAdd/QuickAddPage'
import { EntityDetailPage } from './routes/EntityDetail/EntityDetailPage'
import { WishlistPage } from './routes/Wishlist/WishlistPage'
import { StatsPage } from './routes/Stats/StatsPage'
import { EntityTypesPage } from './routes/EntityTypes/EntityTypesPage'
import { EntityTypeFormPage } from './routes/EntityTypes/EntityTypeFormPage'

export default function App() {
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<ShelfPage />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/add" element={<QuickAddPage />} />
        <Route path="/entity/:id" element={<EntityDetailPage />} />
        <Route path="/wishlist" element={<WishlistPage />} />
        <Route path="/stats" element={<StatsPage />} />
        <Route path="/types" element={<EntityTypesPage />} />
        <Route path="/types/new" element={<EntityTypeFormPage mode="create" />} />
        <Route path="/types/:id/edit" element={<EntityTypeFormPage mode="edit" />} />
      </Routes>
    </AppShell>
  )
}
