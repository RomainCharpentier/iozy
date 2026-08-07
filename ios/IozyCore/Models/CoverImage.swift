import Foundation

/// Clé d'attribut sous laquelle une jaquette réelle (Jikan / Google Books via
/// scan ISBN / Open Library) est persistée dans `Entity.attributes` - au même
/// titre que `mangaka`/`publisher`, ce n'est qu'un attribut générique de plus
/// du point de vue du backend (voir QuickAddService), pas un champ dédié.
/// Miroir de `COVER_IMAGE_ATTRIBUTE_KEY` côté web (src/lib/coverImage.ts).
enum CoverImage {
    static let attributeKey = "coverImageUrl"

    /// Extrait l'URL de jaquette d'un dictionnaire d'attributs bruts si
    /// présente et valide.
    static func url(from attributes: [String: AnyCodableValue]) -> URL? {
        guard let raw = attributes[attributeKey]?.stringValue, !raw.isEmpty else { return nil }
        return URL(string: raw)
    }

    /// Variante pour `EntityRecord.attributesJSON` (cache local SwiftData).
    /// Ne renvoie rien tant que ce cache n'est pas synchronisé avec les
    /// attributs serveur (aujourd'hui toujours "{}" à la création - voir
    /// EntityRecord) : ce n'est pas une régression introduite ici, juste un
    /// appel qui redevient utile dès que cette synchronisation existera.
    static func url(fromAttributesJSON json: String) -> URL? {
        guard let data = json.data(using: .utf8),
              let attributes = try? JSONDecoder().decode([String: AnyCodableValue].self, from: data)
        else { return nil }
        return url(from: attributes)
    }
}
