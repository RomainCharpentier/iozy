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
    // Réservés au Manga (voir QuickAddService côté backend) : le titre
    // identifie la SÉRIE, volumeNumber+edition identifient le TOME précis
    // qu'on ajoute réellement à l'étagère - deux champs distincts pour ne pas
    // mélanger "je possède Naruto" (faux, personne ne possède "la série" en
    // un bloc) et "je possède le tome 12 de Naruto, édition Kana" (ce qu'on
    // possède vraiment).
    @State private var volumeNumberText: String = ""
    @State private var edition: String = ""
    // Sélection visuelle des tomes possédés par jaquette (voir VolumeSelectionGrid,
    // façon Mangacollec) - déclenchée après sélection d'un candidat Manga
    // (voir triggerVolumeSearch). volumeNumberText/edition ci-dessus restent
    // disponibles en repli manuel (tome introuvable dans la recherche) et se
    // combinent avec cette sélection au moment de l'ajout (voir submit).
    @State private var volumeCandidates: [VolumeCandidateDTO] = []
    // Quota Google Books dépassé sur toutes les clés configurées lors de la
    // dernière recherche (voir VolumesResponseDTO) - distingue ce cas d'une
    // série qui n'a réellement aucune édition française.
    @State private var volumesQuotaExceeded = false
    @State private var isSearchingVolumes = false
    @State private var selectedVolumeIds: Set<String> = []
    @State private var showManualVolumeFields = false
    @State private var volumeSearchTask: Task<Void, Never>?
    // Débounce du déclenchement AUTOMATIQUE de la recherche de tomes après
    // sélection d'un candidat (voir selectCandidate) - évite de payer les
    // requêtes Google Books pour chaque candidat survolé/tapé rapidement
    // avant de s'arrêter sur le bon. N'affecte jamais un déclenchement
    // volontaire (boutons "Actualiser"/"Chercher plus d'éditions"), toujours immédiat.
    @State private var volumeSearchDebounceTask: Task<Void, Never>?
    // Titre/auteur de la dernière recherche de tomes déclenchée - réutilisés
    // par le bouton "Actualiser" (voir triggerVolumeSearch) sans re-choisir le
    // candidat. Résultat stocké durablement côté backend : sans ce bouton, un
    // résultat une fois trouvé ne serait plus jamais rafraîchi automatiquement.
    @State private var lastVolumeSearchTitle: String?
    @State private var lastVolumeSearchAuthor: String?
    // Déjà connus du candidat sélectionné (voir selectCandidate) - permettent
    // d'écarter un spin-off/side-story connu (voir RelatedSeriesService côté
    // backend), y compris sur "Actualiser"/"Chercher plus d'éditions".
    @State private var lastVolumeSearchMalId: String?
    @State private var lastVolumeSearchOriginalTitle: String?
    @State private var isSubmitting = false
    @State private var errorMessage: String?
    @State private var lastAddedMessage: String?
    @State private var showingScanner = false

    @State private var candidates: [MetadataCandidateDTO] = []
    @State private var selectedCandidateAttributes: [String: String] = [:]
    // Titre depuis lequel `selectedCandidateAttributes` a été rempli - si le
    // titre est retouché manuellement après avoir choisi un candidat, il est
    // considéré périmé (même règle que côté web). Sert aussi à savoir si le
    // titre courant est "vérifié" pour le blocage de soumission ci-dessous.
    @State private var verifiedTitle: String?
    @State private var searchTask: Task<Void, Never>?
    // Retour visuel pendant/après la recherche de métadonnées (Jikan/BGG/
    // IGDB) - sans ça, une recherche qui ne trouve rien (fournisseur en
    // panne, pas de correspondance...) est invisible et donne l'impression
    // qu'aucune recherche n'a lieu, contrairement au scan code-barres qui
    // affiche toujours un résultat explicite.
    @State private var isSearching = false
    @State private var searchCompletedWithNoResults = false
    @State private var searchFailed = false
    // Recherche best-effort d'un titre d'édition française après sélection
    // d'un candidat Jikan/MyAnimeList - voir selectCandidate.
    @State private var isTranslatingTitle = false
    @State private var frenchTitleTask: Task<Void, Never>?
    // Titres français déjà résolus pour la LISTE de suggestions (pas
    // seulement celle qu'on finira par choisir) - voir triggerSearch, qui
    // lance cette résolution dès que les candidats arrivent, et
    // selectCandidate, qui réutilise le résultat sans refaire l'appel.
    // Clé = MetadataCandidateDTO.id ("source-externalId").
    @State private var frenchTitlesById: [String: String] = [:]
    @State private var frenchTitlesListTask: Task<Void, Never>?
    // Réglage utilisateur (voir Réglages > Titre des mangas, TitleLanguagePreference.swift) -
    // si "Français" n'est pas activé dans la composition, aucune recherche de
    // titre français n'est jamais déclenchée (ni pour la liste ni à la
    // sélection) : zéro appel externe en plus. Simple @State (pas @AppStorage,
    // TitleComposition n'étant pas un type primitif) rechargé à chaque
    // apparition de l'onglet (voir .onAppear plus bas) pour refléter un
    // changement fait entre-temps dans l'onglet Réglages.
    @State private var titleComposition: TitleComposition = TitleCompositionStore.load()

    /// Type sélectionné, ou le premier de la liste chargée par défaut - les
    /// types ne sont plus codés en dur, la liste peut être vide un court
    /// instant au tout premier lancement (avant la première synchronisation).
    private var selectedType: EntityTypeRecord? {
        guard let selectedTypeId else { return entityTypes.first }
        return entityTypes.first { $0.id == selectedTypeId } ?? entityTypes.first
    }

    /// Un type avec fournisseur (Manga/Jeu vidéo/Jeu de société) exige
    /// d'avoir choisi une suggestion (recherche ou code-barres) avant de
    /// valider - un type personnalisé (jamais de fournisseur) reste en
    /// saisie libre, sinon il deviendrait définitivement impossible d'y
    /// ajouter quoi que ce soit.
    private var requiresMatch: Bool { selectedType?.hasMetadataProvider ?? false }
    private var hasVerifiedMatch: Bool { verifiedTitle != nil && verifiedTitle == title }
    /// `selectedCandidateAttributes` sans la jaquette (voir CoverImage.attributeKey) -
    /// celle-ci reste envoyée au backend mais n'a rien à faire dans cette
    /// liste texte "attribut : valeur".
    private var displayedCandidateAttributes: [String: String] {
        selectedCandidateAttributes.filter { $0.key != CoverImage.attributeKey }
    }
    private var blockedByMissingMatch: Bool {
        requiresMatch && !title.trimmingCharacters(in: .whitespaces).isEmpty && !hasVerifiedMatch
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
                                    selectedCandidateAttributes = [:]  // le titre a été retouché manuellement
                                    frenchTitleTask?.cancel()
                                    isTranslatingTitle = false
                                    // La sélection de tomes/jaquettes a été résolue pour
                                    // l'ancien titre - plus aucune garantie qu'elle
                                    // corresponde encore à ce qui est saisi.
                                    volumeSearchTask?.cancel()
                                    volumeSearchDebounceTask?.cancel()
                                    volumeCandidates = []
                                    selectedVolumeIds = []
                                    isSearchingVolumes = false
                                    lastVolumeSearchTitle = nil
                                    lastVolumeSearchAuthor = nil
                                    lastVolumeSearchMalId = nil
                                    lastVolumeSearchOriginalTitle = nil
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
                                        malId: lastVolumeSearchMalId, originalTitle: lastVolumeSearchOriginalTitle)
                                }
                            }
                        }
                        .font(.caption)
                    }

                    if selectedType?.code == "MANGA" && (volumeCandidates.isEmpty || showManualVolumeFields) && !isSearchingVolumes {
                        TextField("Tome n°", text: $volumeNumberText)
                            .keyboardType(.numberPad)
                        TextField("Édition (ex: Kana, Perfect Edition...)", text: $edition)
                            .textInputAutocapitalization(.words)
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
                                        malId: lastVolumeSearchMalId, originalTitle: lastVolumeSearchOriginalTitle)
                                } label: {
                                    Label("Chercher plus d'éditions", systemImage: "magnifyingglass")
                                }
                                .font(.caption)
                                .disabled(isSearchingVolumes)

                                Button {
                                    triggerVolumeSearch(
                                        seriesTitle: lastVolumeSearchTitle, author: lastVolumeSearchAuthor, forceRefresh: true,
                                        malId: lastVolumeSearchMalId, originalTitle: lastVolumeSearchOriginalTitle)
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
                                    // Jaquette réelle si la source en fournit une - aide à
                                    // distinguer visuellement des titres identiques/proches
                                    // avant même de lire le sous-titre.
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
                    Text(selectedVolumeIds.count > 1 ? "Ajouter \(selectedVolumeIds.count) tomes" : "Ajouter")
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

    /// Recherche débouncée (500ms, minimum 3 caractères) pour ne pas spammer
    /// Jikan/MyAnimeList/BGG/IGDB à chaque frappe - même réglage que web
    /// (QuickAddPage.tsx) pour limiter les recherches intermédiaires tapées
    /// "en passant" avant que le mot ne soit terminé (ex: taper "naruto" sans
    /// s'arrêter ne devrait déclencher qu'une seule requête). `searchTask?.cancel()`
    /// + le `guard !Task.isCancelled` après le sleep empêchent déjà l'appel
    /// réseau lui-même de partir pour une recherche devenue obsolète - le
    /// cache backend (voir MetadataSearchService) absorbe le reste des cas
    /// résiduels.
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

    /// Résout un titre français pour chaque suggestion Jikan/MyAnimeList
    /// affichée (pas seulement celle qu'on finira par choisir - voir
    /// selectCandidate, qui réutilise ces résultats sans refaire l'appel).
    /// Capé aux 6 premières suggestions pour contenir le nombre d'appels
    /// externes (jusqu'à ~5 requêtes Open Library en cascade par candidat -
    /// voir OpenLibraryFrenchTitleProvider côté backend, cache 24h derrière) ;
    /// au-delà, le titre français est cherché à la sélection comme avant. La
    /// liste s'affiche immédiatement en anglais/romaji et se met à jour
    /// progressivement candidat par candidat, sans bloquer l'affichage initial.
    private func resolveFrenchTitlesForList(_ results: [MetadataCandidateDTO], entityTypeId: UUID) {
        guard TitleCompositionStore.isFrenchEnabled(titleComposition) else { return }
        frenchTitlesListTask = Task {
            for candidate in results.filter({ $0.source == "JIKAN" || $0.source == "MYANIMELIST" }).prefix(6) {
                guard !Task.isCancelled else { return }
                let author = candidate.attributes["mangaka"]?.stringValue
                guard let frenchTitle = try? await APIClient.shared.fetchFrenchTitle(
                        entityTypeId: entityTypeId, query: candidate.title, author: author),
                      !Task.isCancelled else {
                    continue
                }
                await MainActor.run {
                    frenchTitlesById[candidate.id] = frenchTitle
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

    /// ex: "Manga · 1999 · MYANIMELIST" - un même titre peut désigner plusieurs
    /// œuvres distinctes (ex: le manga "Naruto" et un one-shot pilote également
    /// titré "Naruto"), mediaType/startYear lèvent l'ambiguïté sans avoir à
    /// choisir puis vérifier. Absents pour les sources qui ne les fournissent
    /// pas (BGG/IGDB) - le séparateur n'est mis qu'entre les parties présentes.
    /// Miroir de candidateSubtitle côté web (QuickAddPage.tsx).
    private func candidateSubtitle(_ candidate: MetadataCandidateDTO) -> String {
        [candidate.attributes["mediaType"]?.stringValue, candidate.attributes["startYear"]?.stringValue, candidate.source]
            .compactMap { $0 }
            .filter { !$0.isEmpty }
            .joined(separator: " · ")
    }

    /// Valeur brute d'un candidat pour une langue donnée, ou nil si la source
    /// ne la fournit pas pour ce candidat précis (ex: pas de titre anglais
    /// distinct, ou recherche française pas encore résolue/infructueuse).
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

    /// Valeurs disponibles pour ce candidat, dans l'ordre de la composition,
    /// limitées aux langues activées - `candidate.title` en dernier repli si
    /// aucune des langues activées n'a de valeur (ne devrait arriver que si
    /// tout a été désactivé, romaji y compris, ce que SettingsView empêche déjà).
    private func availableValuesInOrder(_ candidate: MetadataCandidateDTO, frenchTitle: String?) -> [String] {
        let values = titleComposition
            .filter(\.enabled)
            .compactMap { languageValue(candidate, $0.language, frenchTitle: frenchTitle) }
            .filter { !$0.isEmpty }
        return values.isEmpty ? [candidate.title] : values
    }

    /// Titre "principal" résolu selon la composition (voir Réglages > Titre
    /// des mangas) - jamais le titre réellement saisi/sauvegardé tant qu'on
    /// n'a pas cliqué (voir selectCandidate) : ceci ne sert qu'à décider QUOI
    /// proposer/appliquer. `frenchTitle` est le résultat déjà résolu (ou non)
    /// de la recherche best-effort - ignoré si "Français" n'est pas activé.
    /// Miroir de resolvePrimaryTitle côté web (lib/titleLanguage.ts).
    private func resolveTitle(for candidate: MetadataCandidateDTO, frenchTitle: String?) -> String {
        availableValuesInOrder(candidate, frenchTitle: frenchTitle)[0]
    }

    /// ex: "L'Attaque des Titans (Shingeki no Kyojin)" - la première langue
    /// active disponible devient le titre principal, les suivantes (actives
    /// et disponibles) suivent entre parenthèses dans l'ordre choisi dans
    /// Réglages. Jamais intégré au titre réellement saisi/sauvegardé (voir
    /// selectCandidate). Miroir de candidateDisplayTitle côté web (QuickAddPage.tsx).
    private func candidateDisplayTitle(_ candidate: MetadataCandidateDTO, _ frenchTitle: String?) -> String {
        let values = availableValuesInOrder(candidate, frenchTitle: frenchTitle)
        let mainTitle = values[0]
        var seen = Set([mainTitle])
        let secondary = values.dropFirst().filter { seen.insert($0).inserted }
        return secondary.isEmpty ? mainTitle : "\(mainTitle) (\(secondary.joined(separator: ", ")))"
    }

    /// Cherche les tomes réels (avec jaquette) des éditions françaises de
    /// cette série (voir VolumeSelectionGrid) - best-effort, une liste vide
    /// laisse simplement les champs manuels comme unique moyen d'ajouter un
    /// tome. Résultat stocké durablement côté backend : sans forceRefresh/
    /// deepSearch, un appel répété pour la même série ne relance jamais
    /// Google Books, il sert la réponse déjà stockée. deepSearch (bouton
    /// "Chercher plus d'éditions") FUSIONNE avec le résultat déjà connu, il
    /// ne le remplace pas - la sélection en cours est donc toujours
    /// conservée, comme forceRefresh. malId/originalTitle (déjà connus du
    /// candidat sélectionné) permettent d'écarter un spin-off/side-story
    /// connu côté backend - best-effort.
    private func triggerVolumeSearch(seriesTitle: String, author: String?, forceRefresh: Bool = false, deepSearch: Bool = false, malId: String? = nil, originalTitle: String? = nil) {
        guard let typeId = selectedType?.id else { return }
        lastVolumeSearchTitle = seriesTitle
        lastVolumeSearchAuthor = author
        lastVolumeSearchMalId = malId
        lastVolumeSearchOriginalTitle = originalTitle
        volumeSearchTask?.cancel()
        isSearchingVolumes = true
        // Un rafraîchissement manuel ou une recherche approfondie gardent la
        // sélection en cours (l'utilisateur ne fait que vérifier/compléter) -
        // une nouvelle série (recherche initiale) repart en revanche d'une
        // sélection vide.
        if !forceRefresh && !deepSearch {
            volumeCandidates = []
            selectedVolumeIds = []
        }
        volumesQuotaExceeded = false
        volumeSearchTask = Task {
            let response = try? await APIClient.shared.searchVolumes(
                entityTypeId: typeId, title: seriesTitle, author: author, forceRefresh: forceRefresh, deepSearch: deepSearch,
                malId: malId, originalTitle: originalTitle)
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
        // Annule une recherche de tomes encore en attente pour un candidat
        // précédent (voir le débounce plus bas) - un nouveau choix la rend obsolète.
        volumeSearchDebounceTask?.cancel()

        // Titre déjà résolu selon la préférence (voir Réglages > Titre des
        // mangas) : en .romaji/.english, c'est définitif (candidate.title est
        // déjà l'anglais, ou originalTitle en .romaji). En .french, réutilise
        // un titre français déjà résolu pour la liste (voir resolveFrenchTitlesForList)
        // si disponible.
        let resolvedTitle = resolveTitle(for: candidate, frenchTitle: frenchTitlesById[candidate.id])
        title = resolvedTitle
        selectedCandidateAttributes = candidate.attributes.mapValues { $0.stringValue }
        // La jaquette voyage à part sur MetadataCandidateDTO (imageUrl) plutôt
        // que dans `attributes` - on la glisse sous une clé dédiée pour
        // qu'elle soit persistée avec le reste des attributs pré-remplis,
        // sans polluer la section "Attributs pré-remplis" affichée ci-dessus
        // (voir filtre équivalent dans le body, section correspondante).
        if let imageUrl = candidate.imageUrl {
            selectedCandidateAttributes[CoverImage.attributeKey] = imageUrl
        }
        // Pré-remplit l'édition depuis l'éditeur renvoyé par le candidat (ex:
        // Google Books/Open Library sur un scan ISBN renvoient l'édition
        // exacte scannée) - laissé vide pour Jikan/MyAnimeList/BGG/IGDB qui
        // ne connaissent pas d'éditeur français. Simple pré-remplissage,
        // jamais écrasé après coup : rien n'empêche de le corriger.
        if let publisher = candidate.attributes["publisher"]?.stringValue {
            edition = publisher
        }
        showManualVolumeFields = false
        verifiedTitle = resolvedTitle
        candidates = []
        searchCompletedWithNoResults = false
        searchFailed = false

        let author = candidate.attributes["mangaka"]?.stringValue
        // malId + candidate.title (titre AVANT résolution française) permettent
        // d'écarter un spin-off/side-story connu côté backend (voir
        // RelatedSeriesService) - best-effort, sans effet si malId est absent.
        let malId = candidate.attributes["malId"]?.stringValue
        // Recherche avec le titre déjà résolu - correct dans la majorité des
        // cas (beaucoup de titres de mangas restent identiques en VF, ex:
        // "Death Note", "One Piece"). Si le titre français arrive plus tard
        // (voir plus bas) et diffère, la recherche est refaite avec le bon
        // titre : le cas où "L'Attaque des Titans" doit remplacer "Attack on
        // Titan" pour trouver l'édition française sur Google Books.
        //
        // Débounced (pas immédiat) : sans délai, comparer rapidement plusieurs
        // candidats avant de choisir déclenchait les requêtes Google Books
        // pour CHAQUE candidat survolé, jamais retenu ou non - annulé si un
        // autre candidat est choisi entre-temps (voir plus haut).
        if selectedType?.code == "MANGA" {
            volumeSearchDebounceTask = Task {
                try? await Task.sleep(nanoseconds: 600_000_000)
                guard !Task.isCancelled else { return }
                triggerVolumeSearch(seriesTitle: resolvedTitle, author: author, malId: malId, originalTitle: candidate.title)
            }
        }

        // Rien de plus à faire si "Français" n'est pas activé (aucun appel
        // externe dans ce cas), ni si le titre français est déjà connu
        // (appliqué ci-dessus).
        guard TitleCompositionStore.isFrenchEnabled(titleComposition), frenchTitlesById[candidate.id] == nil else {
            return
        }

        // Sinon (candidat au-delà des 6 premiers de la liste, ou résolution
        // pas encore arrivée), même recherche best-effort (Open Library, puis
        // Google Books en repli) déclenchée à la sélection - uniquement pour
        // les candidats Jikan/MyAnimeList : ce sont les seuls dont le titre
        // est romaji/anglais (jamais français). Un candidat Google Books/Open
        // Library (scan ISBN) a déjà renvoyé l'édition exacte scannée - pas
        // la peine de le retraduire.
        guard candidate.source == "JIKAN" || candidate.source == "MYANIMELIST", let typeId = selectedType?.id else {
            return
        }
        // `candidate.title` (déjà l'anglais si disponible), jamais le romaji
        // `originalTitle` : vérifié manuellement que combiner l'auteur avec
        // le romaji complet ne matche jamais une édition française, alors
        // qu'un mot anglais distinctif (ex: "Titan") le retrouve souvent -
        // voir OpenLibraryFrenchTitleProvider côté backend.
        let searchTerm = candidate.title
        isTranslatingTitle = true
        frenchTitleTask = Task {
            defer { if !Task.isCancelled { isTranslatingTitle = false } }
            guard let frenchTitle = try? await APIClient.shared.fetchFrenchTitle(
                    entityTypeId: typeId, query: searchTerm, author: candidate.attributes["mangaka"]?.stringValue),
                  !Task.isCancelled else {
                return
            }
            await MainActor.run {
                title = frenchTitle
                verifiedTitle = frenchTitle
                if selectedType?.code == "MANGA" {
                    triggerVolumeSearch(
                        seriesTitle: frenchTitle, author: candidate.attributes["mangaka"]?.stringValue,
                        malId: candidate.attributes["malId"]?.stringValue, originalTitle: candidate.title)
                }
            }
        }
    }

    /// Un tome à ajouter - soit une couverture cochée dans la grille (voir
    /// VolumeSelectionGrid), soit le tome saisi manuellement en repli.
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

        // Chaque couverture cochée dans la grille devient un ajout, plus
        // éventuellement le tome saisi manuellement (repli "introuvable dans
        // la recherche") en plus - jamais l'un OU l'autre, les deux se combinent.
        var items: [VolumeToAdd] = volumeCandidates
            .filter { selectedVolumeIds.contains($0.id) }
            .map { VolumeToAdd(volumeNumber: $0.volumeNumber, edition: $0.edition, volumeImageUrl: $0.imageUrl) }
        let trimmedVolumeText = volumeNumberText.trimmingCharacters(in: .whitespaces)
        if let manualVolumeNumber = trimmedVolumeText.isEmpty ? nil : Int(trimmedVolumeText) {
            let trimmedEdition = edition.trimmingCharacters(in: .whitespaces)
            items.append(VolumeToAdd(volumeNumber: manualVolumeNumber, edition: trimmedEdition.isEmpty ? nil : trimmedEdition, volumeImageUrl: nil))
        }
        if items.isEmpty {
            items.append(VolumeToAdd(volumeNumber: nil, edition: nil, volumeImageUrl: nil)) // pas de tome précisé (jeu vidéo/jeu de société, ou manga sans tome)
        }

        Task {
            do {
                var addedCount = 0
                var alreadyOwnedCount = 0
                var matchedExistingEntity = false
                var lastEntityId: UUID?
                // Séquentiel, jamais en parallèle (pas de TaskGroup) : le
                // premier appel crée l'Entity-série si elle n'existe pas
                // encore côté backend (aucune contrainte unique en base sur
                // entity_type_id+title) - des appels concurrents créeraient
                // potentiellement plusieurs fiches en double pour la même série.
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
                    // On n'insère un nouvel EntityRecord dans le cache local que si
                    // le backend a vraiment créé une nouvelle Entity - sinon on
                    // dupliquerait localement ce qui ne l'est pas côté serveur.
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
                    volumeCandidates = []
                    selectedVolumeIds = []
                    showManualVolumeFields = false
                    lastVolumeSearchTitle = nil
                    lastVolumeSearchAuthor = nil
                    lastVolumeSearchMalId = nil
                    lastVolumeSearchOriginalTitle = nil
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
