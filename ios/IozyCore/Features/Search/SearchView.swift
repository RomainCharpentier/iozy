import SwiftUI
import SwiftData

/// Parcours 3 ("le décideur avant achat", étape 5) : recherche
/// instantanée transversale (UC4) sur la vraie collection côté serveur,
/// avec repli automatique sur le cache local si le réseau est indisponible
/// (le parcours doit fonctionner hors ligne, comme validé en conception).
struct SearchView: View {
    @Environment(\.modelContext) private var modelContext
    @Query private var cachedEntities: [EntityRecord]
    @Query private var entityTypes: [EntityTypeRecord]
    @State private var query: String = ""
    @State private var onlineStatus: APIClient.LookupStatus?
    @State private var isChecking = false

    @State private var serverResults: [SearchResultItem]?
    @State private var isSearchingServer = false
    @State private var isOffline = false
    @State private var searchTask: Task<Void, Never>?

    private struct SearchResultItem: Identifiable {
        let id: UUID
        let title: String
        let entityTypeId: UUID
    }

    /// Résultats affichés : ceux du serveur s'ils ont pu être récupérés
    /// (source de vérité complète), sinon un filtre sur le cache local de
    /// l'appareil (dégradation gracieuse hors ligne).
    private var displayedResults: [SearchResultItem] {
        guard !query.isEmpty else { return [] }
        if let serverResults {
            return serverResults
        }
        return cachedEntities
            .filter { $0.title.localizedCaseInsensitiveContains(query) }
            .map { SearchResultItem(id: $0.id, title: $0.title, entityTypeId: $0.entityTypeId) }
    }

    var body: some View {
        NavigationStack {
            List {
                ForEach(displayedResults) { item in
                    Button {
                        checkOnlineStatus(for: item)
                    } label: {
                        VStack(alignment: .leading, spacing: 3) {
                            Text(item.title).font(Theme.bodySemibold(15)).foregroundStyle(Theme.textPrimary)
                            if let type = EntityTypeRecord.find(id: item.entityTypeId, in: entityTypes) {
                                Text(type.label).font(Theme.body(12)).foregroundStyle(Theme.textDim)
                            }
                        }
                    }
                    .listRowBackground(Theme.surface)
                }

                if !query.isEmpty && displayedResults.isEmpty && !isSearchingServer {
                    ContentUnavailableView(
                        "Inconnu de ta collection",
                        systemImage: "questionmark.circle",
                        description: Text("Aucun résultat pour « \(query) »")
                    )
                    .listRowBackground(Color.clear)
                }

                if isOffline {
                    Section {
                        Label("Hors ligne — résultats du cache local uniquement", systemImage: "wifi.slash")
                            .font(Theme.body(12))
                            .foregroundStyle(Theme.textDim)
                    }
                    .listRowBackground(Theme.surface)
                }

                if let onlineStatus {
                    Section("Statut") {
                        statusLabel(for: onlineStatus)
                    }
                    .listRowBackground(Theme.surface)
                }
            }
            .scrollContentBackground(.hidden)
            .background(Theme.background)
            .searchable(text: $query, prompt: "Rechercher dans ta collection...")
            .onChange(of: query) { _, newValue in
                triggerServerSearch(for: newValue)
            }
            .navigationTitle("Recherche")
            .toolbarBackground(Theme.background, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .overlay {
                if isChecking || isSearchingServer {
                    ProgressView().tint(Theme.accent)
                }
            }
            .task {
                await EntityTypeRecord.syncFromServer(modelContext: modelContext, existing: entityTypes)
            }
        }
    }

    /// Recherche débouncée (300ms) côté serveur - la vraie recherche
    /// transversale (UC4), pas juste un filtre sur ce qui est déjà en cache.
    private func triggerServerSearch(for newQuery: String) {
        searchTask?.cancel()
        onlineStatus = nil

        guard !newQuery.trimmingCharacters(in: .whitespaces).isEmpty else {
            serverResults = nil
            isOffline = false
            return
        }

        searchTask = Task {
            try? await Task.sleep(for: .milliseconds(300))
            guard !Task.isCancelled else { return }

            isSearchingServer = true
            do {
                let results = try await APIClient.shared.searchEntities(query: newQuery)
                await MainActor.run {
                    serverResults = results.map { SearchResultItem(id: $0.id, title: $0.title, entityTypeId: $0.entityTypeId) }
                    isOffline = false
                    isSearchingServer = false
                }
            } catch {
                await MainActor.run {
                    // Échec réseau : on bascule sur le cache local (voir displayedResults)
                    // plutôt que de laisser l'écran vide - c'est le comportement
                    // hors ligne attendu du parcours 3.
                    serverResults = nil
                    isOffline = true
                    isSearchingServer = false
                }
            }
        }
    }

    @ViewBuilder
    private func statusLabel(for status: APIClient.LookupStatus) -> some View {
        switch status {
        case .owned:
            Label("Déjà possédé", systemImage: "checkmark.seal.fill").foregroundStyle(Theme.accent)
        case .wishlisted:
            Label("Dans ta wishlist", systemImage: "star.fill").foregroundStyle(Theme.violet)
        case .unknown:
            Label("Pas encore dans ta base", systemImage: "plus.circle").foregroundStyle(Theme.textDim)
        }
    }

    private func checkOnlineStatus(for item: SearchResultItem) {
        isChecking = true
        Task {
            let status = try? await APIClient.shared.lookup(entityId: item.id)
            await MainActor.run {
                onlineStatus = status
                isChecking = false
            }
        }
    }
}
