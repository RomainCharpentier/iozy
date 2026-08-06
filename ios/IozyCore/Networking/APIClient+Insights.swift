import Foundation

struct StatsSummaryDTO: Decodable {
    let totalEntities: Int
    let totalActiveOwnerships: Int
    let wishlistCount: Int
    let experiencesThisYear: Int
    let byType: [TypeStatsDTO]
    let topTags: [TagCountDTO]

    struct TypeStatsDTO: Decodable, Identifiable {
        let entityTypeCode: String
        let entityTypeLabel: String
        let entityCount: Int
        let activeOwnershipCount: Int
        let experienceCount: Int
        let averageRating: Double?

        var id: String { entityTypeCode }
    }

    struct TagCountDTO: Decodable, Identifiable {
        let label: String
        let count: Int

        var id: String { label }
    }
}

struct DiscoveryCandidateDTO: Decodable, Identifiable {
    let source: String
    let externalId: String
    let title: String
    let imageUrl: String?
    let reason: String

    var id: String { "\(source)-\(externalId)" }
}

extension APIClient {
    func fetchStatsSummary() async throws -> StatsSummaryDTO {
        try await get("/insights/stats")
    }

    /// entityTypeCode attendu : "MANGA" ou "BOARD_GAME" (pas de découverte
    /// pour les jeux vidéo, IGDB non branché - voir InsightsController).
    func fetchDiscovery(entityTypeCode: String) async throws -> [DiscoveryCandidateDTO] {
        try await get("/insights/discover?entityTypeCode=\(entityTypeCode)")
    }
}
