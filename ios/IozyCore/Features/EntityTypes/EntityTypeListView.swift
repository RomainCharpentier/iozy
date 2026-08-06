import SwiftUI
import SwiftData

/// Éditeur de types dynamique : liste des catégories de la collection
/// (les 3 types MVP historiques + tout type créé par l'utilisateur).
/// Accessible depuis un bouton toolbar sur ShelfView (même emplacement
/// que "Importer depuis BGG"), poussé plutôt que présenté en sheet vu
/// l'ampleur de l'écran (liste + formulaire de création/édition).
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

    /// Le backend bloque (409) la suppression d'un type encore utilisé par
    /// au moins une Entity - même garde-fou que la suppression d'une
    /// Entity elle-même (voir EntityTypeDeletionNotAllowedException).
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
