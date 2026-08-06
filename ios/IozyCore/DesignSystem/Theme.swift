import SwiftUI

/// Système de design de l'app, direction validée avec l'utilisateur :
/// fond sombre, accent vert-jaune vif, typographie Space Grotesk (titres)
/// + Inter (texte courant), grille de couvertures en dégradé plutôt que
/// des listes système.
///
/// Polices : référencées par leur nom PostScript. Si les fichiers .ttf ne
/// sont pas encore ajoutés au projet Xcode, SwiftUI se rabat silencieusement
/// sur la police système (pas de crash) - voir le README pour les ajouter.
enum Theme {
    static let background = Color(hex: "131316")
    static let surface = Color(hex: "1D1D21")
    static let surface2 = Color(hex: "26262B")
    static let textPrimary = Color(hex: "F5F4F2")
    static let textDim = Color(hex: "8C8B92")
    static let accent = Color(hex: "B8FF3C")
    static let accentText = Color(hex: "0E1500")

    static let violet = Color(hex: "8B7FFF")
    static let pink = Color(hex: "FF6FA5")

    // MARK: - Typographie

    static func display(_ size: CGFloat) -> Font {
        .custom("SpaceGrotesk-Bold", size: size)
    }

    static func displayMedium(_ size: CGFloat) -> Font {
        .custom("SpaceGrotesk-Medium", size: size)
    }

    static func body(_ size: CGFloat) -> Font {
        .custom("Inter-Regular", size: size)
    }

    static func bodyMedium(_ size: CGFloat) -> Font {
        .custom("Inter-Medium", size: size)
    }

    static func bodySemibold(_ size: CGFloat) -> Font {
        .custom("Inter-SemiBold", size: size)
    }

    // MARK: - Dégradés de couverture

    /// Palettes de dégradés curatées (2 couleurs chacune), assignées de
    /// façon déterministe par titre - la même œuvre a toujours le même
    /// dégradé, sans avoir besoin de stocker de couleur en base.
    private static let gradientPalettes: [[String]] = [
        ["FF6FA5", "8B3E5C"],
        ["8B7FFF", "3E3480"],
        ["B8FF3C", "4B6B10"],
        ["FFA43C", "8A4E10"],
        ["3CDFFF", "1B6B80"],
        ["FF5C5C", "801F1F"],
    ]

    static func gradient(for title: String) -> LinearGradient {
        let pair = gradientPalettes[Int(title.hashValue.magnitude % UInt(gradientPalettes.count))]
        return LinearGradient(
            colors: [Color(hex: pair[0]), Color(hex: pair[1])],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )
    }

    // MARK: - Icône de type (éditeur de types dynamique)

    /// Un type créé par l'utilisateur n'a pas d'icône SF Symbol curatée
    /// (contrairement aux 3 types MVP historiques : book.closed/gamecontroller/
    /// dice) - même principe que gradient(for:) : hash déterministe du code
    /// vers une petite liste d'icônes génériques, zéro décision à la création.
    private static let iconFallbacks: [String] = [
        "tag", "square.stack", "shippingbox", "folder", "bookmark",
        "cube", "square.grid.3x3", "puzzlepiece", "archivebox",
    ]

    static func icon(for code: String) -> String {
        iconFallbacks[Int(code.hashValue.magnitude % UInt(iconFallbacks.count))]
    }
}

extension Color {
    /// Initialise une Color depuis un hex "RRGGBB" (sans #).
    init(hex: String) {
        var hexValue = UInt64()
        Scanner(string: hex).scanHexInt64(&hexValue)
        let r = Double((hexValue >> 16) & 0xFF) / 255
        let g = Double((hexValue >> 8) & 0xFF) / 255
        let b = Double(hexValue & 0xFF) / 255
        self.init(red: r, green: g, blue: b)
    }
}
