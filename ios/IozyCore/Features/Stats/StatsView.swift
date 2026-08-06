import SwiftUI
import SwiftData

/// UC6 - Consulter les Statistiques (vision produit, étape 1 et user
/// stories, étape 4). Lecture seule, toujours interrogée en direct au
/// premier affichage : les stats n'ont de sens qu'à jour, pas de cache
/// local pour cet écran (contrairement à Ownership/Experience qui doivent
/// rester consultables hors ligne).
///
/// Complétée par une section Découvertes (heuristique, pas d'IA) : chargée
/// à la demande plutôt qu'automatiquement, car les appels BGG (/hot puis
/// /thing par jeu) peuvent prendre plusieurs secondes.
struct StatsView: View {
    @Environment(\.modelContext) private var modelContext
    @Query(sort: \EntityTypeRecord.label) private var entityTypes: [EntityTypeRecord]

    @State private var summary: StatsSummaryDTO?
    @State private var isLoading = false
    @State private var errorMessage: String?

    @State private var mangaDiscoveries: [DiscoveryCandidateDTO]?
    @State private var boardGameDiscoveries: [DiscoveryCandidateDTO]?
    @State private var videoGameDiscoveries: [DiscoveryCandidateDTO]?
    @State private var isLoadingDiscoveries = false
    @State private var addedTitles: Set<String> = []

    private let gridColumns = [GridItem(.flexible(), spacing: 10), GridItem(.flexible(), spacing: 10)]

    var body: some View {
        NavigationStack {
            ScrollView {
                Group {
                    if let summary {
                        content(for: summary)
                    } else if isLoading {
                        ProgressView().tint(Theme.accent).padding(.top, 60)
                    } else if let errorMessage {
                        ContentUnavailableView(
                            "Statistiques indisponibles",
                            systemImage: "wifi.slash",
                            description: Text(errorMessage)
                        )
                        .padding(.top, 40)
                    }
                }
                .padding(.horizontal, 20)
                .padding(.top, 8)
            }
            .background(Theme.background)
            .navigationTitle("Statistiques")
            .toolbarBackground(Theme.background, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .refreshable { await load() }
            .task { await load() }
            .task {
                await EntityTypeRecord.syncFromServer(modelContext: modelContext, existing: entityTypes)
            }
        }
    }

    @ViewBuilder
    private func content(for summary: StatsSummaryDTO) -> some View {
        VStack(alignment: .leading, spacing: 26) {
            LazyVGrid(columns: gridColumns, spacing: 10) {
                StatCard(value: "\(summary.totalEntities)", label: "Éléments au total")
                StatCard(value: "\(summary.totalActiveOwnerships)", label: "Possédés")
                StatCard(value: "\(summary.wishlistCount)", label: "Wishlist")
                StatCard(value: "\(summary.experiencesThisYear)", label: "Cette année")
            }

            VStack(alignment: .leading, spacing: 10) {
                sectionTitle("Par type")
                ForEach(summary.byType) { typeStats in
                    typeCard(typeStats)
                }
            }

            if !summary.topTags.isEmpty {
                VStack(alignment: .leading, spacing: 10) {
                    sectionTitle("Tags les plus utilisés")
                    VStack(spacing: 0) {
                        ForEach(Array(summary.topTags.enumerated()), id: \.element.id) { index, tagCount in
                            HStack {
                                Text(tagCount.label).font(Theme.bodyMedium(13)).foregroundStyle(Theme.textPrimary)
                                Spacer()
                                Text("\(tagCount.count)").font(Theme.body(12)).foregroundStyle(Theme.textDim)
                            }
                            .padding(.vertical, 10)
                            if index < summary.topTags.count - 1 {
                                Divider().overlay(Theme.surface2)
                            }
                        }
                    }
                    .padding(.horizontal, 14)
                    .background(Theme.surface, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
                }
            }

            discoverySection
                .padding(.bottom, 30)
        }
    }

    private func typeCard(_ typeStats: StatsSummaryDTO.TypeStatsDTO) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(typeStats.entityTypeLabel).font(Theme.bodySemibold(14)).foregroundStyle(Theme.textPrimary)
            HStack(spacing: 20) {
                statChip("\(typeStats.entityCount)", label: "au total")
                statChip("\(typeStats.activeOwnershipCount)", label: "possédés")
                statChip("\(typeStats.experienceCount)", label: "expériences")
            }
            if let averageRating = typeStats.averageRating {
                Text(String(format: "★ note moyenne %.1f/10", averageRating))
                    .font(Theme.body(12))
                    .foregroundStyle(Theme.accent)
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.surface, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
    }

    private func statChip(_ value: String, label: String) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(value).font(Theme.displayMedium(17)).foregroundStyle(Theme.textPrimary)
            Text(label).font(Theme.body(10.5)).foregroundStyle(Theme.textDim)
        }
    }

