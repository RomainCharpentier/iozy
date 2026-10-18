import SwiftUI
import SwiftData

/// Journey 2 ("the evening curator", step 5): full detail page in one
/// single screen (info, Ownership, Experience history), with adding
/// of a new Experience (rating + comment only, as
/// simplified during design).
///
/// Synchronization: at first display, the Ownerships and Experiences
/// are fetched from the API and updated in the local SwiftData cache
/// (upsert by id) - so the local cache is no longer just filled
/// by the quick add journey, it also reflects what already exists
/// on the server side.
///
/// Validated visual direction: gradient hero with the title in large,
/// statuses as pills, tags as chips, dark cards for the experiences.
struct EntityDetailView: View {
    let entityId: UUID

    @Environment(\.modelContext) private var modelContext
    @Query private var allEntities: [EntityRecord]
    @Query private var allOwnerships: [OwnershipRecord]
    @Query private var allExperiences: [ExperienceRecord]
    @Query private var entityTypes: [EntityTypeRecord]

    @State private var showingAddExperience = false
    @State private var isSyncing = false
    @State private var syncError: String?

    @State private var entityTagIds: Set<UUID> = []
    @State private var allTags: [TagDTO] = []
    @State private var relationshipsFrom: [RelationshipDTO] = []
    @State private var relationshipsTo: [RelationshipDTO] = []
    // Exact volumes of an edition (Manga) - see Variant on the backend domain side.
    // Fetched live from the API (entityDetail.variants), same logic
    // as coverImageURL below.
    @State private var variants: [APIClient.VariantDTO] = []
    @State private var showingAddTag = false
    @State private var showingAddRelationship = false
    // Completes an edition already in the collection (see addVolumeSection) - e.g.
    // volumes 4 and 5 of a "Black Edition" never found by the
    // automatic search on the BnF/Google Books side (gap in the source data,
    // not a bug, see the conversation history on "Death Note").
    // Until now the only way to add a volume to a series already owned
    // was to go through the whole Quick add journey again and type the
    // whole title again. Same queue mechanism as QuickAddView
    // (see queueManualVolume on the Quick add side) - lets us chain
    // several volumes before confirming only once.
    @State private var showingAddVolume = false
    @State private var addVolumeCondition = "NEW"
    @State private var addVolumeNumberText = ""
    @State private var addVolumeEdition = ""
    @State private var addManualVolumes: [ManualVolumeEntry] = []
    @State private var isAddingVolume = false
    @State private var addVolumeError: String?
    // Fetched live from the API (entityDetail.attributes) rather than
    // from the local EntityRecord cache (whose attributesJSON is today
    // never synchronized with the server - see EntityRecord): this detail page
    // already does a network fetch at first display, so no reason to
    // settle for a cache we know is stale for this exact field.
    @State private var coverImageURL: URL?

