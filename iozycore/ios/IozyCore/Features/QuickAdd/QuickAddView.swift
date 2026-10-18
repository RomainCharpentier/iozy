import SwiftUI
import SwiftData

/// Journey 1 ("the collector in a hurry", step 5 of the design):
/// minimal interface, a single CTA, made to be used
/// in a store in less than 5 seconds.
///
/// Includes the metadata search (Metadata Enrichment module,
/// Jikan for mangas / BGG for board games / IGDB for
/// video games): typing a title triggers a search, a chosen candidate
/// pre-fills the title and passes its attributes to the quick add
/// with no retyping.
struct QuickAddView: View {
    @Environment(\.modelContext) private var modelContext
    @Query(sort: \EntityTypeRecord.label) private var entityTypes: [EntityTypeRecord]
    @State private var selectedTypeId: UUID?
    @State private var title: String = ""
    @State private var condition: String = "NEW"
    // Reserved for Manga (see QuickAddService on the backend side): the title
    // identifies the SERIES, volumeNumber+edition identify the exact VOLUME
    // that is really added to the shelf - two distinct fields to avoid
    // mixing "I own Naruto" (false, nobody owns "the series" in
    // one block) and "I own volume 12 of Naruto, Kana edition" (what one
    // really owns).
    @State private var volumeNumberText: String = ""
    @State private var edition: String = ""
    // Queue of volumes typed manually (see queueManualVolume) -
    // lets us add SEVERAL before confirming (e.g. volumes 4 and 5
    // of a "Black Edition" both missing from the automatic search,
    // checked manually on "Death Note", see history):
    // without it, each missing volume required confirming the whole
    // form separately. volumeNumberText/edition above stay the
    // entry IN PROGRESS, not yet queued - a volume typed then confirmed
    // directly (without "+") is still handled as is by submit(), as before.
    @State private var manualVolumes: [ManualVolumeEntry] = []
    // Visual selection of owned volumes by cover art (see VolumeSelectionGrid,
    // like Mangacollec) - triggered after a Manga candidate is selected
    // (see triggerVolumeSearch). volumeNumberText/edition above stay
    // available as a manual fallback (volume not found by the search) and
    // combine with this selection when adding (see submit).
    @State private var volumeCandidates: [VolumeCandidateDTO] = []
    // Google Books quota exceeded on all configured keys during the
    // last search (see VolumesResponseDTO) - tells this case apart from a
    // series that really has no French edition.
    @State private var volumesQuotaExceeded = false
    @State private var isSearchingVolumes = false
    @State private var selectedVolumeIds: Set<String> = []
    @State private var showManualVolumeFields = false
    @State private var volumeSearchTask: Task<Void, Never>?
    // Debounce of the AUTOMATIC trigger of the volume search after
    // a candidate is selected (see selectCandidate) - avoids paying for the
    // Google Books requests for each candidate hovered/tapped quickly
    // before stopping on the right one. Never affects a
    // voluntary trigger ("Actualiser"/"Chercher plus d'éditions" buttons), always immediate.
    @State private var volumeSearchDebounceTask: Task<Void, Never>?
    // Title/author of the last volume search triggered - reused
    // by the "Actualiser" button (see triggerVolumeSearch) without choosing the
    // candidate again. Result stored durably on the backend side: without this button, a
    // result once found would never be refreshed automatically.
    @State private var lastVolumeSearchTitle: String?
    @State private var lastVolumeSearchAuthor: String?
    // Already known from the selected candidate (see selectCandidate) - let us
    // discard a known spin-off/side-story (see RelatedSeriesService on the
    // backend side), including on "Actualiser"/"Chercher plus d'éditions".
    @State private var lastVolumeSearchMalId: String?
    @State private var lastVolumeSearchOriginalTitle: String?
    @State private var lastVolumeSearchTitleRomaji: String?
    @State private var isSubmitting = false
    @State private var errorMessage: String?
    @State private var lastAddedMessage: String?
    @State private var showingScanner = false

