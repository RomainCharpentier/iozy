import SwiftUI
import SwiftData

@main
struct IozyCoreApp: App {
    var body: some Scene {
        WindowGroup {
            RootTabView()
                .preferredColorScheme(.dark)
        }
        .modelContainer(for: [
            EntityRecord.self,
            VariantRecord.self,
            OwnershipRecord.self,
            ExperienceRecord.self,
            WishlistEntryRecord.self,
            EntityTypeRecord.self
        ])
    }
}

/// Tab navigation, one tab for each user journey validated during
/// design (step 5): Shelves (home, "showcase" mode), Search
/// (journey 3), Quick add (journey 1), Wishlist, Statistics (UC6).
/// Theme forced to dark (validated visual direction) instead of following
/// the system setting - a deliberate brand identity, not a simple night mode.
struct RootTabView: View {
    init() {
        let appearance = UITabBarAppearance()
        appearance.configureWithOpaqueBackground()
        appearance.backgroundColor = UIColor(Theme.surface)
        UITabBar.appearance().standardAppearance = appearance
        UITabBar.appearance().scrollEdgeAppearance = appearance
    }

    var body: some View {
        TabView {
            ShelfView()
                .tabItem { Label("Étagères", systemImage: "square.grid.2x2") }

            SearchView()
                .tabItem { Label("Recherche", systemImage: "magnifyingglass") }

            QuickAddView()
                .tabItem { Label("Ajouter", systemImage: "plus.circle") }

            WishlistView()
                .tabItem { Label("Wishlist", systemImage: "star") }

            StatsView()
                .tabItem { Label("Stats", systemImage: "chart.bar") }

            SettingsView()
                .tabItem { Label("Réglages", systemImage: "globe") }
        }
        .tint(Theme.accent)
    }
}
