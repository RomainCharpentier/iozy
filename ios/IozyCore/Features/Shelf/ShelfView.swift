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
    @State private var selectedType: EntityTypeMVP?
    @State private var sortOrder: ShelfSortOrder = .recentlyAdded
    @State private var showingBggImport = false

    enum ShelfSortOrder: String, CaseIterable, Identifiable {
        case recentlyAdded = "Ajoutés récemment"
        case random = "Au hasard"
        var id: String { rawValue }
    }

    private let columns = [GridItem(.flexible(), spacing: 10), GridItem(.flexible(), spacing: 10), GridItem(.flexible(), spacing: 10)]

    private var displayedEntities: [EntityRecord] {
        var result = selectedType == nil ? entities : entities.filter { $0.entityType == selectedType }
        if sortOrder == .random {
            result.shuffle()
        }
        return result
    }

    private var mangaCount: Int { entities.filter { $0.entityType == .manga }.count }
    private var gameCount: Int { entities.filter { $0.entityType == .videoGame || $0.entityType == .boardGame }.count }

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
                        Button("Tous les types") { selectedType = nil }
                        ForEach(EntityTypeMVP.allCases) { type in
                            Button(type.label) { selectedType = type }
                        }
                    } label: {
                        Label("Filtrer", systemImage: "line.3.horizontal.decrease.circle")
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
                Button { selectedType = nil } label: {
                    Chip(label: "Tout", isActive: selectedType == nil)
                }
                ForEach(EntityTypeMVP.allCases) { type in
                    Button { selectedType = type } label: {
                        Chip(label: type.label, isActive: selectedType == type)
                    }
                }
            }
        }
        .padding(.bottom, 18)
    }

    private var statsRow: some View {
        HStack(spacing: 10) {
            StatCard(value: "\(entities.count)", label: "Au total")
            StatCard(value: "\(mangaCount)", label: "Mangas")
            StatCard(value: "\(gameCount)", label: "Jeux")
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
        Task {
            guard let allBoardGames = try? await APIClient.shared.fetchAllEntities(entityTypeId: EntityTypeMVP.boardGame.uuid) else {
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
