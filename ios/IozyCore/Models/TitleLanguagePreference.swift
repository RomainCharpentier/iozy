import Foundation

/// Composition libre du titre affiché/sauvegardé pour les candidats
/// Jikan/MyAnimeList (mangas) - persistée en local (UserDefaults, pas de
/// backend : un réglage d'affichage propre à cet appareil, cohérent avec la
/// conception mono-utilisateur sans compte de l'app). Miroir de
/// TitleComposition côté web (web/src/lib/titleLanguage.ts).
///
/// Une TitleComposition est un tableau ORDONNÉ des 3 langues (toujours les
/// 3, dans l'ordre choisi via glisser-déposer dans Réglages), chacune
/// activable/désactivable indépendamment de sa position :
/// - la première langue ACTIVE dont la valeur est disponible pour ce
///   candidat devient le titre "principal" (celui réellement saisi/sauvegardé) ;
/// - les langues actives suivantes dont la valeur est disponible apparaissent
///   à la suite entre parenthèses, dans le même ordre.
enum TitleLanguage: String, Codable, CaseIterable, Identifiable {
    case french = "FRENCH"
    case english = "ENGLISH"
    case romaji = "ROMAJI"

    var id: String { rawValue }

    var label: String {
        switch self {
        case .french: return "Français"
        case .english: return "Anglais"
        case .romaji: return "Romaji (titre japonais d'origine)"
        }
    }
}

struct TitleLanguageItem: Codable, Identifiable, Equatable {
    let language: TitleLanguage
    var enabled: Bool

    var id: String { language.rawValue }
}

typealias TitleComposition = [TitleLanguageItem]

enum TitleCompositionStore {
    static let storageKey = "iozycore.titleComposition"

    // Reproduit le comportement par défaut historique : français en priorité
    // (best-effort), romaji en repère secondaire, anglais non affiché (mais
    // toujours disponible si l'utilisateur le glisse/active dans Réglages).
    static let defaultComposition: TitleComposition = [
        TitleLanguageItem(language: .french, enabled: true),
        TitleLanguageItem(language: .romaji, enabled: true),
        TitleLanguageItem(language: .english, enabled: false),
    ]

    static func load() -> TitleComposition {
        guard let data = UserDefaults.standard.data(forKey: storageKey),
              let decoded = try? JSONDecoder().decode(TitleComposition.self, from: data),
              decoded.count == 3,
              Set(decoded.map(\.language)) == Set(TitleLanguage.allCases)
        else {
            return defaultComposition
        }
        return decoded
    }

    static func save(_ composition: TitleComposition) {
        guard let data = try? JSONEncoder().encode(composition) else { return }
        UserDefaults.standard.set(data, forKey: storageKey)
    }

    static func isFrenchEnabled(_ composition: TitleComposition) -> Bool {
        composition.contains { $0.language == .french && $0.enabled }
    }
}
