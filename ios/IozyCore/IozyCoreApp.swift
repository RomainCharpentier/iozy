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

/// Navigation par onglets, un onglet par parcours utilisateur validé en
/// conception (étape 5) : Étagères (accueil, mode "vitrine"), Recherche
/// (parcours 3), Ajout rapide (parcours 1), Wishlist, Statistiques (UC6).
/// Thème forcé en sombre (direction visuelle validée) plutôt que de suivre
/// le réglage système - identité de marque assumée, pas un simple mode nuit.
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
        }
        .tint(Theme.accent)
    }
}
