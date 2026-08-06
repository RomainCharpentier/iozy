import SwiftUI
import SwiftData

/// Parcours 2 ("le curateur du soir", étape 5) : fiche complète en un
/// seul écran (infos, Ownership, historique d'Experience), avec ajout
/// d'une nouvelle Experience (note + commentaire uniquement, comme
/// simplifié en conception).
///
/// Synchronisation : au premier affichage, les Ownership et Experience
/// sont récupérées depuis l'API et mises à jour dans le cache SwiftData
/// local (upsert par id) - le cache local n'est donc plus juste rempli
/// par le parcours d'ajout rapide, il reflète aussi ce qui existe déjà
/// côté serveur.
///
/// Direction visuelle validée : hero en dégradé avec le titre en grand,
/// statuts en pills, tags en chips, cartes sombres pour les expériences.
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
    @State private var showingAddTag = false
    @State private var showingAddRelationship = false

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

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                hero
                VStack(alignment: .leading, spacing: 22) {
                    statusPills
                    tagsSection
                    experiencesSection
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

    // MARK: - Sections visuelles

    private var hero: some View {
        ZStack(alignment: .bottomLeading) {
            (entity.map { Theme.gradient(for: $0.title) } ?? LinearGradient(colors: [Theme.surface, Theme.surface2], startPoint: .top, endPoint: .bottom))
                .frame(height: 210)

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
            ForEach(ownerships) { ownership in
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
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("Possession").font(Theme.bodySemibold(13)).foregroundStyle(Theme.textPrimary)
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

    private var relatedSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            sectionTitle("Relations")
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 10) {
                    ForEach(relatedEntities) { related in
                        NavigationLink(value: related.id) {
                            CoverTile(title: related.title)
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

    // MARK: - Synchronisation avec l'API

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
            allTags = tags
            relationshipsFrom = relFrom
            relationshipsTo = relTo
            await EntityTypeRecord.syncFromServer(modelContext: modelContext, existing: entityTypes)
        } catch {
            // Échec réseau : on garde le cache local existant (utile hors ligne),
            // on informe juste que la synchronisation n'a pas pu se faire.
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
            // Pas de gestion d'erreur dédiée ici : le sheet reste ouvert,
            // l'utilisateur peut simplement retenter.
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
            // idem : échec silencieux pour rester simple, l'utilisateur peut retenter.
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
    /// Convertit une date "yyyy-MM-dd" (LocalDate côté backend) en Date Swift.
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

/// Formulaire d'ajout d'Experience : uniquement type, note et commentaire
/// (pas de suivi de session détaillé, comme simplifié en conception).
/// Appelle réellement POST /api/experiences puis remonte le résultat au
/// parent via onSaved, pour upsert dans le cache local.
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

/// Liste tous les tags existants avec un toggle, plus la création d'un
/// nouveau tag directement associé. Reste ouvert après chaque action pour
/// permettre de gérer plusieurs tags d'affilée.
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

/// Crée une Relationship typée vers une autre Entity du cache local
/// (pas de recherche serveur ici - reste volontairement simple : choisir
/// parmi ce qu'on a déjà sous la main sur l'appareil).
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
