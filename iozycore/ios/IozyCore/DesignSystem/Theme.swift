import SwiftUI

/// Design system of the app, direction validated with the user:
/// dark background, bright yellow-green accent, Space Grotesk typography
/// (titles) + Inter (body text), grid of gradient covers instead of
/// system lists.
///
/// Fonts: referenced by their PostScript name. If the .ttf files are not
/// yet added to the Xcode project, SwiftUI silently falls back
/// to the system font (no crash) - see the README to add them.
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

    // MARK: - Typography

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

    // MARK: - Cover gradients

    /// Curated gradient palettes (2 colors each), assigned
    /// deterministically by title - the same work always gets the same
    /// gradient, with no need to store a color in the database.
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

    // MARK: - Type icon (dynamic type editor)

    /// A type created by the user has no curated SF Symbol icon
    /// (unlike the 3 historical MVP types: book.closed/gamecontroller/
    /// dice) - same principle as gradient(for:): deterministic hash of the code
    /// into a small list of generic icons, zero decisions at creation.
    private static let iconFallbacks: [String] = [
        "tag", "square.stack", "shippingbox", "folder", "bookmark",
        "cube", "square.grid.3x3", "puzzlepiece", "archivebox",
    ]

    static func icon(for code: String) -> String {
        iconFallbacks[Int(code.hashValue.magnitude % UInt(iconFallbacks.count))]
    }
}

extension Color {
    /// Initializes a Color from a "RRGGBB" hex (without #).
    init(hex: String) {
        var hexValue = UInt64()
        Scanner(string: hex).scanHexInt64(&hexValue)
        let r = Double((hexValue >> 16) & 0xFF) / 255
        let g = Double((hexValue >> 8) & 0xFF) / 255
        let b = Double(hexValue & 0xFF) / 255
        self.init(red: r, green: g, blue: b)
    }
}
