import Foundation

/// DTOs miroir des réponses JSON du backend (OwnershipController,
/// ExperienceController). occurredAt/acquiredAt restent des String
/// (format "yyyy-MM-dd", LocalDate côté Java) plutôt que des Date Swift,
/// pour éviter tout conflit avec la stratégie .iso8601 du JSONDecoder
/// (pensée pour des timestamps complets, pas des dates seules).
struct OwnershipDTO: Codable, Identifiable {
    let id: UUID
    let entityId: UUID
    let variantId: UUID?
    let condition: String
    let status: String
    let acquiredAt: String
    let note: String?
}

struct ExperienceDTO: Codable, Identifiable {
    let id: UUID
    let entityId: UUID
    let experienceType: String
    let occurredAt: String
    let rating: Int?
    let comment: String?
}

struct MetadataCandidateDTO: Codable, Identifiable {
    let source: String
    let externalId: String
    let title: String
    let imageUrl: String?
    let attributes: [String: AnyCodableValue]

    var id: String { "\(source)-\(externalId)" }
}

/// Wrapper minimal pour décoder un Map<String, Object> JSON hétérogène
/// (String/Number/Bool) renvoyé par le backend (attributes de MetadataCandidate).
struct AnyCodableValue: Codable {
    let stringValue: String

    init(from decoder: Swift.Decoder) throws {
        let container = try decoder.singleValueContainer()
        if let string = try? container.decode(String.self) {
            stringValue = string
        } else if let int = try? container.decode(Int.self) {
            stringValue = String(int)
        } else if let double = try? container.decode(Double.self) {
            stringValue = String(double)
        } else if let bool = try? container.decode(Bool.self) {
            stringValue = String(bool)
        } else {
            stringValue = ""
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        try container.encode(stringValue)
    }
}

struct EmptyBody: Encodable {}

extension APIClient {

    // MARK: - Metadata Enrichment (Jikan / BGG)

    func searchMetadata(entityTypeId: UUID, query: String) async throws -> [MetadataCandidateDTO] {
        guard let encodedQuery = query.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) else {
            return []
        }
        return try await get("/metadata/search?entityTypeId=\(entityTypeId.uuidString)&query=\(encodedQuery)")
    }

    /// Renvoie nil si aucune métadonnée n'a été trouvée pour ce code-barres
    /// (404 côté backend) plutôt que de propager une erreur - un ISBN
    /// inconnu n'est pas un cas exceptionnel, juste "pas de résultat".
    func lookupBarcode(entityTypeId: UUID, barcode: String) async throws -> MetadataCandidateDTO? {
        let encodedBarcode = barcode.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? barcode
        do {
            return try await get("/metadata/lookup-barcode?entityTypeId=\(entityTypeId.uuidString)&barcode=\(encodedBarcode)")
        } catch APIError.serverError(let statusCode, _) where statusCode == 404 {
            return nil
        }
    }

    struct QuickAddWithAttributesRequest: Encodable {
        let entityTypeId: UUID
        let title: String
        let condition: String
        let attributes: [String: String]
    }

    func quickAdd(entityTypeId: UUID, title: String, condition: String, attributes: [String: String]) async throws -> APIClient.QuickAddResponse {
        let body = QuickAddWithAttributesRequest(
            entityTypeId: entityTypeId, title: title, condition: condition, attributes: attributes)
        return try await post("/entities/quick-add", body: body)
    }

    // MARK: - Ownership (UC2)

    func fetchOwnerships(entityId: UUID) async throws -> [OwnershipDTO] {
        try await get("/ownerships?entityId=\(entityId.uuidString)")
    }

    func markOwnershipSold(id: UUID) async throws -> OwnershipDTO {
        try await post("/ownerships/\(id.uuidString)/sell", body: EmptyBody())
    }

    func markOwnershipLost(id: UUID) async throws -> OwnershipDTO {
        try await post("/ownerships/\(id.uuidString)/lose", body: EmptyBody())
    }

    // MARK: - Experience (UC3)

    func fetchExperiences(entityId: UUID) async throws -> [ExperienceDTO] {
        try await get("/experiences?entityId=\(entityId.uuidString)")
    }

    struct RecordExperienceRequest: Encodable {
        let entityId: UUID
        let experienceType: String
        let occurredAt: String   // "yyyy-MM-dd"
        let rating: Int?
        let comment: String?
    }

    func recordExperience(_ request: RecordExperienceRequest) async throws -> ExperienceDTO {
        try await post("/experiences", body: request)
    }
}
