import { Route, Routes } from 'react-router-dom'
import { AppShell } from './components/layout/AppShell'
import { ShelfPage } from './routes/Shelf/ShelfPage'
import { SearchPage } from './routes/Search/SearchPage'
import { QuickAddPage } from './routes/QuickAdd/QuickAddPage'
import { EntityDetailPage } from './routes/EntityDetail/EntityDetailPage'
import { WishlistPage } from './routes/Wishlist/WishlistPage'
import { StatsPage } from './routes/Stats/StatsPage'

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
      </Routes>
    </AppShell>
  )
}
