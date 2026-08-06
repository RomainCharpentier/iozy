import SwiftUI
import SwiftData

/// UC5 - Gérer la Wishlist. Complète le parcours 3 (une Entity "en
/// wishlist" détectée lors d'une recherche peut être consultée ici).
struct WishlistView: View {
    @Query private var wishlistEntries: [WishlistEntryRecord]
    @Query private var entities: [EntityRecord]

    private func entity(for entry: WishlistEntryRecord) -> EntityRecord? {
        entities.first { $0.id == entry.entityId }
    }

    var body: some View {
        NavigationStack {
            List(wishlistEntries.sorted(by: { $0.addedAt > $1.addedAt })) { entry in
                if let entity = entity(for: entry) {
                    NavigationLink(value: entity.id) {
                        HStack(spacing: 12) {
                            CoverTile(title: entity.title)
                                .frame(width: 44)
                            VStack(alignment: .leading, spacing: 3) {
                                Text(entity.title).font(Theme.bodySemibold(15)).foregroundStyle(Theme.textPrimary)
                                if let type = entity.entityType {
                                    Text(type.label).font(Theme.body(12)).foregroundStyle(Theme.textDim)
                                }
                            }
                        }
                        .padding(.vertical, 4)
                    }
                    .listRowBackground(Theme.background)
                }
            }
            .scrollContentBackground(.hidden)
            .background(Theme.background)
            .navigationTitle("Wishlist")
            .toolbarBackground(Theme.background, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .navigationDestination(for: UUID.self) { entityId in
                EntityDetailView(entityId: entityId)
            }
            .overlay {
                if wishlistEntries.isEmpty {
                    ContentUnavailableView(
                        "Wishlist vide",
                        systemImage: "star",
                        description: Text("Les éléments désirés apparaîtront ici")
                    )
                }
            }
        }
    }
}
