import Foundation

/// Miroir de EntityTypeDtos.EntityTypeResponse côté backend - les types ne
/// sont plus codés en dur (voir l'éditeur de types dynamique, écran
/// EntityTypeListView) mais récupérés depuis l'API et mis en cache local
/// (EntityTypeRecord) pour rester disponibles hors ligne dans les pickers.
struct EntityTypeDTO: Codable, Identifiable, Hashable {
    let id: UUID
    let code: String
    let label: String
    let allowedExperienceTypes: [String]
    let customFieldKeys: [String]
    /// Au moins un fournisseur de métadonnées (Jikan/BGG/IGDB) supporte ce
    /// type - jamais le cas pour un type personnalisé créé via cet éditeur.
    let hasMetadataProvider: Bool
}

struct CreateEntityTypeRequest: Encodable {
    let code: String
    let label: String
    let allowedExperienceTypes: [String]
    let customFieldKeys: [String]
}

/// Le code n'est jamais modifiable après création (voir EntityTypeService côté backend).
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

    /// Bloqué côté serveur (409) si des Entity de ce type existent encore.
    func deleteEntityType(id: UUID) async throws {
        try await delete("/entity-types/\(id.uuidString)")
    }
}
