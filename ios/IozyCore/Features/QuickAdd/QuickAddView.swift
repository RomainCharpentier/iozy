import SwiftUI
import SwiftData

/// Parcours 1 ("le collectionneur pressé", étape 5 de la conception) :
/// interface minimaliste, un seul CTA, pensée pour être utilisée en
/// magasin en moins de 5 secondes.
///
/// Intègre la recherche de métadonnées (module Metadata Enrichment,
/// Jikan pour les mangas / BGG pour les jeux de société / IGDB pour les
/// jeux vidéo) : taper un titre déclenche une recherche, un candidat
/// choisi pré-remplit le titre et transmet ses attributs à l'ajout rapide
/// sans ressaisie.
struct QuickAddView: View {
    @Environment(\.modelContext) private var modelContext
    @Query(sort: \EntityTypeRecord.label) private var entityTypes: [EntityTypeRecord]
    @State private var selectedTypeId: UUID?
    @State private var title: String = ""
    @State private var condition: String = "NEW"
    @State private var isSubmitting = false
    @State private var errorMessage: String?
    @State private var lastAddedMessage: String?
    @State private var showingScanner = false

    @State private var candidates: [MetadataCandidateDTO] = []
    @State private var selectedCandidateAttributes: [String: String] = [:]
    @State private var searchTask: Task<Void, Never>?
    // Retour visuel pendant/après la recherche de métadonnées (Jikan/BGG/
    // IGDB) - sans ça, une recherche qui ne trouve rien (fournisseur en
    // panne, pas de correspondance...) est invisible et donne l'impression
    // qu'aucune recherche n'a lieu, contrairement au scan code-barres qui
    // affiche toujours un résultat explicite.
    @State private var isSearching = false
    @State private var searchCompletedWithNoResults = false
    @State private var searchFailed = false

    /// Type sélectionné, ou le premier de la liste chargée par défaut - les
    /// types ne sont plus codés en dur, la liste peut être vide un court
    /// instant au tout premier lancement (avant la première synchronisation).
    private var selectedType: EntityTypeRecord? {
        guard let selectedTypeId else { return entityTypes.first }
        return entityTypes.first { $0.id == selectedTypeId } ?? entityTypes.first
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    if entityTypes.isEmpty {
                        Text("Chargement des types...")
                            .foregroundStyle(Theme.textDim)
                    } else {
                        Picker("Type", selection: Binding(
                            get: { selectedType?.id },
                            set: { selectedTypeId = $0 }
                        )) {
                            ForEach(entityTypes) { type in
                                Label(type.label, systemImage: Theme.icon(for: type.code)).tag(Optional(type.id))
                            }
                        }
                        .pickerStyle(.segmented)
                        .onChange(of: selectedTypeId) { _, _ in triggerSearch() }
                    }

                    HStack {
                        TextField("Titre", text: $title)
                            .textInputAutocapitalization(.words)
                            .onChange(of: title) { _, _ in
                                selectedCandidateAttributes = [:]  // le titre a été retouché manuellement
                                triggerSearch()
                            }
                        Button {
                            showingScanner = true
                        } label: {
                            Image(systemName: "barcode.viewfinder")
                        }
                    }

                    if isSearching {
                        Text("Recherche...")
                            .font(.caption)
                            .foregroundStyle(Theme.textDim)
                    } else if searchFailed {
                        Text("La recherche de métadonnées a échoué.")
                            .font(.caption)
                            .foregroundStyle(Theme.textDim)
                    } else if searchCompletedWithNoResults {
                        Text("Aucun résultat pour ce titre.")
                            .font(.caption)
                            .foregroundStyle(Theme.textDim)
                    }

                    Picker("État", selection: $condition) {
                        Text("Neuf").tag("NEW")
                        Text("Occasion").tag("USED")
                        Text("Abîmé").tag("DAMAGED")
                    }
                }

                if !candidates.isEmpty {
                    Section("Suggestions (Jikan / BGG / IGDB)") {
                        ForEach(candidates) { candidate in
                            Button {
                                selectCandidate(candidate)
                            } label: {
                                VStack(alignment: .leading) {
                                    Text(candidate.title).foregroundStyle(.primary)
                                    Text(candidate.source).font(.caption).foregroundStyle(.secondary)
                                }
                            }
                        }
                    }
                }

                if !selectedCandidateAttributes.isEmpty {
                    Section("Attributs pré-remplis") {
                        ForEach(selectedCandidateAttributes.sorted(by: { $0.key < $1.key }), id: \.key) { key, value in
                            LabeledContent(key, value: value)
                        }
                    }
                }

