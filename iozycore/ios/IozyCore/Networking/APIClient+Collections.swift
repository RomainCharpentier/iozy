import Foundation

/// DTOs mirroring the JSON responses of the backend (OwnershipController,
/// ExperienceController). occurredAt/acquiredAt stay Strings
/// (format "yyyy-MM-dd", LocalDate on the Java side) rather than Swift Dates,
/// to avoid any conflict with the .iso8601 strategy of the JSONDecoder
/// (made for full timestamps, not for dates alone).
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

/// An exact volume of a real edition of a series (see VolumeCandidate
/// on the backend side) - for the visual selection of owned volumes (like
/// Mangacollec), rather than typing the volume number by hand.
struct VolumeCandidateDTO: Codable, Identifiable, Hashable {
    let edition: String
    let volumeNumber: Int
    let imageUrl: String?
    let title: String
    // An active Ownership already references the matching Variant (series
    // already in the collection) - only informative, never blocks
    // the selection (a 2nd copy of the same volume is still possible).
    let alreadyOwned: Bool

    // The same series can have several editions, each with a volume
    // number 1 - so the id must combine edition + number, never the number alone.
    var id: String { "\(edition)|\(volumeNumber)" }
}

/// Response of GET /metadata/volumes (see VolumesResponse on the backend side) -
/// `quotaExceeded` tells an empty `volumes` meaning "no edition found" apart from
/// a Google Books quota exceeded on all configured keys, to show
/// a suitable message instead of wrongly suggesting that there is nothing.
struct VolumesResponseDTO: Codable {
    let volumes: [VolumeCandidateDTO]
    let quotaExceeded: Bool
}

/// Minimal wrapper to decode a heterogeneous JSON Map<String, Object>
/// (String/Number/Bool) returned by the backend (attributes of MetadataCandidate).
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

    /// Returns nil if no metadata was found for this barcode
    /// (404 on the backend side) instead of propagating an error - an unknown
    /// ISBN is not an exceptional case, just "no result".
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

    /// Best-effort search of a French edition title (Open Library,
    /// then Google Books as a fallback) - to be called only once per selected
    /// suggestion (see QuickAddView.selectCandidate), never for a whole
    /// list of results. `author` (mangaka) is optional but clearly improves
    /// precision. `malId` (already known from the selected candidate)
    /// lets us discard a known sequel/spin-off (see RelatedSeriesService
    /// on the backend side) wrongly resolved instead of the searched title - e.g. "Dragon
    /// Ball Super nº 18" for "Dragon Ball" (checked manually, see
    /// history) - best-effort, no effect if absent. `titleRomaji` is
    /// tried as a fallback for `query` for this same detection (checked
    /// manually on "Attack on Titan"/"Shingeki no Kyojin", see
    /// history) - a spin-off can be indexed on the MyAnimeList side under the
    /// romaji title rather than the displayed title. Returns nil if nothing
    /// found (404), not an error: the caller then keeps the
    /// English/romaji title already displayed.
    func fetchFrenchTitle(entityTypeId: UUID, query: String, author: String? = nil, malId: String? = nil, titleRomaji: String? = nil) async throws -> String? {
        let encodedQuery = query.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? query
        var path = "/metadata/french-title?entityTypeId=\(entityTypeId.uuidString)&query=\(encodedQuery)"
        if let author, !author.isEmpty {
            let encodedAuthor = author.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? author
            path += "&author=\(encodedAuthor)"
        }
        if let malId, !malId.isEmpty {
            path += "&malId=\(malId)"
        }
        if let titleRomaji, !titleRomaji.isEmpty {
            let encodedTitleRomaji = titleRomaji.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? titleRomaji
            path += "&titleRomaji=\(encodedTitleRomaji)"
        }
        do {
            let response: FrenchTitleResponse = try await get(path)
            return response.frenchTitle
        } catch APIError.serverError(let statusCode, _) where statusCode == 404 {
            return nil
        }
    }

    /// volumeNumber/edition/volumeImageUrl are optional and reserved for the
    /// "volume of a series" case (Manga) - see QuickAddService on the backend side. nil
    /// for callers that do not need them (e.g. add from Discovery).
    /// volumeImageUrl is the cover art of THIS exact volume (see VolumeCandidateDTO),
    /// different from the cover art of the series that may be in `attributes`.
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

    /// Best-effort search of the real volumes (with cover art) of the French
    /// editions of a series (Google Books) - for the visual selection of
    /// owned volumes (see VolumeSelectionGrid). Empty `volumes` = nothing
    /// found, never an error: the caller then keeps the manual entry
    /// of the volume - `quotaExceeded` tells this case apart from a Google Books quota
    /// exceeded (see VolumesResponseDTO). Result stored durably on the
    /// backend side - a result once found is never called again
    /// automatically, forceRefresh ("Actualiser" button) is the only way
    /// to run again the requests covered by the initial search (most common
    /// edition keywords). deepSearch ("Chercher plus
    /// d'éditions" button) also MERGES with rarer keywords, never
    /// run automatically because of their cost - incompatible with forceRefresh,
    /// deepSearch then has priority on the backend side. malId+originalTitle
    /// (already known from the selected candidate) let us discard a known
    /// spin-off/side-story (see RelatedSeriesService on the backend side) -
    /// best-effort, no effect if one of the two is missing. titleRomaji is
    /// tried as a fallback for originalTitle for this same detection (see
    /// fetchFrenchTitle above).
    func searchVolumes(entityTypeId: UUID, title: String, author: String? = nil, forceRefresh: Bool = false, deepSearch: Bool = false, malId: String? = nil, originalTitle: String? = nil, titleRomaji: String? = nil) async throws -> VolumesResponseDTO {
        let encodedTitle = title.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? title
        var path = "/metadata/volumes?entityTypeId=\(entityTypeId.uuidString)&title=\(encodedTitle)"
        if let author, !author.isEmpty {
            let encodedAuthor = author.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? author
            path += "&author=\(encodedAuthor)"
        }
        if forceRefresh {
            path += "&forceRefresh=true"
        }
        if deepSearch {
            path += "&deepSearch=true"
        }
        if let malId, !malId.isEmpty {
            path += "&malId=\(malId)"
        }
        if let originalTitle, !originalTitle.isEmpty {
            let encodedOriginalTitle = originalTitle.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? originalTitle
            path += "&originalTitle=\(encodedOriginalTitle)"
        }
        if let titleRomaji, !titleRomaji.isEmpty {
            let encodedTitleRomaji = titleRomaji.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? titleRomaji
            path += "&titleRomaji=\(encodedTitleRomaji)"
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