    @State private var candidates: [MetadataCandidateDTO] = []
    @State private var selectedCandidateAttributes: [String: String] = [:]
    // Title from which `selectedCandidateAttributes` was filled - if the
    // title is edited manually after choosing a candidate, it is
    // considered stale (same rule as on the web side). Also used to know if the
    // current title is "verified" for the submit block below.
    @State private var verifiedTitle: String?
    @State private var searchTask: Task<Void, Never>?
    // Visual feedback during/after the metadata search (Jikan/BGG/
    // IGDB) - without it, a search that finds nothing (provider
    // down, no match...) is invisible and gives the impression
    // that no search takes place, unlike the barcode scan which
    // always shows an explicit result.
    @State private var isSearching = false
    @State private var searchCompletedWithNoResults = false
    @State private var searchFailed = false
    // Best-effort search of a French edition title after selecting
    // a Jikan/MyAnimeList candidate - see selectCandidate.
    @State private var isTranslatingTitle = false
    @State private var frenchTitleTask: Task<Void, Never>?
    // French titles already resolved for the LIST of suggestions (not
    // only the one we will end up choosing) - see triggerSearch, which
    // starts this resolution as soon as the candidates arrive, and
    // selectCandidate, which reuses the result without calling again.
    // Key = MetadataCandidateDTO.id ("source-externalId").
    @State private var frenchTitlesById: [String: String] = [:]
    @State private var frenchTitlesListTask: Task<Void, Never>?
    // User setting (see Réglages > Titre des mangas, TitleLanguagePreference.swift) -
    // if "Français" is not enabled in the composition, no search for a
    // French title is ever triggered (neither for the list nor at
    // selection): zero extra external calls. Simple @State (not @AppStorage,
    // TitleComposition not being a primitive type) reloaded each time
    // the tab appears (see .onAppear below) to reflect a
    // change made in the meantime in the Réglages tab.
    @State private var titleComposition: TitleComposition = TitleCompositionStore.load()

    /// Selected type, or the first of the loaded list by default - types
    /// are no longer hard-coded, the list can be empty for a short
    /// moment on the very first launch (before the first synchronization).
    private var selectedType: EntityTypeRecord? {
        guard let selectedTypeId else { return entityTypes.first }
        return entityTypes.first { $0.id == selectedTypeId } ?? entityTypes.first
    }

    /// A type with a provider (Manga/Video game/Board game) requires
    /// choosing a suggestion (search or barcode) before
    /// confirming - a custom type (never has a provider) stays in
    /// free entry, otherwise it would become permanently impossible to add
    /// anything to it.
    private var requiresMatch: Bool { selectedType?.hasMetadataProvider ?? false }
    private var hasVerifiedMatch: Bool { verifiedTitle != nil && verifiedTitle == title }
    /// `selectedCandidateAttributes` without the cover art (see CoverImage.attributeKey) -
    /// it is still sent to the backend but has no place in this
    /// "attribute: value" text list.
    private var displayedCandidateAttributes: [String: String] {
        selectedCandidateAttributes.filter { $0.key != CoverImage.attributeKey }
    }
    private var blockedByMissingMatch: Bool {
        requiresMatch && !title.trimmingCharacters(in: .whitespaces).isEmpty && !hasVerifiedMatch
    }
    /// Reflects exactly what submit() will submit - ticked covers
    /// + queue of manual volumes + manual entry IN PROGRESS if not empty, so
    /// that the label of the button ("Ajouter N tomes") never lies about
    /// what will really be added.
    private var totalVolumesToAdd: Int {
        selectedVolumeIds.count + manualVolumes.count
            + (volumeNumberText.trimmingCharacters(in: .whitespaces).isEmpty ? 0 : 1)
    }

    /// A manual volume already put in the queue (see queueManualVolume) -
    /// Identifiable for ForEach/individual deletion.
    private struct ManualVolumeEntry: Identifiable {
        let id = UUID()
        let volumeNumber: Int
        let edition: String
    }

    /// Adds the manual entry IN PROGRESS to the queue instead of
    /// adding it right away - lets us chain several manual volumes
    /// (e.g. V4 then V5 of the same edition) before confirming the form
    /// only once. The volume number is cleared for the next one, but the edition
    /// stays: consecutive manual volumes almost always share the
    /// same edition.
    private func queueManualVolume() {
        let trimmed = volumeNumberText.trimmingCharacters(in: .whitespaces)
        guard let parsed = Int(trimmed), parsed > 0 else { return }
        manualVolumes.append(ManualVolumeEntry(volumeNumber: parsed, edition: edition.trimmingCharacters(in: .whitespaces)))
        volumeNumberText = ""
    }

    private func removeManualVolume(_ id: UUID) {
        manualVolumes.removeAll { $0.id == id }
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
                            .onChange(of: title) { _, newValue in
                                if newValue != verifiedTitle {
                                    selectedCandidateAttributes = [:]  // the title was edited manually
                                    frenchTitleTask?.cancel()
                                    isTranslatingTitle = false
                                    // The selection of volumes/cover arts was resolved for
                                    // the old title - no guarantee anymore that it
                                    // still matches what is typed.
                                    volumeSearchTask?.cancel()
                                    volumeSearchDebounceTask?.cancel()
                                    volumeCandidates = []
                                    selectedVolumeIds = []
                                    manualVolumes = []
                                    isSearchingVolumes = false
                                    lastVolumeSearchTitle = nil
                                    lastVolumeSearchAuthor = nil
                                    lastVolumeSearchMalId = nil
                                    lastVolumeSearchOriginalTitle = nil
                                    lastVolumeSearchTitleRomaji = nil
                                }
                                triggerSearch()
                            }
                        Button {
                            showingScanner = true
                        } label: {
                            Image(systemName: "barcode.viewfinder")
                        }
                    }

