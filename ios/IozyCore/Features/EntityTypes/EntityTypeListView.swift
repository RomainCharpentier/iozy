import SwiftUI
import SwiftData

/// Dynamic type editor: list of the categories of the collection
/// (the 3 historical MVP types + any type created by the user).
/// Reachable from a toolbar button on ShelfView (same place
/// as "Importer depuis BGG"), pushed rather than shown as a sheet given
/// the size of the screen (list + create/edit form).
struct EntityTypeListView: View {
    @Environment(\.modelContext) private var modelContext
    @Query(sort: \EntityTypeRecord.label) private var entityTypes: [EntityTypeRecord]

    @State private var errorMessage: String?

    var body: some View {
        List {
            if let errorMessage {
                Section {
                    Label(errorMessage, systemImage: "exclamationmark.triangle")
                        .foregroundStyle(.orange)
                        .font(.caption)
                }
            }
            ForEach(entityTypes) { type in
                NavigationLink {
                    EntityTypeFormView(mode: .edit(type))
                } label: {
                    HStack(spacing: 12) {
                        Image(systemName: Theme.icon(for: type.code))
                            .foregroundStyle(Theme.accent)
                            .frame(width: 24)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(type.label).foregroundStyle(Theme.textPrimary)
                            Text(type.code).font(.caption).foregroundStyle(Theme.textDim)
                        }
                    }
                }
                .listRowBackground(Theme.surface)
            }
            .onDelete(perform: delete)
        }
        .scrollContentBackground(.hidden)
        .background(Theme.background)
        .navigationTitle("Gérer les types")
        .toolbarBackground(Theme.background, for: .navigationBar)
        .toolbarColorScheme(.dark, for: .navigationBar)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                NavigationLink {
                    EntityTypeFormView(mode: .create)
                } label: {
                    Image(systemName: "plus")
                }
            }
        }
        .task {
            await EntityTypeRecord.syncFromServer(modelContext: modelContext, existing: entityTypes)
        }
    }

    /// The backend blocks (409) the deletion of a type still used by
    /// at least one Entity - same safeguard as the deletion of an
    /// Entity itself (see EntityTypeDeletionNotAllowedException).
    private func delete(at offsets: IndexSet) {
        errorMessage = nil
        for index in offsets {
            let type = entityTypes[index]
            Task {
                do {
                    try await APIClient.shared.deleteEntityType(id: type.id)
                    await MainActor.run { modelContext.delete(type) }
                } catch APIClient.APIError.serverError(let statusCode, _) where statusCode == 409 {
                    await MainActor.run {
                        errorMessage = "« \(type.label) » est encore utilisé par des éléments de ta collection - impossible à supprimer."
                    }
                } catch {
                    await MainActor.run {
                        errorMessage = "Échec de la suppression de « \(type.label) »."
                    }
                }
            }
        }
    }
}
