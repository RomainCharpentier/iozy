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

/// Un tome précis d'une édition réelle d'une série (voir VolumeCandidate
/// côté backend) - pour la sélection visuelle des tomes possédés (façon
/// Mangacollec), plutôt qu'une saisie manuelle du numéro de tome.
struct VolumeCandidateDTO: Codable, Identifiable, Hashable {
    let edition: String
    let volumeNumber: Int
    let imageUrl: String?
    let title: String
    // Une Ownership active référence déjà le Variant correspondant (série
    // déjà présente dans la collection) - purement indicatif, ne bloque
    // jamais la sélection (un 2e exemplaire du même tome reste possible).
    let alreadyOwned: Bool

    // Une même série peut avoir plusieurs éditions avec chacune un tome
    // numéro 1 - l'id doit donc combiner édition + numéro, jamais le numéro seul.
    var id: String { "\(edition)|\(volumeNumber)" }
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

    private struct FrenchTitleResponse: Decodable {
        let frenchTitle: String
    }

    /// Recherche best-effort d'un titre d'édition française (Open Library,
    /// puis Google Books en repli) - à n'appeler qu'une fois par sélection de
    /// suggestion (voir QuickAddView.selectCandidate), jamais pour toute une
    /// liste de résultats. `author` (mangaka) est optionnel mais améliore
    /// nettement la précision. Renvoie nil si rien trouvé (404), pas une
    /// erreur : l'appelant garde alors le titre anglais/romaji déjà affiché.
    func fetchFrenchTitle(entityTypeId: UUID, query: String, author: String? = nil) async throws -> String? {
        let encodedQuery = query.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? query
        var path = "/metadata/french-title?entityTypeId=\(entityTypeId.uuidString)&query=\(encodedQuery)"
        if let author, !author.isEmpty {
            let encodedAuthor = author.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? author
            path += "&author=\(encodedAuthor)"
        }
        do {
            let response: FrenchTitleResponse = try await get(path)
            return response.frenchTitle
        } catch APIError.serverError(let statusCode, _) where statusCode == 404 {
            return nil
        }
    }

    /// volumeNumber/edition/volumeImageUrl sont optionnels et réservés au cas
    /// "tome d'une série" (Manga) - voir QuickAddService côté backend. nil
    /// pour les appelants qui n'en ont pas besoin (ex: ajout depuis Découverte).
    /// volumeImageUrl est la jaquette de CE tome précis (voir VolumeCandidateDTO),
    /// distincte de la jaquette de la série éventuellement présente dans `attributes`.
    struct QuickAddWithAttributesRequest: Encodable {
        let entityTypeId: UUID
        let title: String
        let condition: String
        let attributes: [String: String]
        let volumeNumber: Int?
        let edition: String?
        let volumeImageUrl: String?
    }

    func quickAdd(entityTypeId: UUID, title: String, condition: String, attributes: [String: String],
                  volumeNumber: Int? = nil, edition: String? = nil, volumeImageUrl: String? = nil) async throws -> APIClient.QuickAddResponse {
        let body = QuickAddWithAttributesRequest(
            entityTypeId: entityTypeId, title: title, condition: condition, attributes: attributes,
            volumeNumber: volumeNumber, edition: edition, volumeImageUrl: volumeImageUrl)
        return try await post("/entities/quick-add", body: body)
    }

    /// Recherche best-effort des tomes réels (avec jaquette) des éditions
    /// françaises d'une série (Google Books) - pour la sélection visuelle des
    /// tomes possédés (voir VolumeSelectionGrid). Liste vide = rien trouvé,
    /// jamais une erreur : l'appelant garde alors la saisie manuelle du tome.
    /// Résultat stocké durablement côté backend - un résultat une fois trouvé
    /// n'est plus jamais rappelé automatiquement, forceRefresh (bouton
    /// "Actualiser") est le seul moyen de relancer les 8 requêtes Google Books
    /// derrière ce candidat.
    func searchVolumes(entityTypeId: UUID, title: String, author: String? = nil, forceRefresh: Bool = false) async throws -> [VolumeCandidateDTO] {
        let encodedTitle = title.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? title
        var path = "/metadata/volumes?entityTypeId=\(entityTypeId.uuidString)&title=\(encodedTitle)"
        if let author, !author.isEmpty {
            let encodedAuthor = author.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? author
            path += "&author=\(encodedAuthor)"
        }
        if forceRefresh {
            path += "&forceRefresh=true"
        }
        return try await get(path)
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