    private var entity: EntityRecord? { allEntities.first { $0.id == entityId } }
    private var resolvedType: EntityTypeRecord? {
        entity.flatMap { EntityTypeRecord.find(id: $0.entityTypeId, in: entityTypes) }
    }
    private var ownerships: [OwnershipRecord] { allOwnerships.filter { $0.entityId == entityId } }
    private var experiences: [ExperienceRecord] { allExperiences.filter { $0.entityId == entityId } }
    private var entityTags: [TagDTO] { allTags.filter { entityTagIds.contains($0.id) } }
    private var relatedEntities: [EntityRecord] {
        let ids = relationshipsFrom.map(\.targetEntityId) + relationshipsTo.map(\.sourceEntityId)
        return ids.compactMap { id in allEntities.first { $0.id == id } }
    }
    private var variantsById: [UUID: APIClient.VariantDTO] { Dictionary(uniqueKeysWithValues: variants.map { ($0.id, $0) }) }
    /// Sorts by volume number (Manga) when the info is available, to
    /// show "Volume 1, Volume 2, Volume 3..." in order rather than in
    /// the order of adding (often different: a missing volume is often
    /// completed later). Mirror of sortByVolumeNumber on the web side
    /// (OwnershipsSection.tsx).
    private var sortedOwnerships: [OwnershipRecord] {
        ownerships.sorted { a, b in
            let volumeA = a.variantId.flatMap { variantsById[$0] }?.attributes["volumeNumber"]?.stringValue
            let volumeB = b.variantId.flatMap { variantsById[$0] }?.attributes["volumeNumber"]?.stringValue
            switch (volumeA.flatMap(Int.init), volumeB.flatMap(Int.init)) {
            case let (.some(va), .some(vb)): return va < vb
            case (.some, .none): return true
            case (.none, .some): return false
            case (.none, .none): return false
            }
        }
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                hero
                VStack(alignment: .leading, spacing: 22) {
                    statusPills
                    tagsSection
                    experiencesSection
                    if resolvedType?.code == "MANGA" { addVolumeSection }
                    if !relatedEntities.isEmpty { relatedSection }
                    if let syncError {
                        Label(syncError, systemImage: "exclamationmark.triangle")
                            .font(Theme.body(12))
                            .foregroundStyle(.orange)
                    }
                }
                .padding(.horizontal, 20)
                .padding(.top, 18)
                .padding(.bottom, 30)
            }
        }
        .background(Theme.background)
        .ignoresSafeArea(edges: .top)
        .overlay(alignment: .top) {
            if isSyncing {
                ProgressView().tint(Theme.accent).padding(.top, 60)
            }
        }
        .task { await syncFromServer() }
        .refreshable { await syncFromServer() }
        .sheet(isPresented: $showingAddExperience) {
            if let entity {
                AddExperienceSheet(entityId: entity.id, allowedTypes: resolvedType?.allowedExperienceTypes ?? []) { dto in
                    upsertExperience(dto)
                }
            }
        }
        .sheet(isPresented: $showingAddTag) {
            ManageTagsSheet(
                allTags: allTags,
                attachedTagIds: entityTagIds,
                onToggle: { tag, isAttached in
                    Task { await toggleTag(tag, attach: isAttached) }
                },
                onCreateAndAttach: { label in
                    Task { await createAndAttachTag(label: label) }
                }
            )
        }
        .sheet(isPresented: $showingAddRelationship) {
            AddRelationshipSheet(
                sourceEntityId: entityId,
                candidateEntities: allEntities.filter { $0.id != entityId }
            ) { targetId, type in
                Task { await addRelationship(targetEntityId: targetId, type: type) }
            }
        }
    }

    // MARK: - Visual sections

    private var hero: some View {
        ZStack(alignment: .bottomLeading) {
            if let coverImageURL {
                AsyncImage(url: coverImageURL) { phase in
                    if let image = phase.image {
                        image.resizable().aspectRatio(contentMode: .fill)
                    } else {
                        heroFallbackGradient
                    }
                }
                .frame(height: 210)
                .clipped()
            } else {
                heroFallbackGradient
                    .frame(height: 210)
            }

            LinearGradient(colors: [.clear, Theme.background], startPoint: .init(x: 0.5, y: 0.35), endPoint: .bottom)
                .frame(height: 210)

            VStack(alignment: .leading, spacing: 8) {
                if let type = resolvedType {
                    Text(type.label.uppercased())
                        .font(Theme.bodySemibold(11))
                        .foregroundStyle(.white.opacity(0.85))
                        .padding(.horizontal, 10)
                        .padding(.vertical, 4)
                        .background(.white.opacity(0.18), in: Capsule())
                }
                Text(entity?.title ?? "Fiche")
                    .font(Theme.display(26))
                    .foregroundStyle(.white)
                    .lineLimit(2)
            }
            .padding(.horizontal, 20)
            .padding(.bottom, 18)
        }
    }

    private var heroFallbackGradient: some View {
        entity.map { Theme.gradient(for: $0.title) }
            ?? LinearGradient(colors: [Theme.surface, Theme.surface2], startPoint: .top, endPoint: .bottom)
    }

    private var statusPills: some View {
        HStack(spacing: 8) {
            if let ownership = ownerships.first {
                statusPill(dotColor: Theme.accent, text: "Possédé · \(ownership.condition.capitalized)")
            }
            if let bestExperience = experiences.compactMap({ exp -> (ExperienceRecord, Int)? in
                exp.rating.map { (exp, $0) }
            }).max(by: { $0.1 < $1.1 }) {
                statusPill(dotColor: Theme.violet, text: "\(bestExperience.0.experienceType.capitalized) · \(bestExperience.1)/10")
            }
        }
    }

    private func statusPill(dotColor: Color, text: String) -> some View {
        HStack(spacing: 6) {
            Circle().fill(dotColor).frame(width: 8, height: 8)
            Text(text).font(Theme.bodyMedium(12.5)).foregroundStyle(Theme.textPrimary)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 10)
        .background(Theme.surface, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
    }

    private var tagsSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            sectionTitle("Tags")
            if entityTags.isEmpty {
                Text("Aucun tag pour l'instant").font(Theme.body(13)).foregroundStyle(Theme.textDim)
            } else {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        ForEach(entityTags) { tag in
                            Chip(label: tag.label)
                        }
                    }
                }
            }
            Button { showingAddTag = true } label: {
                Label("Gérer les tags", systemImage: "tag")
                    .font(Theme.bodyMedium(13))
                    .foregroundStyle(Theme.accent)
            }
        }
    }

    private var experiencesSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            sectionTitle("Expériences")
            if ownerships.isEmpty && experiences.isEmpty {
                EmptyView()
            }
            ForEach(sortedOwnerships) { ownership in
                ownershipCard(ownership)
            }
            ForEach(experiences.sorted(by: { $0.occurredAt > $1.occurredAt })) { experience in
                experienceCard(experience)
            }
            Button { showingAddExperience = true } label: {
                Text("Ajouter une expérience")
                    .font(Theme.bodySemibold(14))
                    .foregroundStyle(Theme.accentText)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 14)
                    .background(Theme.accent, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
            }
        }
    }

    private func ownershipCard(_ ownership: OwnershipRecord) -> some View {
        let variant = ownership.variantId.flatMap { variantsById[$0] }
        // The label of the volume (e.g. "Volume 3 — Kana") takes priority over "Possession" when
        // it is known - it is the info that really distinguishes this card from the
        // other ownerships of the same detail page. The cover art specific to this volume
        // (see VolumeSelectionGrid on the Quick add side) is only present if
        // it was found at add time - absent for a volume added
        // manually or before this feature was introduced.
        let variantCoverURL = variant.flatMap { CoverImage.url(from: $0.attributes) }
        return HStack(alignment: .top, spacing: 10) {
            if let variantCoverURL {
                AsyncImage(url: variantCoverURL) { phase in
                    if let image = phase.image {
                        image.resizable().aspectRatio(contentMode: .fill)
                    } else {
                        Color(.systemGray5)
                    }
                }
                .frame(width: 44, height: 64)
                .clipShape(RoundedRectangle(cornerRadius: 6, style: .continuous))
            }
            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    Text(variant?.label ?? "Possession").font(Theme.bodySemibold(13)).foregroundStyle(Theme.textPrimary)
                    Spacer()
                    Text(ownership.status).font(Theme.bodyMedium(12)).foregroundStyle(Theme.textDim)
                }
                Text(ownership.condition.capitalized).font(Theme.body(12.5)).foregroundStyle(Theme.textDim)
                if let note = ownership.note, !note.isEmpty {
                    Text(note).font(Theme.body(12.5)).foregroundStyle(Theme.textDim)
                }
                if ownership.status == "OWNED" {
                    Button("Marquer vendu") { markSold(ownership) }
                        .font(Theme.bodyMedium(12))
                        .foregroundStyle(Theme.pink)
                }
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.surface, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
    }

    private func experienceCard(_ experience: ExperienceRecord) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text(experience.experienceType.capitalized).font(Theme.bodySemibold(13)).foregroundStyle(Theme.textPrimary)
                Spacer()
                if let rating = experience.rating {
                    Text("★ \(rating)/10").font(Theme.bodySemibold(12.5)).foregroundStyle(Theme.accent)
                }
            }
            if let comment = experience.comment, !comment.isEmpty {
                Text(comment).font(Theme.body(12.5)).foregroundStyle(Theme.textDim)
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.surface, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
    }

    /// See the declaration of the related @State above for context -
    /// same queue mechanism as QuickAddView.
    private var addVolumeSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            if !showingAddVolume {
                Button { showingAddVolume = true } label: {
                    Text("+ Ajouter un tome")
                        .font(Theme.bodyMedium(13))
                        .foregroundStyle(Theme.accent)
                }
            } else {
                sectionTitle("Ajouter un tome")
                Picker("État", selection: $addVolumeCondition) {
                    Text("Neuf").tag("NEW")
                    Text("Occasion").tag("USED")
                    Text("Abîmé").tag("DAMAGED")
                }
                .pickerStyle(.segmented)

                HStack {
                    TextField("Tome n°", text: $addVolumeNumberText)
                        .keyboardType(.numberPad)
                    TextField("Édition (ex: Kana, Black Édition...)", text: $addVolumeEdition)
                        .textInputAutocapitalization(.words)
                    Button {
                        queueManualVolume()
                    } label: {
                        Image(systemName: "plus.circle.fill")
                    }
                    .disabled(addVolumeNumberText.trimmingCharacters(in: .whitespaces).isEmpty)
                }
                .padding(10)
                .background(Theme.surface, in: RoundedRectangle(cornerRadius: 12, style: .continuous))

                ForEach(addManualVolumes) { manual in
                    HStack {
                        Text("T. \(manual.volumeNumber)" + (manual.edition.isEmpty ? "" : " · \(manual.edition)"))
                            .font(Theme.body(12.5))
                            .foregroundStyle(Theme.textDim)
                        Spacer()
                        Button {
                            removeManualVolume(manual.id)
                        } label: {
                            Image(systemName: "xmark.circle.fill").foregroundStyle(.secondary)
                        }
                    }
                }

                if let addVolumeError {
                    Text(addVolumeError).font(Theme.body(12)).foregroundStyle(.red)
                }

                HStack {
                    Button {
                        Task { await submitAddVolume() }
                    } label: {
                        Text(totalVolumesToAdd > 1 ? "Ajouter \(totalVolumesToAdd) tomes" : "Ajouter")
                            .font(Theme.bodySemibold(14))
                            .foregroundStyle(Theme.accentText)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 12)
                            .background(Theme.accent, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                    }
                    .disabled(totalVolumesToAdd == 0 || isAddingVolume)
                    .opacity(totalVolumesToAdd == 0 || isAddingVolume ? 0.5 : 1)

                    Button("Annuler") {
                        showingAddVolume = false
                        addVolumeNumberText = ""
                        addVolumeEdition = ""
                        addManualVolumes = []
                        addVolumeError = nil
                    }
                    .font(Theme.bodyMedium(13))
                    .foregroundStyle(Theme.textDim)
                }
            }
        }
    }

    /// Reflects exactly what submitAddVolume() will submit - same
    /// principle as QuickAddView.totalVolumesToAdd.
    private var totalVolumesToAdd: Int {
        addManualVolumes.count + (addVolumeNumberText.trimmingCharacters(in: .whitespaces).isEmpty ? 0 : 1)
    }

    private struct ManualVolumeEntry: Identifiable {
        let id = UUID()
        let volumeNumber: Int
        let edition: String
    }

    private func queueManualVolume() {
        let trimmed = addVolumeNumberText.trimmingCharacters(in: .whitespaces)
        guard let parsed = Int(trimmed), parsed > 0 else { return }
        addManualVolumes.append(ManualVolumeEntry(volumeNumber: parsed, edition: addVolumeEdition.trimmingCharacters(in: .whitespaces)))
        addVolumeNumberText = ""
    }

    private func removeManualVolume(_ id: UUID) {
        addManualVolumes.removeAll { $0.id == id }
    }

    /// `quickAdd` already matches an existing Entity by (entityTypeId, title)
    /// on the backend side (see QuickAddService) - it is enough to reuse the
    /// exact title of the series already in the collection, no new endpoint
    /// needed. A full re-sync (no optimistic local upsert) after
    /// success: simpler and more reliable, QuickAddResponse only returns
    /// variantId, not the full label/attributes of the Variant created.
    private func submitAddVolume() async {
        guard let entity else { return }
        var items = addManualVolumes.map { ($0.volumeNumber, $0.edition) }
        let trimmedVolumeText = addVolumeNumberText.trimmingCharacters(in: .whitespaces)
        if let manualVolumeNumber = trimmedVolumeText.isEmpty ? nil : Int(trimmedVolumeText) {
            items.append((manualVolumeNumber, addVolumeEdition.trimmingCharacters(in: .whitespaces)))
        }
        guard !items.isEmpty else { return }

        isAddingVolume = true
        addVolumeError = nil
        do {
            // Sequential: see QuickAddView.submit() for the same precaution.
            for (volumeNumber, edition) in items {
                _ = try await APIClient.shared.quickAdd(
                    entityTypeId: entity.entityTypeId, title: entity.title, condition: addVolumeCondition, attributes: [:],
                    volumeNumber: volumeNumber, edition: edition.isEmpty ? nil : edition)
            }
            await syncFromServer()
            await MainActor.run {
                showingAddVolume = false
                addVolumeNumberText = ""
                addVolumeEdition = ""
                addManualVolumes = []
                isAddingVolume = false
            }
        } catch {
            await MainActor.run {
                addVolumeError = "Échec de l'ajout : \(error.localizedDescription)"
                isAddingVolume = false
            }
        }
    }

    private var relatedSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            sectionTitle("Relations")
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 10) {
                    ForEach(relatedEntities) { related in
                        NavigationLink(value: related.id) {
                            CoverTile(title: related.title, imageURL: CoverImage.url(fromAttributesJSON: related.attributesJSON))
                                .frame(width: 74)
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
            Button { showingAddRelationship = true } label: {
                Label("Ajouter une relation", systemImage: "link")
                    .font(Theme.bodyMedium(13))
                    .foregroundStyle(Theme.accent)
            }
        }
    }

    private func sectionTitle(_ text: String) -> some View {
        Text(text).font(Theme.displayMedium(16)).foregroundStyle(Theme.textPrimary)
    }

    // MARK: - Synchronization with the API

    private func syncFromServer() async {
        isSyncing = true
        syncError = nil
        do {
            async let ownershipsTask = APIClient.shared.fetchOwnerships(entityId: entityId)
            async let experiencesTask = APIClient.shared.fetchExperiences(entityId: entityId)
            async let entityDetailTask = APIClient.shared.fetchEntity(id: entityId)
            async let allTagsTask = APIClient.shared.fetchAllTags()
            async let relationshipsFromTask = APIClient.shared.fetchRelationshipsFrom(entityId: entityId)
            async let relationshipsToTask = APIClient.shared.fetchRelationshipsTo(entityId: entityId)

            let (fetchedOwnerships, fetchedExperiences, entityDetail, tags, relFrom, relTo) =
                try await (ownershipsTask, experiencesTask, entityDetailTask, allTagsTask, relationshipsFromTask, relationshipsToTask)

            for dto in fetchedOwnerships { upsertOwnership(dto) }
            for dto in fetchedExperiences { upsertExperience(dto) }
            entityTagIds = Set(entityDetail.tagIds)
            coverImageURL = CoverImage.url(from: entityDetail.attributes)
            variants = entityDetail.variants
            allTags = tags
            relationshipsFrom = relFrom
            relationshipsTo = relTo
            await EntityTypeRecord.syncFromServer(modelContext: modelContext, existing: entityTypes)
        } catch {
            // Network failure: we keep the existing local cache (useful offline),
            // we only report that the synchronization could not be done.
            syncError = "Synchronisation impossible, affichage du cache local"
        }
        isSyncing = false
    }

    private func toggleTag(_ tag: TagDTO, attach: Bool) async {
        do {
            if attach {
                try await APIClient.shared.attachTag(entityId: entityId, tagId: tag.id)
                await MainActor.run { entityTagIds.insert(tag.id) }
            } else {
                try await APIClient.shared.detachTag(entityId: entityId, tagId: tag.id)
                await MainActor.run { entityTagIds.remove(tag.id) }
            }
        } catch {
            // No dedicated error handling here: the sheet stays open,
            // the user can simply try again.
        }
    }

    private func createAndAttachTag(label: String) async {
        do {
            let tag = try await APIClient.shared.createTag(label: label)
            try await APIClient.shared.attachTag(entityId: entityId, tagId: tag.id)
            await MainActor.run {
                if !allTags.contains(where: { $0.id == tag.id }) { allTags.append(tag) }
                entityTagIds.insert(tag.id)
            }
        } catch {
            // same: silent failure to keep it simple, the user can try again.
        }
    }

    private func addRelationship(targetEntityId: UUID, type: String) async {
        if let created = try? await APIClient.shared.createRelationship(
            sourceEntityId: entityId, targetEntityId: targetEntityId, relationshipType: type) {
            await MainActor.run { relationshipsFrom.append(created) }
        }
    }

    private func markSold(_ ownership: OwnershipRecord) {
        Task {
            if let updated = try? await APIClient.shared.markOwnershipSold(id: ownership.id) {
                await MainActor.run { upsertOwnership(updated) }
            }
        }
    }

    private func upsertOwnership(_ dto: OwnershipDTO) {
        if let existing = allOwnerships.first(where: { $0.id == dto.id }) {
            existing.condition = dto.condition
            existing.status = dto.status
            existing.note = dto.note
        } else {
            let record = OwnershipRecord(
                id: dto.id, entityId: dto.entityId, variantId: dto.variantId,
                condition: dto.condition, status: dto.status,
                acquiredAt: DateParsing.date(fromLocalDate: dto.acquiredAt), note: dto.note)
            modelContext.insert(record)
        }
    }

    private func upsertExperience(_ dto: ExperienceDTO) {
        if let existing = allExperiences.first(where: { $0.id == dto.id }) {
            existing.rating = dto.rating
            existing.comment = dto.comment
        } else {
            let record = ExperienceRecord(
                id: dto.id, entityId: dto.entityId, experienceType: dto.experienceType,
                occurredAt: DateParsing.date(fromLocalDate: dto.occurredAt),
                rating: dto.rating, comment: dto.comment)
            modelContext.insert(record)
        }
    }
}

