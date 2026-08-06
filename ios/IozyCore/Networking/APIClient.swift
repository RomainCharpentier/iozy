import Foundation

/// Client HTTP minimal vers l'API backend (voir EntityController,
/// OwnershipController, ExperienceController, WishlistController côté
/// Spring Boot). Pas de dépendance tierce : URLSession suffit à ce stade.
final class APIClient {

    static let shared = APIClient()

    /// En local (simulateur), pointe vers l'API lancée via `docker compose up`
    /// (voir README du backend). À remplacer par l'URL de production
    /// (reverse proxy HTTPS, docker-compose.synology.yml) avant un vrai déploiement.
    /// Note ATS : les adresses "localhost"/loopback sont exemptées d'App
    /// Transport Security par iOS, donc le HTTP simple fonctionne ici sans
    /// configuration Info.plist supplémentaire.
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

    // MARK: - Ajout rapide (parcours 1)

    struct QuickAddRequest: Encodable {
        let entityTypeId: UUID
        let title: String
        let condition: String
    }

    /// Miroir de EntityDtos.QuickAddResponse côté backend. matchedExistingEntity
    /// indique que l'ajout a été dédupliqué (UC1, étape 6) : aucune nouvelle
    /// fiche créée, juste une Ownership de plus sur une Entity déjà existante.
    struct QuickAddResponse: Decodable {
        let entityId: UUID
        let matchedExistingEntity: Bool
    }

    func quickAdd(entityTypeId: UUID, title: String, condition: String) async throws -> QuickAddResponse {
        let body = QuickAddRequest(entityTypeId: entityTypeId, title: title, condition: condition)
        return try await post("/entities/quick-add", body: body)
    }

    // MARK: - Vérification avant achat (parcours 3)

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

    // MARK: - Helpers HTTP génériques (internal : utilisés aussi par
    // APIClient+Collections.swift, dans le même module)

    func get<T: Decodable>(_ path: String) async throws -> T {
        // ATTENTION : ne pas utiliser appendingPathComponent(path) ici - cette
        // méthode encode le '?' comme un caractère de chemin littéral au lieu
        // de le traiter comme séparateur de query string, ce qui casserait
        // silencieusement tous les appels avec paramètres (lookup, search...).
        // Construire l'URL à partir de la chaîne complète laisse
        // URL(string:) parser correctement le "?" et le "&".
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

    /// POST sans corps de requête ni réponse à décoder (ex: attacher un tag
    /// existant à une Entity - l'action seule compte, rien à lire en retour).
    func postEmpty(_ path: String) async throws {
        guard let url = URL(string: baseURL.absoluteString + path) else {
            throw APIError.invalidResponse
        }
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        let (_, response) = try await session.data(for: request)
        try validate(response)
    }

    /// DELETE sans corps de réponse à décoder.
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
