import SwiftUI

/// Tuile de "couverture" générée (dégradé + titre) : remplace les
/// couvertures officielles qu'on n'a pas encore le droit d'afficher
/// (droits d'image des éditeurs/studios) tout en donnant à chaque élément
/// une identité visuelle propre et reconnaissable au premier coup d'œil.
struct CoverTile: View {
    let title: String
    var showBadge: Bool = false
    var aspectRatio: CGFloat = 2.0 / 3.0

    var body: some View {
        ZStack(alignment: .bottomLeading) {
            Theme.gradient(for: title)

            LinearGradient(
                colors: [.clear, Color.black.opacity(0.55)],
                startPoint: .init(x: 0.5, y: 0.4),
                endPoint: .bottom
            )

            Text(title)
                .font(Theme.bodySemibold(11))
                .foregroundStyle(.white.opacity(0.95))
                .lineLimit(2)
                .padding(8)

            if showBadge {
                Image(systemName: "checkmark")
                    .font(.system(size: 11, weight: .bold))
                    .foregroundStyle(.white)
                    .frame(width: 20, height: 20)
                    .background(Color.black.opacity(0.4), in: Circle())
                    .padding(7)
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topTrailing)
            }
        }
        .aspectRatio(aspectRatio, contentMode: .fit)
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
    }
}