                if let lastAddedMessage {
                    Section {
                        Label(lastAddedMessage, systemImage: "checkmark.circle.fill")
                            .foregroundStyle(Theme.accent)
                    }
                }

                if let errorMessage {
                    Section {
                        Text(errorMessage).foregroundStyle(.red)
                    }
                }
            }
            .navigationTitle("Ajout rapide")
            .scrollContentBackground(.hidden)
            .background(Theme.background)
            .toolbarBackground(Theme.background, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .safeAreaInset(edge: .bottom) {
                Button(action: submit) {
                    Text("Ajouter")
                        .font(Theme.bodySemibold(16))
                        .foregroundStyle(Theme.accentText)
                        .frame(maxWidth: .infinity)
                        .padding()
                }
                .background(Theme.accent, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                .disabled(title.trimmingCharacters(in: .whitespaces).isEmpty || isSubmitting)
                .opacity(title.trimmingCharacters(in: .whitespaces).isEmpty || isSubmitting ? 0.5 : 1)
                .padding()
            }
            .sheet(isPresented: $showingScanner) {
                BarcodeScannerSheet { scannedCode in
                    handleScannedBarcode(scannedCode)
                }
            }
            .task {
                await EntityTypeRecord.syncFromServer(modelContext: modelContext, existing: entityTypes)
            }
        }
    }

    /// Recherche débouncée (300ms) pour ne pas spammer Jikan/BGG/IGDB à chaque frappe.
    private func triggerSearch() {
        searchTask?.cancel()
        candidates = []
        searchCompletedWithNoResults = false
        searchFailed = false
        guard let typeId = selectedType?.id else {
            isSearching = false
            return
        }
        let query = title
        guard query.trimmingCharacters(in: .whitespaces).count >= 2 else {
            isSearching = false
            return
        }

        isSearching = true
        searchTask = Task {
            try? await Task.sleep(for: .milliseconds(300))
            guard !Task.isCancelled else { return }
            do {
                let results = try await APIClient.shared.searchMetadata(entityTypeId: typeId, query: query)
                guard !Task.isCancelled else { return }
                await MainActor.run {
                    candidates = results
                    searchCompletedWithNoResults = results.isEmpty
                    isSearching = false
                }
            } catch {
                guard !Task.isCancelled else { return }
                await MainActor.run {
                    candidates = []
                    searchFailed = true
                    isSearching = false
                }
            }
        }
    }

    /// Tente un vrai lookup ISBN via Open Library (couvre le type MANGA
    /// uniquement, par son code bien connu - voir OpenLibraryBarcodeProvider
    /// côté backend). En cas d'échec ou de type non couvert, se rabat sur
    /// le code brut comme avant.
    private func handleScannedBarcode(_ code: String) {
        guard let type = selectedType, type.code == "MANGA" else {
            title = code
            return
        }
        Task {
            if let found = try? await APIClient.shared.lookupBarcode(entityTypeId: type.id, barcode: code) {
                await MainActor.run { selectCandidate(found) }
            } else {
                await MainActor.run { title = code }
            }
        }
    }

    private func selectCandidate(_ candidate: MetadataCandidateDTO) {
        title = candidate.title
        selectedCandidateAttributes = candidate.attributes.mapValues { $0.stringValue }
        candidates = []
        searchCompletedWithNoResults = false
        searchFailed = false
    }

    private func submit() {
        guard let typeId = selectedType?.id else { return }
        isSubmitting = true
        errorMessage = nil
        let submittedTitle = title
        let attributes = selectedCandidateAttributes

        Task {
            do {
                let result = try await APIClient.shared.quickAdd(
                    entityTypeId: typeId, title: submittedTitle, condition: condition, attributes: attributes)
                await MainActor.run {
                    // On n'insère un nouvel EntityRecord dans le cache local que si
                    // le backend a vraiment créé une nouvelle Entity - sinon on
                    // dupliquerait localement ce qui ne l'est pas côté serveur.
                    if !result.matchedExistingEntity {
                        let record = EntityRecord(
                            id: result.entityId,
                            entityTypeId: typeId,
                            title: submittedTitle,
                            attributesJSON: "{}"
                        )
                        modelContext.insert(record)
                    }

                    lastAddedMessage = result.matchedExistingEntity
                        ? "« \(submittedTitle) » — nouvel exemplaire ajouté à une fiche existante"
                        : "« \(submittedTitle) » ajouté"
                    title = ""
                    selectedCandidateAttributes = [:]
                    candidates = []
                    searchCompletedWithNoResults = false
                    searchFailed = false
                    isSubmitting = false
                }
            } catch {
                await MainActor.run {
                    errorMessage = "Échec de l'ajout : \(error.localizedDescription)"
                    isSubmitting = false
                }
            }
        }
    }
}
