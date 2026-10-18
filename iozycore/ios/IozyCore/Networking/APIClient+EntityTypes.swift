import Foundation

/// Mirror of EntityTypeDtos.EntityTypeResponse on the backend side - types
/// are no longer hard-coded (see the dynamic type editor, screen
/// EntityTypeListView) but fetched from the API and cached locally
/// (EntityTypeRecord) to stay available offline in the pickers.
struct EntityTypeDTO: Codable, Identifiable, Hashable {
    let id: UUID
    let code: String
    let label: String
    let allowedExperienceTypes: [String]
    let customFieldKeys: [String]
    /// At least one metadata provider (Jikan/BGG/IGDB) supports this
    /// type - never the case for a custom type created with this editor.
    let hasMetadataProvider: Bool
}

struct CreateEntityTypeRequest: Encodable {
    let code: String
    let label: String
    let allowedExperienceTypes: [String]
    let customFieldKeys: [String]
}

/// The code can never be changed after creation (see EntityTypeService on the backend side).
struct UpdateEntityTypeRequest: Encodable {
    let label: String
    let allowedExperienceTypes: [String]
    let customFieldKeys: [String]
}

extension APIClient {
    func listEntityTypes() async throws -> [EntityTypeDTO] {
        try await get("/entity-types")
    }

    func createEntityType(_ request: CreateEntityTypeRequest) async throws -> EntityTypeDTO {
        try await post("/entity-types", body: request)
    }

    func updateEntityType(id: UUID, _ request: UpdateEntityTypeRequest) async throws -> EntityTypeDTO {
        try await patch("/entity-types/\(id.uuidString)", body: request)
    }

    /// Blocked on the server side (409) if Entities of this type still exist.
    func deleteEntityType(id: UUID) async throws {
        try await delete("/entity-types/\(id.uuidString)")
    }
}