                    if isSearching {
                        HStack(spacing: 6) {
                            ProgressView().controlSize(.mini)
                            Text("Recherche...")
                        }
                        .font(.caption)
                        .foregroundStyle(Theme.textDim)
                    } else if searchFailed {
                        Text("La recherche de métadonnées a échoué.")
                            .font(.caption)
                            .foregroundStyle(Theme.textDim)
                    }

                    if isTranslatingTitle {
                        HStack(spacing: 6) {
                            ProgressView().controlSize(.mini)
                            Text("Recherche du titre français...")
                        }
                        .font(.caption)
                        .foregroundStyle(Theme.textDim)
                    }

                    if searchCompletedWithNoResults {
                        Text("Aucun résultat pour ce titre.")
                            .font(.caption)
                            .foregroundStyle(Theme.textDim)
                    }

                    if blockedByMissingMatch {
                        Text("Ce type nécessite de choisir une suggestion ci-dessus (ou via le code-barres) avant de valider.")
                            .font(.caption)
                            .foregroundStyle(Theme.textDim)
                    }

                    Picker("État", selection: $condition) {
                        Text("Neuf").tag("NEW")
                        Text("Occasion").tag("USED")
                        Text("Abîmé").tag("DAMAGED")
                    }

                    if selectedType?.code == "MANGA" && isSearchingVolumes {
                        HStack(spacing: 6) {
                            ProgressView().controlSize(.mini)
                            Text("Recherche des tomes disponibles...")
                        }
                        .font(.caption)
                        .foregroundStyle(Theme.textDim)
                    }

                    if selectedType?.code == "MANGA" && volumeCandidates.isEmpty && volumesQuotaExceeded && !isSearchingVolumes {
                        VStack(alignment: .leading, spacing: 4) {
                            Label(
                                "Quota Google Books dépassé pour le moment - impossible de vérifier s'il existe des éditions françaises.",
                                systemImage: "exclamationmark.triangle"
                            )
                            .foregroundStyle(.orange)
                            if let lastVolumeSearchTitle {
                                Button("Réessayer") {
                                    triggerVolumeSearch(
                                        seriesTitle: lastVolumeSearchTitle, author: lastVolumeSearchAuthor, forceRefresh: true,
                                        malId: lastVolumeSearchMalId, originalTitle: lastVolumeSearchOriginalTitle,
                                        titleRomaji: lastVolumeSearchTitleRomaji)
                                }
                            }
                        }
                        .font(.caption)
                    }

