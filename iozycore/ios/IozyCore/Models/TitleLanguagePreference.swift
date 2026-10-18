import Foundation

/// Free composition of the title displayed/saved for the Jikan/MyAnimeList
/// candidates (mangas) - persisted locally (UserDefaults, no
/// backend: a display setting specific to this device, consistent with the
/// single-user design without accounts of the app). Mirror of
/// TitleComposition on the web side (web/src/lib/titleLanguage.ts).
///
/// A TitleComposition is an ORDERED array of the 3 languages (always all
/// 3, in the order chosen by drag and drop in Settings), each one
/// can be enabled/disabled independently of its position:
/// - the first ACTIVE language whose value is available for this
///   candidate becomes the "main" title (the one actually typed/saved);
/// - the following active languages whose value is available appear
///   afterwards between parentheses, in the same order.
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

    // Reproduces the historical default behavior: French first
    // (best-effort), romaji as a secondary reference, English not shown (but
    // still available if the user drags/enables it in Settings).
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
