import SwiftUI

/// Pastille arrondie, utilisée pour les filtres de type et les tags.
struct Chip: View {
    let label: String
    var isActive: Bool = false

    var body: some View {
        Text(label)
            .font(Theme.bodyMedium(13))
            .foregroundStyle(isActive ? Theme.accentText : Theme.textDim)
            .padding(.horizontal, 14)
            .padding(.vertical, 8)
            .background(isActive ? Theme.accent : Theme.surface, in: Capsule())
    }
}

/// Carte compacte pour un chiffre-clé (bento layout), utilisée dans les
/// Étagères et l'onglet Stats.
struct StatCard: View {
    let value: String
    let label: String

    var body: some View {
        VStack(alignment: .leading, spacing: 5) {
            Text(value)
                .font(Theme.display(20))
                .foregroundStyle(Theme.textPrimary)
            Text(label)
                .font(Theme.bodyMedium(11))
                .foregroundStyle(Theme.textDim)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(14)
        .background(Theme.surface, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
    }
}
