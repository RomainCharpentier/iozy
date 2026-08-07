import SwiftUI

/// Sélection visuelle des tomes possédés par jaquette (façon Mangacollec),
/// groupés par édition détectée (voir VolumeCandidateDTO côté backend) -
/// plutôt que de saisir un numéro de tome à l'aveugle, on coche directement
/// les couvertures des tomes qu'on possède. Miroir de VolumeSelectionGrid.tsx
/// côté web.
struct VolumeSelectionGrid: View {
    let volumes: [VolumeCandidateDTO]
    let selectedIds: Set<String>
    let onToggle: (VolumeCandidateDTO) -> Void

    private let columns = [GridItem(.adaptive(minimum: 64, maximum: 80), spacing: 8)]

    private var editionsInOrder: [String] {
        var seen = Set<String>()
        var order: [String] = []
        for volume in volumes where !seen.contains(volume.edition) {
            seen.insert(volume.edition)
            order.append(volume.edition)
        }
        return order
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            ForEach(editionsInOrder, id: \.self) { edition in
                VStack(alignment: .leading, spacing: 8) {
                    Text(edition).font(.subheadline.weight(.medium))
                    LazyVGrid(columns: columns, spacing: 8) {
                        ForEach(volumes.filter { $0.edition == edition }) { volume in
                            volumeCell(volume)
                        }
                    }
                }
            }
        }
    }

    private func volumeCell(_ volume: VolumeCandidateDTO) -> some View {
        let isSelected = selectedIds.contains(volume.id)
        return Button {
            onToggle(volume)
        } label: {
            ZStack(alignment: .topTrailing) {
                ZStack(alignment: .bottom) {
                    if let imageUrlString = volume.imageUrl, let imageURL = URL(string: imageUrlString) {
                        AsyncImage(url: imageURL) { phase in
                            if let image = phase.image {
                                image.resizable().aspectRatio(contentMode: .fill)
                            } else {
                                Color(.systemGray5)
                            }
                        }
                    } else {
                        ZStack {
                            Color(.systemGray5)
                            Text("T. \(volume.volumeNumber)").font(.caption2).foregroundStyle(.secondary)
                        }
                    }
                    Text("\(volume.volumeNumber)")
                        .font(.caption2.weight(.semibold))
                        .foregroundStyle(.white)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 2)
                        .background(.black.opacity(0.7))
                }
                .frame(width: 64, height: 96)
                .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: 8, style: .continuous)
                        .strokeBorder(isSelected ? Theme.accent : .clear, lineWidth: 2)
                )

                if isSelected {
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundStyle(Theme.accent)
                        .background(Circle().fill(.white))
                        .padding(4)
                }
            }
        }
        .buttonStyle(.plain)
    }
}
