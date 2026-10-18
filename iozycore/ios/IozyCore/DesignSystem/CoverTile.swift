import SwiftUI

/// "Cover" tile: real cover art when an external source provided one
/// (Jikan / Google Books via ISBN scan / Open Library), with the
/// deterministic gradient (computed from the title) as a fallback - free
/// entry, search with no result, or a simple image loading failure.
/// Mirror of CoverTile.tsx.
struct CoverTile: View {
    let title: String
    var imageURL: URL? = nil
    var showBadge: Bool = false
    var aspectRatio: CGFloat = 2.0 / 3.0

    var body: some View {
        ZStack(alignment: .bottomLeading) {
            if let imageURL {
                AsyncImage(url: imageURL) { phase in
                    if let image = phase.image {
                        image.resizable().aspectRatio(contentMode: .fill)
                    } else {
                        Theme.gradient(for: title)
                    }
                }
            } else {
                Theme.gradient(for: title)
            }

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
