import SwiftUI
import SwiftData

/// Journey 4 ("browse your shelves", step 5): "showcase" mode,
/// grid of covers, free navigation with no active filter by default.
/// Validated visual direction: grid of gradient covers like
/// Letterboxd/Spotify, dark background, bright accent - instead of book
/// spines like a physical shelf (first direction tried, dropped).
struct ShelfView: View {
    @Environment(\.modelContext) private var modelContext
    @Query(sort: \EntityRecord.title) private var entities: [EntityRecord]
    @Query(sort: \EntityTypeRecord.label) private var entityTypes: [EntityTypeRecord]
    @State private var selectedTypeId: UUID?
    @State private var sortOrder: ShelfSortOrder = .recentlyAdded
    @State private var showingBggImport = false

    enum ShelfSortOrder: String, CaseIterable, Identifiable {
        case recentlyAdded = "Ajoutés récemment"
        case random = "Au hasard"
        var id: String { rawValue }
    }

    private let columns = [GridItem(.flexible(), spacing: 10), GridItem(.flexible(), spacing: 10), GridItem(.flexible(), spacing: 10)]

    private var displayedEntities: [EntityRecord] {
        var result = selectedTypeId == nil ? entities : entities.filter { $0.entityTypeId == selectedTypeId }
        if sortOrder == .random {
            result.shuffle()
        }
        return result
    }

