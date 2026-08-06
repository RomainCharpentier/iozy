import SwiftUI
import SwiftData

/// Parcours 4 ("feuilleter ses étagères", étape 5) : mode "vitrine",
/// grille de couvertures, navigation libre sans filtre actif par défaut.
/// Direction visuelle validée : grille de couvertures en dégradé façon
/// Letterboxd/Spotify, fond sombre, accent vif - plutôt que des dos de
/// livres façon étagère physique (première direction essayée, écartée).
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

    /// Généralisé en un compte par type plutôt que le bucket fixe
    /// "Mangas/Jeux" d'origine (n'avait de sens qu'avec exactement 3 types
    /// codés en dur) - un type sans aucune Entity n'apparaît pas.
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
                    CoverTile(title: entity.title)
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.bottom, 20)
    }

    /// Après un import BGG réussi côté serveur, recharge tous les jeux de
    /// société pour découvrir les nouveaux (et les insérer dans le cache
    /// local) - la réponse de l'import ne contient que des compteurs, pas
    /// le détail des Entity créées.
    private func insertNewlyImportedBoardGames() {
        // Résolu par code bien connu plutôt qu'un uuid figé (voir
        // resolveTypeId côté backend) - l'import BGG reste intrinsèquement
        // lié au type "jeu de société", quel que soit son id réel.
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

/// Import en masse de la collection BGG d'un utilisateur (jeux marqués
/// "possédés"). Peut prendre plusieurs secondes côté serveur (BGG répond
/// parfois 202 le temps de préparer l'export, géré avec retry côté
/// backend) - d'où l'indicateur de progression explicite plutôt qu'un
/// simple bouton qui semblerait ne rien faire.
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