enum DateParsing {
    /// Converts a "yyyy-MM-dd" date (LocalDate on the backend side) to a Swift Date.
    static func date(fromLocalDate string: String) -> Date {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        formatter.timeZone = TimeZone(identifier: "UTC")
        return formatter.date(from: string) ?? .now
    }

    static func localDateString(from date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        formatter.timeZone = TimeZone(identifier: "UTC")
        return formatter.string(from: date)
    }
}

/// Form to add an Experience: only type, rating and comment
/// (no detailed session tracking, as simplified during design).
/// Really calls POST /api/experiences then passes the result up to the
/// parent via onSaved, to upsert into the local cache.
private struct AddExperienceSheet: View {
    let entityId: UUID
    let allowedTypes: [String]
    let onSaved: (ExperienceDTO) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var selectedType: String = ""
    @State private var rating: Double = 7
    @State private var comment: String = ""
    @State private var isSubmitting = false
    @State private var errorMessage: String?

    var body: some View {
        NavigationStack {
            Form {
                Picker("Type", selection: $selectedType) {
                    ForEach(allowedTypes, id: \.self) { type in
                        Text(type.capitalized).tag(type)
                    }
                }
                Slider(value: $rating, in: 0...10, step: 1) {
                    Text("Note")
                } minimumValueLabel: {
                    Text("0")
                } maximumValueLabel: {
                    Text("10")
                }
                Text("Note : \(Int(rating))/10")
                TextField("Commentaire", text: $comment, axis: .vertical)
                    .lineLimit(3...6)

                if let errorMessage {
                    Text(errorMessage).foregroundStyle(.red).font(.caption)
                }
            }
            .navigationTitle("Nouvelle expérience")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Annuler") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Enregistrer") { submit() }
                        .disabled(selectedType.isEmpty || isSubmitting)
                }
            }
            .onAppear {
                if selectedType.isEmpty { selectedType = allowedTypes.first ?? "" }
            }
        }
    }

    private func submit() {
        isSubmitting = true
        errorMessage = nil
        let request = APIClient.RecordExperienceRequest(
            entityId: entityId,
            experienceType: selectedType,
            occurredAt: DateParsing.localDateString(from: .now),
            rating: Int(rating),
            comment: comment.isEmpty ? nil : comment
        )

        Task {
            do {
                let saved = try await APIClient.shared.recordExperience(request)
                await MainActor.run {
                    onSaved(saved)
                    isSubmitting = false
                    dismiss()
                }
            } catch {
                await MainActor.run {
                    errorMessage = "Échec de l'enregistrement : \(error.localizedDescription)"
                    isSubmitting = false
                }
            }
        }
    }
}