    /// Generalized into one count per type instead of the original fixed
    /// "Mangas/Jeux" bucket (only made sense with exactly 3 hard-coded
    /// types) - a type with no Entity at all does not appear.
    private var countsByType: [(type: EntityTypeRecord, count: Int)] {
        entityTypes.compactMap { type in
            let count = entities.filter { $0.entityTypeId == type.id }.count
            return count > 0 ? (type, count) : nil
        }
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    header
                    filterChips
                    statsRow
                    grid
                }
                .padding(.horizontal, 20)
                .padding(.top, 8)
            }
            .background(Theme.background)
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(Theme.background, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .navigationDestination(for: UUID.self) { entityId in
                EntityDetailView(entityId: entityId)
            }
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Menu {
                        Button("Tous les types") { selectedTypeId = nil }
                        ForEach(entityTypes) { type in
                            Button(type.label) { selectedTypeId = type.id }
                        }
                    } label: {
                        Label("Filtrer", systemImage: "line.3.horizontal.decrease.circle")
                    }
                }
                ToolbarItem(placement: .topBarTrailing) {
                    NavigationLink {
                        EntityTypeListView()
                    } label: {
                        Label("Gérer les types", systemImage: "slider.horizontal.3")
                    }
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        showingBggImport = true
                    } label: {
                        Label("Importer depuis BGG", systemImage: "square.and.arrow.down")
                    }
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Picker("Tri", selection: $sortOrder) {
                        ForEach(ShelfSortOrder.allCases) { order in
                            Text(order.rawValue).tag(order)
                        }
                    }
                }
            }
            .sheet(isPresented: $showingBggImport) {
                BggImportSheet { insertNewlyImportedBoardGames() }
            }
            .task {
                await EntityTypeRecord.syncFromServer(modelContext: modelContext, existing: entityTypes)
            }
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("TA COLLECTION")
                .font(Theme.bodySemibold(12))
                .foregroundStyle(Theme.accent)
                .tracking(0.5)
            Text("\(entities.count) pépites,\nbien rangées.")
                .font(Theme.display(30))
                .foregroundStyle(Theme.textPrimary)
                .lineSpacing(2)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(.bottom, 18)
    }

    private var filterChips: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                Button { selectedTypeId = nil } label: {
                    Chip(label: "Tout", isActive: selectedTypeId == nil)
                }
                ForEach(entityTypes) { type in
                    Button { selectedTypeId = type.id } label: {
                        Chip(label: type.label, isActive: selectedTypeId == type.id)
                    }
                }
            }
        }
        .padding(.bottom, 18)
    }

    private var statsRow: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 10) {
                StatCard(value: "\(entities.count)", label: "Au total")
                ForEach(countsByType, id: \.type.id) { entry in
                    StatCard(value: "\(entry.count)", label: entry.type.label)
                }
            }
        }
        .padding(.bottom, 22)
    }

    private var grid: some View {
        LazyVGrid(columns: columns, spacing: 10) {
            ForEach(displayedEntities) { entity in
                NavigationLink(value: entity.id) {
                    CoverTile(title: entity.title, imageURL: CoverImage.url(fromAttributesJSON: entity.attributesJSON))
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.bottom, 20)
    }

    /// After a successful BGG import on the server side, reloads all the board
    /// games to discover the new ones (and insert them into the local
    /// cache) - the import response only contains counters, not
    /// the detail of the Entities created.
    private func insertNewlyImportedBoardGames() {
        // Resolved by a well-known code rather than a fixed uuid (see
        // resolveTypeId on the backend side) - the BGG import stays intrinsically
        // tied to the "board game" type, whatever its real id.
        guard let boardGameTypeId = entityTypes.first(where: { $0.code == "BOARD_GAME" })?.id else {
            return
        }
        Task {
            guard let allBoardGames = try? await APIClient.shared.fetchAllEntities(entityTypeId: boardGameTypeId) else {
                return
            }
            await MainActor.run {
                let existingIds = Set(entities.map(\.id))
                for dto in allBoardGames where !existingIds.contains(dto.id) {
                    modelContext.insert(EntityRecord(
                        id: dto.id, entityTypeId: dto.entityTypeId, title: dto.title, attributesJSON: "{}"))
                }
            }
        }
    }
}

/// Bulk import of the BGG collection of a user (games marked
/// "owned"). Can take several seconds on the server side (BGG sometimes
/// answers 202 while it prepares the export, handled with a retry on the
/// backend side) - hence the explicit progress indicator instead of a
/// simple button that would seem to do nothing.
private struct BggImportSheet: View {
    let onImported: () -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var username: String = ""
    @State private var isImporting = false
    @State private var result: APIClient.BggImportResult?
    @State private var errorMessage: String?

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("Pseudo BGG", text: $username)
                        .textInputAutocapitalization(.never)
                        .disableAutocorrection(true)
                } footer: {
                    Text("Importe uniquement les jeux marqués \"possédés\" sur BoardGameGeek. Peut prendre quelques secondes.")
                }

                if isImporting {
                    Section {
                        HStack {
                            ProgressView()
                            Text("Import en cours...")
                        }
                    }
                }

                if let result {
                    Section("Résultat") {
                        LabeledContent("Trouvés", value: "\(result.totalFound)")
                        LabeledContent("Nouveaux", value: "\(result.created)")
                        LabeledContent("Déjà connus", value: "\(result.matchedExisting)")
                        if result.failed > 0 {
                            LabeledContent("Échecs", value: "\(result.failed)")
                        }
                    }
                }

                if let errorMessage {
                    Text(errorMessage).foregroundStyle(.red).font(.caption)
                }
            }
            .navigationTitle("Import BGG")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(result == nil ? "Annuler" : "Fermer") { dismiss() }
                }
                if result == nil {
                    ToolbarItem(placement: .confirmationAction) {
                        Button("Importer") { startImport() }
                            .disabled(username.trimmingCharacters(in: .whitespaces).isEmpty || isImporting)
                    }
                }
            }
        }
    }

    private func startImport() {
        isImporting = true
        errorMessage = nil
        Task {
            do {
                let importResult = try await APIClient.shared.importBggCollection(username: username)
                await MainActor.run {
                    result = importResult
                    isImporting = false
                    onImported()
                }
            } catch {
                await MainActor.run {
                    errorMessage = "Échec de l'import : \(error.localizedDescription)"
                    isImporting = false
                }
            }
        }
    }
}
