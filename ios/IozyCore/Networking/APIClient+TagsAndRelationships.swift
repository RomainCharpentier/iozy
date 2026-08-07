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

    /// Le backend réutilise un tag existant si le label correspond déjà
    /// (voir TagController côté Spring) - pas de risque de doublon ici.
    func createTag(label: String) async throws -> TagDTO {
        try await post("/tags", body: CreateTagRequest(label: label))
    }

    func attachTag(entityId: UUID, tagId: UUID) async throws {
        try await postEmpty("/tags/entities/\(entityId.uuidString)/\(tagId.uuidString)")
    }

    func detachTag(entityId: UUID, tagId: UUID) async throws {
        try await delete("/tags/entities/\(entityId.uuidString)/\(tagId.uuidString)")
    }

    // MARK: - Entity (détail, avec tagIds - distinct de EntityRecord qui est le cache local)

    struct EntityDetailDTO: Codable {
        let id: UUID
        let entityTypeId: UUID
        let title: String
        let attributes: [String: AnyCodableValue]
        let tagIds: [UUID]
    }

    func fetchEntity(id: UUID) async throws -> EntityDetailDTO {
        try await get("/entities/\(id.uuidString)")
    }

    /// Recherche transversale sur la collection (UC4) - par titre, tous
    /// types confondus si entityTypeId est nil. C'est la vraie recherche
    /// dans ta collection, distincte de searchMetadata (qui interroge des
    /// sources externes comme Jikan/BGG pour préparer un ajout).
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

    /// Utilisé pour rafraîchir le cache local après un import en masse (BGG).
    func fetchAllEntities(entityTypeId: UUID) async throws -> [EntityDetailDTO] {
        try await get("/entities?entityTypeId=\(entityTypeId.uuidString)")
    }

    // MARK: - Import de collection BGG

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