/// Lists all existing tags with a toggle, plus creating a
/// new tag directly linked. Stays open after each action to
/// allow managing several tags in a row.
private struct ManageTagsSheet: View {
    let allTags: [TagDTO]
    let attachedTagIds: Set<UUID>
    let onToggle: (TagDTO, Bool) -> Void
    let onCreateAndAttach: (String) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var newTagLabel: String = ""

    var body: some View {
        NavigationStack {
            Form {
                Section("Nouveau tag") {
                    HStack {
                        TextField("Ex : seinen, collector...", text: $newTagLabel)
                        Button("Ajouter") {
                            guard !newTagLabel.trimmingCharacters(in: .whitespaces).isEmpty else { return }
                            onCreateAndAttach(newTagLabel)
                            newTagLabel = ""
                        }
                        .disabled(newTagLabel.trimmingCharacters(in: .whitespaces).isEmpty)
                    }
                }
                Section("Tags existants") {
                    if allTags.isEmpty {
                        Text("Aucun tag créé pour l'instant").foregroundStyle(.secondary)
                    } else {
                        ForEach(allTags) { tag in
                            Button {
                                onToggle(tag, !attachedTagIds.contains(tag.id))
                            } label: {
                                HStack {
                                    Text(tag.label).foregroundStyle(.primary)
                                    Spacer()
                                    if attachedTagIds.contains(tag.id) {
                                        Image(systemName: "checkmark").foregroundStyle(.blue)
                                    }
                                }
                            }
                        }
                    }
                }
            }
            .navigationTitle("Tags")
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Fermer") { dismiss() }
                }
            }
        }
    }
}

