import Foundation

/// Minimal HTTP client to the backend API (see EntityController,
/// OwnershipController, ExperienceController, WishlistController on the
/// Spring Boot side). No third-party dependency: URLSession is enough at this stage.
final class APIClient {

    static let shared = APIClient()

    /// Locally (simulator), points to the API started with `docker compose up`
    /// (see the backend README). To be replaced by the production URL
    /// (HTTPS reverse proxy, docker-compose.synology.yml) before a real deployment.
    /// ATS note: "localhost"/loopback addresses are exempt from App
    /// Transport Security on iOS, so plain HTTP works here without any
    /// extra Info.plist configuration.
    private let baseURL = URL(string: "http://localhost:8080/api")!

    private let session: URLSession
    private let decoder: JSONDecoder
    private let encoder: JSONEncoder

    private init() {
        session = URLSession(configuration: .default)
        decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
    }

    enum APIError: Error {
        case invalidResponse
        case serverError(statusCode: Int, message: String?)
    }

    // MARK: - Quick add (journey 1)

    struct QuickAddRequest: Encodable {
        let entityTypeId: UUID
        let title: String
        let condition: String
    }

    /// Mirror of EntityDtos.QuickAddResponse on the backend side. matchedExistingEntity
    /// means the add was deduplicated (UC1, step 6): no new
    /// detail page created, just one more Ownership on an Entity that already exists.
    /// variantId/matchedExistingVariant concern the exact volume of a series
    /// (Manga) - see QuickAddService on the backend side for the distinction
    /// series (Entity) / volume of an edition (Variant).
    struct QuickAddResponse: Decodable {
        let entityId: UUID
        let matchedExistingEntity: Bool
        let variantId: UUID?
        let matchedExistingVariant: Bool
    }

    func quickAdd(entityTypeId: UUID, title: String, condition: String) async throws -> QuickAddResponse {
        let body = QuickAddRequest(entityTypeId: entityTypeId, title: title, condition: condition)
        return try await post("/entities/quick-add", body: body)
    }

    // MARK: - Check before buying (journey 3)

    enum LookupStatus: String, Decodable {
        case owned = "OWNED"
        case wishlisted = "WISHLISTED"
        case unknown = "UNKNOWN"
    }

    private struct LookupResponse: Decodable {
        let status: LookupStatus
    }

    func lookup(entityId: UUID) async throws -> LookupStatus {
        let response: LookupResponse = try await get("/wishlist/lookup?entityId=\(entityId.uuidString)")
        return response.status
    }

    // MARK: - Generic HTTP helpers (internal: also used by
    // APIClient+Collections.swift, in the same module)

    func get<T: Decodable>(_ path: String) async throws -> T {
        // WARNING: do not use appendingPathComponent(path) here - this
        // method encodes the '?' as a literal path character instead of
        // treating it as the query string separator, which would silently
        // break all calls with parameters (lookup, search...).
        // Building the URL from the full string lets
        // URL(string:) parse the "?" and the "&" correctly.
        guard let url = URL(string: baseURL.absoluteString + path) else {
            throw APIError.invalidResponse
        }
        let (data, response) = try await session.data(from: url)
        try validate(response)
        return try decoder.decode(T.self, from: data)
    }

    func post<Body: Encodable, T: Decodable>(_ path: String, body: Body) async throws -> T {
        guard let url = URL(string: baseURL.absoluteString + path) else {
            throw APIError.invalidResponse
        }
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try encoder.encode(body)

        let (data, response) = try await session.data(for: request)
        try validate(response)
        return try decoder.decode(T.self, from: data)
    }

    func patch<Body: Encodable, T: Decodable>(_ path: String, body: Body) async throws -> T {
        guard let url = URL(string: baseURL.absoluteString + path) else {
            throw APIError.invalidResponse
        }
        var request = URLRequest(url: url)
        request.httpMethod = "PATCH"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try encoder.encode(body)

        let (data, response) = try await session.data(for: request)
        try validate(response)
        return try decoder.decode(T.self, from: data)
    }

    /// POST with no request body and no response to decode (e.g. attach an existing tag
    /// to an Entity - only the action matters, nothing to read back).
    func postEmpty(_ path: String) async throws {
        guard let url = URL(string: baseURL.absoluteString + path) else {
            throw APIError.invalidResponse
        }
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        let (_, response) = try await session.data(for: request)
        try validate(response)
    }

    /// DELETE with no response body to decode.
    func delete(_ path: String) async throws {
        guard let url = URL(string: baseURL.absoluteString + path) else {
            throw APIError.invalidResponse
        }
        var request = URLRequest(url: url)
        request.httpMethod = "DELETE"
        let (_, response) = try await session.data(for: request)
        try validate(response)
    }

    private func validate(_ response: URLResponse) throws {
        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }
        guard (200...299).contains(httpResponse.statusCode) else {
            throw APIError.serverError(statusCode: httpResponse.statusCode, message: nil)
        }
    }
}