    private func sectionTitle(_ text: String) -> some View {
        Text(text).font(Theme.displayMedium(17)).foregroundStyle(Theme.textPrimary)
    }

    // MARK: - Découvertes (heuristique, pas d'IA)

    @ViewBuilder
    private var discoverySection: some View {
        VStack(alignment: .leading, spacing: 10) {
            sectionTitle("Découvertes")

            if mangaDiscoveries == nil && boardGameDiscoveries == nil && videoGameDiscoveries == nil {
                Button {
                    Task { await loadDiscoveries() }
                } label: {
                    HStack {
                        if isLoadingDiscoveries {
                            ProgressView().tint(Theme.accentText)
                            Text("Recherche de suggestions...")
                        } else {
                            Image(systemName: "sparkles")
                            Text("Voir des suggestions")
                        }
                    }
                    .font(Theme.bodySemibold(14))
                    .foregroundStyle(Theme.accentText)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 14)
                    .background(Theme.accent, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                }
                .disabled(isLoadingDiscoveries)
            } else {
                if let mangaTypeId = entityTypes.first(where: { $0.code == "MANGA" })?.id {
                    discoveryList(mangaDiscoveries, entityTypeId: mangaTypeId, condition: "NEW")
                }
                if let boardGameTypeId = entityTypes.first(where: { $0.code == "BOARD_GAME" })?.id {
                    discoveryList(boardGameDiscoveries, entityTypeId: boardGameTypeId, condition: "NEW")
                }
                if let videoGameTypeId = entityTypes.first(where: { $0.code == "VIDEO_GAME" })?.id {
                    discoveryList(videoGameDiscoveries, entityTypeId: videoGameTypeId, condition: "NEW")
                }
            }

            Text("Suggestions basées sur ce que tu possèdes déjà (même auteur, catégories en commun) - pas de recommandation par IA.")
                .font(Theme.body(11.5))
                .foregroundStyle(Theme.textDim)
        }
    }

    @ViewBuilder
    private func discoveryList(_ candidates: [DiscoveryCandidateDTO]?, entityTypeId: UUID, condition: String) -> some View {
        if let candidates, !candidates.isEmpty {
            VStack(spacing: 8) {
                ForEach(candidates) { candidate in
                    HStack {
                        VStack(alignment: .leading, spacing: 3) {
                            Text(candidate.title).font(Theme.bodySemibold(13)).foregroundStyle(Theme.textPrimary)
                            Text(candidate.reason).font(Theme.body(11.5)).foregroundStyle(Theme.textDim)
                        }
                        Spacer()
                        if addedTitles.contains(candidate.title) {
                            Image(systemName: "checkmark.circle.fill").foregroundStyle(Theme.accent)
                        } else {
                            Button("Ajouter") {
                                Task { await addDiscovery(candidate, entityTypeId: entityTypeId, condition: condition) }
                            }
                            .font(Theme.bodyMedium(12))
                            .foregroundStyle(Theme.accent)
                        }
                    }
                    .padding(12)
                    .background(Theme.surface, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                }
            }
        }
    }

    private func addDiscovery(_ candidate: DiscoveryCandidateDTO, entityTypeId: UUID, condition: String) async {
        var attributes: [String: String] = [:]
        if candidate.source == "BGG" { attributes["bggId"] = candidate.externalId }
        if candidate.source == "JIKAN" { attributes["malId"] = candidate.externalId }
        if candidate.source == "IGDB" { attributes["igdbId"] = candidate.externalId }

        if let result = try? await APIClient.shared.quickAdd(
            entityTypeId: entityTypeId, title: candidate.title, condition: condition, attributes: attributes) {
            await MainActor.run {
                if !result.matchedExistingEntity {
                    modelContext.insert(EntityRecord(
                        id: result.entityId, entityTypeId: entityTypeId, title: candidate.title, attributesJSON: "{}"))
                }
                addedTitles.insert(candidate.title)
            }
        }
    }

    private func loadDiscoveries() async {
        isLoadingDiscoveries = true
        async let mangaTask = try? APIClient.shared.fetchDiscovery(entityTypeCode: "MANGA")
        async let boardGameTask = try? APIClient.shared.fetchDiscovery(entityTypeCode: "BOARD_GAME")
        async let videoGameTask = try? APIClient.shared.fetchDiscovery(entityTypeCode: "VIDEO_GAME")
        let (manga, boardGames, videoGames) = await (mangaTask, boardGameTask, videoGameTask)
        mangaDiscoveries = manga ?? []
        boardGameDiscoveries = boardGames ?? []
        videoGameDiscoveries = videoGames ?? []
        isLoadingDiscoveries = false
    }

    private func load() async {
        isLoading = true
        errorMessage = nil
        do {
            summary = try await APIClient.shared.fetchStatsSummary()
        } catch {
            errorMessage = "Impossible de charger les statistiques (vérifie ta connexion au backend)."
        }
        isLoading = false
    }
}