/// Creates a typed Relationship to another Entity of the local cache
/// (no server search here - deliberately kept simple: choose
/// among what we already have at hand on the device).
private struct AddRelationshipSheet: View {
    let sourceEntityId: UUID
    let candidateEntities: [EntityRecord]
    let onCreate: (UUID, String) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var selectedTargetId: UUID?
    @State private var relationshipType: String = "ADAPTED_INTO"

    private let suggestedTypes = ["ADAPTED_INTO", "PART_OF_SERIES", "RELATED_TO"]

    var body: some View {
        NavigationStack {
            Form {
                Section("Élément lié") {
                    if candidateEntities.isEmpty {
                        Text("Aucun autre élément dans ta collection locale pour l'instant")
                            .foregroundStyle(.secondary)
                    } else {
                        Picker("Élément", selection: $selectedTargetId) {
                            Text("Choisir...").tag(UUID?.none)
                            ForEach(candidateEntities) { candidate in
                                Text(candidate.title).tag(Optional(candidate.id))
                            }
                        }
                    }
                }
                Section("Type de relation") {
                    Picker("Type", selection: $relationshipType) {
                        ForEach(suggestedTypes, id: \.self) { type in
                            Text(type.replacingOccurrences(of: "_", with: " ").capitalized).tag(type)
                        }
                    }
                    .pickerStyle(.segmented)
                    TextField("Ou un type personnalisé", text: $relationshipType)
                }
            }
            .navigationTitle("Nouvelle relation")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Annuler") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Créer") {
                        if let targetId = selectedTargetId {
                            onCreate(targetId, relationshipType)
                        }
                        dismiss()
                    }
                    .disabled(selectedTargetId == nil || relationshipType.trimmingCharacters(in: .whitespaces).isEmpty)
                }
            }
        }
    }
}
