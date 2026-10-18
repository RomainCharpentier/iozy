import SwiftUI
import SwiftData

/// Journey 3 ("the decider before buying", step 5): instant
/// cross search (UC4) on the real collection on the server side,
/// with automatic fallback to the local cache if the network is unavailable
/// (the journey must work offline, as validated during design).
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

    /// Results shown: the server ones if they could be fetched
    /// (full source of truth), otherwise a filter on the local cache of
    /// the device (graceful degradation offline).
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

    /// Debounced search (300ms) on the server side - the real
    /// cross search (UC4), not just a filter on what is already cached.
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
                    // Network failure: we switch to the local cache (see displayedResults)
                    // instead of leaving the screen empty - this is the expected
                    // offline behavior of journey 3.
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
