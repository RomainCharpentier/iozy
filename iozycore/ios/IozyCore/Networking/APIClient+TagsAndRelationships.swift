import Foundation

struct TagDTO: Codable, Identifiable, Hashable {
    let id: UUID
    let label: String
}

struct RelationshipDTO: Codable, Identifiable {
    let id: UUID
    let sourceEntityId: UUID
    let targetEntityId: UUID
    let relationshipType: String
}

extension APIClient {

    // MARK: - Tags

    func fetchAllTags() async throws -> [TagDTO] {
        try await get("/tags")
    }

    struct CreateTagRequest: Encodable {
        let label: String
    }

    /// The backend reuses an existing tag if the label already matches
    /// (see TagController on the Spring side) - no risk of a duplicate here.
    func createTag(label: String) async throws -> TagDTO {
        try await post("/tags", body: CreateTagRequest(label: label))
    }

    func attachTag(entityId: UUID, tagId: UUID) async throws {
        try await postEmpty("/tags/entities/\(entityId.uuidString)/\(tagId.uuidString)")
    }

    func detachTag(entityId: UUID, tagId: UUID) async throws {
        try await delete("/tags/entities/\(entityId.uuidString)/\(tagId.uuidString)")
    }

    // MARK: - Entity (detail, with tagIds - distinct from EntityRecord which is the local cache)

    /// Exact volume of an edition (e.g. "Volume 3 — Kana") - see Variant on the
    /// backend domain side. attributes typically contains volumeNumber (Int)
    /// and edition (String), both optional.
    struct VariantDTO: Codable, Identifiable, Hashable {
        let id: UUID
        let label: String
        let attributes: [String: AnyCodableValue]

        static func == (lhs: VariantDTO, rhs: VariantDTO) -> Bool { lhs.id == rhs.id }
        func hash(into hasher: inout Hasher) { hasher.combine(id) }
    }

    struct EntityDetailDTO: Codable {
        let id: UUID
        let entityTypeId: UUID
        let title: String
        let attributes: [String: AnyCodableValue]
        let tagIds: [UUID]
        let variants: [VariantDTO]
    }

    func fetchEntity(id: UUID) async throws -> EntityDetailDTO {
        try await get("/entities/\(id.uuidString)")
    }

    /// Cross search on the collection (UC4) - by title, all
    /// types together if entityTypeId is nil. This is the real search
    /// in your collection, different from searchMetadata (which queries external
    /// sources like Jikan/BGG to prepare an add).
    func searchEntities(query: String, entityTypeId: UUID? = nil, tagId: UUID? = nil) async throws -> [EntityDetailDTO] {
        var path = "/entities/search?"
        var components: [String] = []
        if let encodedQuery = query.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed), !query.isEmpty {
            components.append("q=\(encodedQuery)")
        }
        if let entityTypeId {
            components.append("entityTypeId=\(entityTypeId.uuidString)")
        }
        if let tagId {
            components.append("tagId=\(tagId.uuidString)")
        }
        path += components.joined(separator: "&")
        return try await get(path)
    }

    /// Used to refresh the local cache after a bulk import (BGG).
    func fetchAllEntities(entityTypeId: UUID) async throws -> [EntityDetailDTO] {
        try await get("/entities?entityTypeId=\(entityTypeId.uuidString)")
    }

    // MARK: - BGG collection import

    struct BggImportResult: Decodable {
        let totalFound: Int
        let created: Int
        let matchedExisting: Int
        let failed: Int
    }

    func importBggCollection(username: String) async throws -> BggImportResult {
        guard let encodedUsername = username.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) else {
            throw APIError.invalidResponse
        }
        return try await post("/metadata/bgg/import?username=\(encodedUsername)", body: EmptyBody())
    }

    // MARK: - Relationships

    struct CreateRelationshipRequest: Encodable {
        let sourceEntityId: UUID
        let targetEntityId: UUID
        let relationshipType: String
    }

    func createRelationship(sourceEntityId: UUID, targetEntityId: UUID, relationshipType: String) async throws -> RelationshipDTO {
        try await post("/relationships", body: CreateRelationshipRequest(
            sourceEntityId: sourceEntityId, targetEntityId: targetEntityId, relationshipType: relationshipType))
    }

    func fetchRelationshipsFrom(entityId: UUID) async throws -> [RelationshipDTO] {
        try await get("/relationships/from/\(entityId.uuidString)")
    }

    func fetchRelationshipsTo(entityId: UUID) async throws -> [RelationshipDTO] {
        try await get("/relationships/to/\(entityId.uuidString)")
    }
}
