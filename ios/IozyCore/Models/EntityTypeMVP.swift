import Foundation

/// Les 3 types du MVP, codés en dur côté client comme côté backend
/// (voir EntityType.java). Les UUID sont identiques des deux côtés
/// pour que l'app puisse envoyer directement entityTypeId à l'API.
enum EntityTypeMVP: String, CaseIterable, Identifiable {
    case manga = "MANGA"
    case videoGame = "VIDEO_GAME"
    case boardGame = "BOARD_GAME"

    var id: String { rawValue }

    var uuid: UUID {
        switch self {
        case .manga: return UUID(uuidString: "00000000-0000-0000-0000-000000000001")!
        case .videoGame: return UUID(uuidString: "00000000-0000-0000-0000-000000000002")!
        case .boardGame: return UUID(uuidString: "00000000-0000-0000-0000-000000000003")!
        }
    }

    var label: String {
        switch self {
        case .manga: return "Manga"
        case .videoGame: return "Jeu vidéo"
        case .boardGame: return "Jeu de société"
        }
    }

    var iconName: String {
        switch self {
        case .manga: return "book.closed"
        case .videoGame: return "gamecontroller"
        case .boardGame: return "dice"
        }
    }

    /// Types d'Experience autorisés pour ce type (miroir de EntityType.java).
    var allowedExperienceTypes: [String] {
        switch self {
        case .manga: return ["READ", "IN_PROGRESS", "ABANDONED"]
        case .videoGame: return ["FINISHED", "IN_PROGRESS", "ABANDONED"]
        case .boardGame: return ["PLAYED"]
        }
    }

    static func from(uuid: UUID) -> EntityTypeMVP? {
        allCases.first { $0.uuid == uuid }
    }
}