                    if selectedType?.code == "MANGA" && (volumeCandidates.isEmpty || showManualVolumeFields) && !isSearchingVolumes {
                        HStack {
                            TextField("Tome n°", text: $volumeNumberText)
                                .keyboardType(.numberPad)
                            TextField("Édition (ex: Kana, Perfect Edition...)", text: $edition)
                                .textInputAutocapitalization(.words)
                            Button {
                                queueManualVolume()
                            } label: {
                                Image(systemName: "plus.circle.fill")
                            }
                            .disabled(volumeNumberText.trimmingCharacters(in: .whitespaces).isEmpty)
                        }
                        ForEach(manualVolumes) { manual in
                            HStack {
                                Text("T. \(manual.volumeNumber)" + (manual.edition.isEmpty ? "" : " · \(manual.edition)"))
                                    .font(.caption)
                                    .foregroundStyle(Theme.textDim)
                                Spacer()
                                Button {
                                    removeManualVolume(manual.id)
                                } label: {
                                    Image(systemName: "xmark.circle.fill")
                                        .foregroundStyle(.secondary)
                                }
                            }
                        }
                    }
                }

                if selectedType?.code == "MANGA" && !volumeCandidates.isEmpty {
                    Section(
                        selectedVolumeIds.isEmpty
                            ? "Tomes possédés"
                            : "Tomes possédés (\(selectedVolumeIds.count) sélectionné\(selectedVolumeIds.count > 1 ? "s" : ""))"
                    ) {
                        VolumeSelectionGrid(volumes: volumeCandidates, selectedIds: selectedVolumeIds) { volume in
                            if selectedVolumeIds.contains(volume.id) {
                                selectedVolumeIds.remove(volume.id)
                            } else {
                                selectedVolumeIds.insert(volume.id)
                            }
                        }
                        HStack {
                            if !showManualVolumeFields {
                                Button("+ Tome introuvable ci-dessus ? Ajouter manuellement") {
                                    showManualVolumeFields = true
                                }
                                .font(.caption)
                            }
                            Spacer()
                            if let lastVolumeSearchTitle {
                                Button {
                                    triggerVolumeSearch(
                                        seriesTitle: lastVolumeSearchTitle, author: lastVolumeSearchAuthor, deepSearch: true,
                                        malId: lastVolumeSearchMalId, originalTitle: lastVolumeSearchOriginalTitle,
                                        titleRomaji: lastVolumeSearchTitleRomaji)
                                } label: {
                                    Label("Chercher plus d'éditions", systemImage: "magnifyingglass")
                                }
                                .font(.caption)
                                .disabled(isSearchingVolumes)

                                Button {
                                    triggerVolumeSearch(
                                        seriesTitle: lastVolumeSearchTitle, author: lastVolumeSearchAuthor, forceRefresh: true,
                                        malId: lastVolumeSearchMalId, originalTitle: lastVolumeSearchOriginalTitle,
                                        titleRomaji: lastVolumeSearchTitleRomaji)
                                } label: {
                                    Label("Actualiser", systemImage: "arrow.clockwise")
                                }
                                .font(.caption)
                                .disabled(isSearchingVolumes)
                            }
                        }
                        if volumesQuotaExceeded && !isSearchingVolumes {
                            Label(
                                "Quota Google Books dépassé - la dernière action n'a pas pu aboutir, réessaie plus tard.",
                                systemImage: "exclamationmark.triangle"
                            )
                            .foregroundStyle(.orange)
                            .font(.caption)
                        }
                    }
                }

                if !candidates.isEmpty {
                    Section("Suggestions (Jikan / BGG / IGDB)") {
                        ForEach(candidates) { candidate in
                            Button {
                                selectCandidate(candidate)
                            } label: {
                                HStack(spacing: 10) {
                                    // Real cover art if the source provides one - helps
                                    // to visually tell apart identical/close titles
                                    // even before reading the subtitle.
                                    if let imageUrlString = candidate.imageUrl, let imageURL = URL(string: imageUrlString) {
                                        AsyncImage(url: imageURL) { phase in
                                            if let image = phase.image {
                                                image.resizable().aspectRatio(contentMode: .fill)
                                            } else {
                                                Color(.systemGray5)
                                            }
                                        }
                                        .frame(width: 36, height: 48)
                                        .clipShape(RoundedRectangle(cornerRadius: 6, style: .continuous))
                                    } else {
                                        RoundedRectangle(cornerRadius: 6, style: .continuous)
                                            .fill(Color(.systemGray5))
                                            .frame(width: 36, height: 48)
                                    }
                                    VStack(alignment: .leading) {
                                        Text(candidateDisplayTitle(candidate, frenchTitlesById[candidate.id])).foregroundStyle(.primary)
                                        Text(candidateSubtitle(candidate)).font(.caption).foregroundStyle(.secondary)
                                    }
                                }
                            }
                        }
                    }
                }

                if !displayedCandidateAttributes.isEmpty {
                    Section("Attributs pré-remplis") {
                        ForEach(displayedCandidateAttributes.sorted(by: { $0.key < $1.key }), id: \.key) { key, value in
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
                    Text(totalVolumesToAdd > 1 ? "Ajouter \(totalVolumesToAdd) tomes" : "Ajouter")
                        .font(Theme.bodySemibold(16))
                        .foregroundStyle(Theme.accentText)
                        .frame(maxWidth: .infinity)
                        .padding()
                }
                .background(Theme.accent, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                .disabled(
                    title.trimmingCharacters(in: .whitespaces).isEmpty || isSubmitting || blockedByMissingMatch
                        || isTranslatingTitle)
                .opacity(
                    title.trimmingCharacters(in: .whitespaces).isEmpty || isSubmitting || blockedByMissingMatch
                        || isTranslatingTitle ? 0.5 : 1)
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
            .onAppear {
                titleComposition = TitleCompositionStore.load()
            }
        }
    }

    /// Debounced search (500ms, minimum 3 characters) to not spam
    /// Jikan/MyAnimeList/BGG/IGDB on each keystroke - same setting as web
    /// (QuickAddPage.tsx) to limit the intermediate searches typed
    /// "in passing" before the word is finished (e.g. typing "naruto" without
    /// stopping should only trigger one request). `searchTask?.cancel()`
    /// + the `guard !Task.isCancelled` after the sleep already stop the
    /// network call itself from leaving for a search that became obsolete - the
    /// backend cache (see MetadataSearchService) absorbs the remaining
    /// residual cases.
    private func triggerSearch() {
        searchTask?.cancel()
        frenchTitlesListTask?.cancel()
        frenchTitlesById = [:]
        candidates = []
        searchCompletedWithNoResults = false
        searchFailed = false
        guard let typeId = selectedType?.id else {
            isSearching = false
            return
        }
        let query = title
        guard query.trimmingCharacters(in: .whitespaces).count >= 3 else {
            isSearching = false
            return
        }

        isSearching = true
        searchTask = Task {
            try? await Task.sleep(for: .milliseconds(500))
            guard !Task.isCancelled else { return }
            do {
                let results = try await APIClient.shared.searchMetadata(entityTypeId: typeId, query: query)
                guard !Task.isCancelled else { return }
                await MainActor.run {
                    candidates = results
                    searchCompletedWithNoResults = results.isEmpty
                    isSearching = false
                }
                resolveFrenchTitlesForList(results, entityTypeId: typeId)
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

    /// Resolves a French title for each Jikan/MyAnimeList suggestion
    /// displayed (not only the one we will end up choosing - see
    /// selectCandidate, which reuses these results without calling again).
    /// Capped to the first 6 suggestions to limit the number of external
    /// calls (up to ~5 Open Library requests in cascade per candidate -
    /// see OpenLibraryFrenchTitleProvider on the backend side, 24h cache behind);
    /// beyond that, the French title is searched at selection as before. The
    /// list is shown immediately in English/romaji and updates
    /// progressively candidate by candidate, without blocking the initial display.
    private func resolveFrenchTitlesForList(_ results: [MetadataCandidateDTO], entityTypeId: UUID) {
        guard TitleCompositionStore.isFrenchEnabled(titleComposition) else { return }
        frenchTitlesListTask = Task {
            for candidate in results.filter({ $0.source == "JIKAN" || $0.source == "MYANIMELIST" }).prefix(6) {
                guard !Task.isCancelled else { return }
                let author = candidate.attributes["mangaka"]?.stringValue
                let malId = candidate.attributes["malId"]?.stringValue
                let titleRomaji = candidate.attributes["titleRomaji"]?.stringValue
                guard let frenchTitle = try? await APIClient.shared.fetchFrenchTitle(
                        entityTypeId: entityTypeId, query: candidate.title, author: author, malId: malId, titleRomaji: titleRomaji),
                      !Task.isCancelled else {
                    continue
                }
                await MainActor.run {
                    frenchTitlesById[candidate.id] = frenchTitle
                }
            }
        }
    }

    /// Tries a real ISBN lookup via Open Library (covers the MANGA type
    /// only, by its well-known code - see OpenLibraryBarcodeProvider
    /// on the backend side). On failure or for an uncovered type, falls back to
    /// the raw code as before.
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

    /// e.g. "Manga · 1999 · MYANIMELIST" - the same title can mean several
    /// distinct works (e.g. the manga "Naruto" and a pilot one-shot also
    /// titled "Naruto"), mediaType/startYear remove the ambiguity without having to
    /// choose then check. Missing for sources that do not provide them
    /// (BGG/IGDB) - the separator is only put between the parts present.
    /// Mirror of candidateSubtitle on the web side (QuickAddPage.tsx).
    private func candidateSubtitle(_ candidate: MetadataCandidateDTO) -> String {
        [candidate.attributes["mediaType"]?.stringValue, candidate.attributes["startYear"]?.stringValue, candidate.source]
            .compactMap { $0 }
            .filter { !$0.isEmpty }
            .joined(separator: " · ")
    }

    /// Raw value of a candidate for a given language, or nil if the source
    /// does not provide it for this exact candidate (e.g. no distinct English
    /// title, or French search not yet resolved/unsuccessful).
    private func languageValue(_ candidate: MetadataCandidateDTO, _ language: TitleLanguage, frenchTitle: String?) -> String? {
        switch language {
        case .french:
            return frenchTitle
        case .english:
            return candidate.attributes["titleEnglish"]?.stringValue
        case .romaji:
            return candidate.attributes["titleRomaji"]?.stringValue ?? candidate.title
        }
    }

    /// Values available for this candidate, in the order of the composition,
    /// limited to the enabled languages - `candidate.title` as a last fallback if
    /// none of the enabled languages has a value (should only happen if
    /// everything was disabled, romaji included, which SettingsView already prevents).
    private func availableValuesInOrder(_ candidate: MetadataCandidateDTO, frenchTitle: String?) -> [String] {
        let values = titleComposition
            .filter(\.enabled)
            .compactMap { languageValue(candidate, $0.language, frenchTitle: frenchTitle) }
            .filter { !$0.isEmpty }
        return values.isEmpty ? [candidate.title] : values
    }

    /// "Main" title resolved according to the composition (see Réglages > Titre
    /// des mangas) - never the title really typed/saved until we
    /// have clicked (see selectCandidate): this only decides WHAT to
    /// suggest/apply. `frenchTitle` is the result, already resolved (or not),
    /// of the best-effort search - ignored if "Français" is not enabled.
    /// Mirror of resolvePrimaryTitle on the web side (lib/titleLanguage.ts).
    private func resolveTitle(for candidate: MetadataCandidateDTO, frenchTitle: String?) -> String {
        availableValuesInOrder(candidate, frenchTitle: frenchTitle)[0]
    }

    /// e.g. "L'Attaque des Titans (Shingeki no Kyojin)" - the first available
    /// active language becomes the main title, the following ones (active
    /// and available) come between parentheses in the order chosen in
    /// Réglages. Never merged into the title really typed/saved (see
    /// selectCandidate). Mirror of candidateDisplayTitle on the web side (QuickAddPage.tsx).
    private func candidateDisplayTitle(_ candidate: MetadataCandidateDTO, _ frenchTitle: String?) -> String {
        let values = availableValuesInOrder(candidate, frenchTitle: frenchTitle)
        let mainTitle = values[0]
        var seen = Set([mainTitle])
        let secondary = values.dropFirst().filter { seen.insert($0).inserted }
        return secondary.isEmpty ? mainTitle : "\(mainTitle) (\(secondary.joined(separator: ", ")))"
    }

    /// Searches the real volumes (with cover art) of the French editions of
    /// this series (see VolumeSelectionGrid) - best-effort, an empty list
    /// simply leaves the manual fields as the only way to add a
    /// volume. Result stored durably on the backend side: without forceRefresh/
    /// deepSearch, a repeated call for the same series never runs
    /// Google Books again, it serves the answer already stored. deepSearch ("Chercher plus
    /// d'éditions" button) MERGES with the result already known, it
    /// does not replace it - so the current selection is always
    /// kept, like forceRefresh. malId/originalTitle (already known from the
    /// selected candidate) let us discard a spin-off/side-story
    /// known on the backend side - best-effort. titleRomaji is tried as a fallback
    /// for originalTitle for this same detection (see fetchFrenchTitle).
    private func triggerVolumeSearch(seriesTitle: String, author: String?, forceRefresh: Bool = false, deepSearch: Bool = false, malId: String? = nil, originalTitle: String? = nil, titleRomaji: String? = nil) {
        guard let typeId = selectedType?.id else { return }
        lastVolumeSearchTitle = seriesTitle
        lastVolumeSearchAuthor = author
        lastVolumeSearchMalId = malId
        lastVolumeSearchOriginalTitle = originalTitle
        lastVolumeSearchTitleRomaji = titleRomaji
        volumeSearchTask?.cancel()
        isSearchingVolumes = true
        // A manual refresh or a deep search keep the current
        // selection (the user is only checking/completing) -
        // a new series (initial search) on the other hand starts from an
        // empty selection.
        if !forceRefresh && !deepSearch {
            volumeCandidates = []
            selectedVolumeIds = []
            manualVolumes = []
        }
        volumesQuotaExceeded = false
        volumeSearchTask = Task {
            let response = try? await APIClient.shared.searchVolumes(
                entityTypeId: typeId, title: seriesTitle, author: author, forceRefresh: forceRefresh, deepSearch: deepSearch,
                malId: malId, originalTitle: originalTitle, titleRomaji: titleRomaji)
            guard !Task.isCancelled else { return }
            await MainActor.run {
                volumeCandidates = response?.volumes ?? []
                volumesQuotaExceeded = response?.quotaExceeded ?? false
                isSearchingVolumes = false
            }
        }
    }

    private func selectCandidate(_ candidate: MetadataCandidateDTO) {
        frenchTitleTask?.cancel()
        isTranslatingTitle = false
        // Cancels a volume search still pending for a previous
        // candidate (see the debounce below) - a new choice makes it obsolete.
        volumeSearchDebounceTask?.cancel()

        // Title already resolved according to the preference (see Réglages > Titre des
        // mangas): in .romaji/.english, it is final (candidate.title is
        // already the English, or originalTitle in .romaji). In .french, reuses
        // a French title already resolved for the list (see resolveFrenchTitlesForList)
        // if available.
        let resolvedTitle = resolveTitle(for: candidate, frenchTitle: frenchTitlesById[candidate.id])
        title = resolvedTitle
        selectedCandidateAttributes = candidate.attributes.mapValues { $0.stringValue }
        // The cover art travels separately on MetadataCandidateDTO (imageUrl) rather than
        // in `attributes` - we slip it under a dedicated key so
        // it is persisted with the rest of the pre-filled attributes,
        // without polluting the "Attributs pré-remplis" section shown above
        // (see the equivalent filter in the body, matching section).
        if let imageUrl = candidate.imageUrl {
            selectedCandidateAttributes[CoverImage.attributeKey] = imageUrl
        }
        // Pre-fills the edition from the publisher returned by the candidate (e.g.
        // Google Books/Open Library on an ISBN scan return the exact
        // edition scanned) - left empty for Jikan/MyAnimeList/BGG/IGDB which
        // do not know a French publisher. Simple pre-fill,
        // never overwritten afterwards: nothing prevents correcting it.
        if let publisher = candidate.attributes["publisher"]?.stringValue {
            edition = publisher
        }
        showManualVolumeFields = false
        verifiedTitle = resolvedTitle
        candidates = []
        searchCompletedWithNoResults = false
        searchFailed = false

        let author = candidate.attributes["mangaka"]?.stringValue
        // malId + candidate.title (title BEFORE French resolution) let us
        // discard a spin-off/side-story known on the backend side (see
        // RelatedSeriesService) - best-effort, no effect if malId is absent.
        let malId = candidate.attributes["malId"]?.stringValue
        // Second candidate for this same spin-off detection (see
        // RelatedSeriesService on the backend side) - a spin-off can be indexed
        // on the MyAnimeList side under the romaji title rather than candidate.title
        // (e.g. "Attack on Titan"/"Shingeki no Kyojin", checked manually).
        let titleRomaji = candidate.attributes["titleRomaji"]?.stringValue
        // Search with the title already resolved - correct in most
        // cases (many manga titles stay identical in French, e.g.
        // "Death Note", "One Piece"). If the French title arrives later
        // (see below) and differs, the search is done again with the right
        // title: the case where "L'Attaque des Titans" must replace "Attack on
        // Titan" to find the French edition on Google Books.
        //
        // Debounced (not immediate): without a delay, quickly comparing several
        // candidates before choosing triggered the Google Books requests
        // for EACH candidate hovered, whether kept or not - cancelled if another
        // candidate is chosen in the meantime (see above).
        if selectedType?.code == "MANGA" {
            volumeSearchDebounceTask = Task {
                try? await Task.sleep(nanoseconds: 600_000_000)
                guard !Task.isCancelled else { return }
                triggerVolumeSearch(
                    seriesTitle: resolvedTitle, author: author, malId: malId, originalTitle: candidate.title,
                    titleRomaji: titleRomaji)
            }
        }

        // Nothing more to do if "Français" is not enabled (no external
        // call in that case), nor if the French title is already known
        // (applied above).
        guard TitleCompositionStore.isFrenchEnabled(titleComposition), frenchTitlesById[candidate.id] == nil else {
            return
        }

        // Otherwise (candidate beyond the first 6 of the list, or resolution
        // not yet arrived), same best-effort search (Open Library, then
        // Google Books as a fallback) triggered at selection - only for
        // Jikan/MyAnimeList candidates: they are the only ones whose title
        // is romaji/English (never French). A Google Books/Open
        // Library candidate (ISBN scan) already returned the exact edition scanned - no
        // need to translate it again.
        guard candidate.source == "JIKAN" || candidate.source == "MYANIMELIST", let typeId = selectedType?.id else {
            return
        }
        // `candidate.title` (already English if available), never the romaji
        // `originalTitle`: checked manually that combining the author with
        // the full romaji never matches a French edition, whereas
        // a distinctive English word (e.g. "Titan") often finds it -
        // see OpenLibraryFrenchTitleProvider on the backend side.
        let searchTerm = candidate.title
        isTranslatingTitle = true
        frenchTitleTask = Task {
            defer { if !Task.isCancelled { isTranslatingTitle = false } }
            guard let frenchTitle = try? await APIClient.shared.fetchFrenchTitle(
                    entityTypeId: typeId, query: searchTerm, author: candidate.attributes["mangaka"]?.stringValue,
                    malId: candidate.attributes["malId"]?.stringValue, titleRomaji: candidate.attributes["titleRomaji"]?.stringValue),
                  !Task.isCancelled else {
                return
            }
            await MainActor.run {
                title = frenchTitle
                verifiedTitle = frenchTitle
                if selectedType?.code == "MANGA" {
                    triggerVolumeSearch(
                        seriesTitle: frenchTitle, author: candidate.attributes["mangaka"]?.stringValue,
                        malId: candidate.attributes["malId"]?.stringValue, originalTitle: candidate.title,
                        titleRomaji: candidate.attributes["titleRomaji"]?.stringValue)
                }
            }
        }
    }

    /// A volume to add - either a cover ticked in the grid (see
    /// VolumeSelectionGrid), or the volume typed manually as a fallback.
    private struct VolumeToAdd {
        let volumeNumber: Int?
        let edition: String?
        let volumeImageUrl: String?
    }

    private func submit() {
        guard let typeId = selectedType?.id, !blockedByMissingMatch else { return }
        isSubmitting = true
        errorMessage = nil
        let submittedTitle = title
        let attributes = selectedCandidateAttributes

        // Each cover ticked in the grid becomes an add, plus the
        // queue of manual volumes already put on hold (see queueManualVolume),
        // plus possibly the manual entry IN PROGRESS if not empty -
        // never one OR the other, everything combines.
        var items: [VolumeToAdd] = volumeCandidates
            .filter { selectedVolumeIds.contains($0.id) }
            .map { VolumeToAdd(volumeNumber: $0.volumeNumber, edition: $0.edition, volumeImageUrl: $0.imageUrl) }
        for manual in manualVolumes {
            items.append(VolumeToAdd(volumeNumber: manual.volumeNumber, edition: manual.edition.isEmpty ? nil : manual.edition, volumeImageUrl: nil))
        }
        let trimmedVolumeText = volumeNumberText.trimmingCharacters(in: .whitespaces)
        if let manualVolumeNumber = trimmedVolumeText.isEmpty ? nil : Int(trimmedVolumeText) {
            let trimmedEdition = edition.trimmingCharacters(in: .whitespaces)
            items.append(VolumeToAdd(volumeNumber: manualVolumeNumber, edition: trimmedEdition.isEmpty ? nil : trimmedEdition, volumeImageUrl: nil))
        }
        if items.isEmpty {
            items.append(VolumeToAdd(volumeNumber: nil, edition: nil, volumeImageUrl: nil)) // no volume given (video game/board game, or manga without volume)
        }

        Task {
            do {
                var addedCount = 0
                var alreadyOwnedCount = 0
                var matchedExistingEntity = false
                var lastEntityId: UUID?
                // Sequential, never in parallel (no TaskGroup): the
                // first call creates the series Entity if it does not exist
                // yet on the backend side (no unique constraint in the database on
                // entity_type_id+title) - concurrent calls would
                // potentially create several duplicate pages for the same series.
                for item in items {
                    let result = try await APIClient.shared.quickAdd(
                        entityTypeId: typeId, title: submittedTitle, condition: condition, attributes: attributes,
                        volumeNumber: item.volumeNumber, edition: item.edition, volumeImageUrl: item.volumeImageUrl)
                    matchedExistingEntity = matchedExistingEntity || result.matchedExistingEntity
                    lastEntityId = result.entityId
                    if result.matchedExistingVariant {
                        alreadyOwnedCount += 1
                    } else {
                        addedCount += 1
                    }
                }

                await MainActor.run {
                    // We only insert a new EntityRecord in the local cache if
                    // the backend really created a new Entity - otherwise we
                    // would duplicate locally what is not duplicated on the server side.
                    if !matchedExistingEntity, let lastEntityId {
                        let record = EntityRecord(
                            id: lastEntityId,
                            entityTypeId: typeId,
                            title: submittedTitle,
                            attributesJSON: "{}"
                        )
                        modelContext.insert(record)
                    }

                    if addedCount == 0 && alreadyOwnedCount > 0 {
                        lastAddedMessage = alreadyOwnedCount > 1
                            ? "« \(submittedTitle) » — tu possèdes déjà ces \(alreadyOwnedCount) tomes, exemplaires ajoutés quand même"
                            : "« \(submittedTitle) » — tu possèdes déjà ce tome (cette édition), exemplaire ajouté quand même"
                    } else if addedCount > 1 {
                        let suffix = alreadyOwnedCount > 0 ? " (dont \(alreadyOwnedCount) déjà possédé\(alreadyOwnedCount > 1 ? "s" : ""))" : ""
                        lastAddedMessage = "« \(submittedTitle) » — \(addedCount) tomes ajoutés\(suffix)"
                    } else if matchedExistingEntity {
                        lastAddedMessage = "« \(submittedTitle) » — nouveau tome ajouté à une fiche existante"
                    } else {
                        lastAddedMessage = "« \(submittedTitle) » ajouté"
                    }
                    volumeSearchDebounceTask?.cancel()
                    title = ""
                    selectedCandidateAttributes = [:]
                    volumeNumberText = ""
                    edition = ""
                    manualVolumes = []
                    volumeCandidates = []
                    selectedVolumeIds = []
                    showManualVolumeFields = false
                    lastVolumeSearchTitle = nil
                    lastVolumeSearchAuthor = nil
                    lastVolumeSearchMalId = nil
                    lastVolumeSearchOriginalTitle = nil
                    lastVolumeSearchTitleRomaji = nil
                    verifiedTitle = nil
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
