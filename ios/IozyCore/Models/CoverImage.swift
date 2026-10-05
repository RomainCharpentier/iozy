import Foundation

/// Attribute key under which a real cover (Jikan / Google Books via
/// ISBN scan / Open Library) is persisted in `Entity.attributes` - like
/// `mangaka`/`publisher`, it is just one more generic attribute
/// from the backend point of view (see QuickAddService), not a dedicated field.
/// Mirror of `COVER_IMAGE_ATTRIBUTE_KEY` on the web side (src/lib/coverImage.ts).
enum CoverImage {
    static let attributeKey = "coverImageUrl"

    /// Extracts the cover URL from a dictionary of raw attributes if
    /// present and valid.
    static func url(from attributes: [String: AnyCodableValue]) -> URL? {
        guard let raw = attributes[attributeKey]?.stringValue, !raw.isEmpty else { return nil }
        return URL(string: raw)
    }

    /// Variant for `EntityRecord.attributesJSON` (local SwiftData cache).
    /// Returns nothing as long as this cache is not synchronized with the server
    /// attributes (today always "{}" at creation - see
    /// EntityRecord): this is not a regression introduced here, just a
    /// call that becomes useful again as soon as this synchronization exists.
    static func url(fromAttributesJSON json: String) -> URL? {
        guard let data = json.data(using: .utf8),
              let attributes = try? JSONDecoder().decode([String: AnyCodableValue].self, from: data)
        else { return nil }
        return url(from: attributes)
    }
}
