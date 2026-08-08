import SwiftUI

/// Sélection visuelle des tomes possédés par jaquette (façon Mangacollec) :
/// on choisit d'abord l'édition (une série peut en avoir plusieurs - ex:
/// "Édition Originale" et "Perfect Edition" pour Dragon Ball, chacune avec
/// ses propres tomes/jaquettes), puis on coche les tomes possédés dans la
/// grille de cette édition. La sélection est conservée en changeant
/// d'édition (voir selectedIds, géré par le parent) - possible de cocher
/// des tomes dans plusieurs éditions avant de valider. Miroir de
/// VolumeSelectionGrid.tsx côté web.
struct VolumeSelectionGrid: View {
    let volumes: [VolumeCandidateDTO]
    let selectedIds: Set<String>
    let onToggle: (VolumeCandidateDTO) -> Void

    @State private var activeEdition: String?

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

    private var resolvedActiveEdition: String? {
        // L'édition active peut disparaître si une nouvelle recherche
        // remplace `volumes` (nouveau candidat choisi) sans que cette vue
        // soit recréée - on retombe alors sur la première édition
        // disponible plutôt qu'un onglet qui n'existe plus.
        if let activeEdition, editionsInOrder.contains(activeEdition) {
            return activeEdition
        }
        return editionsInOrder.first
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            if editionsInOrder.count > 1 {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        ForEach(editionsInOrder, id: \.self) { edition in
                            let count = volumes.filter { $0.edition == edition && selectedIds.contains($0.id) }.count
                            Chip(label: count > 0 ? "\(edition) (\(count))" : edition, isActive: edition == resolvedActiveEdition)
                                .onTapGesture { activeEdition = edition }
                        }
                    }
                }
            }

            if let resolvedActiveEdition {
                LazyVGrid(columns: columns, spacing: 8) {
                    ForEach(volumes.filter { $0.edition == resolvedActiveEdition }) { volume in
                        volumeCell(volume)
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
            ZStack(alignment: .bottom) {
                if let imageUrlString = volume.imageUrl, let imageURL = URL(string: imageUrlString) {
                    AsyncImage(url: imageURL) { phase in
                        if let image = phase.image {
                            image.resizable().aspectRatio(contentMode: .fill)
                                .opacity(volume.alreadyOwned ? 0.6 : 1)
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
            // Déjà possédé (vert, coin gauche) et sélectionné (accent, coin
            // droit) sont deux informations distinctes qui peuvent coexister
            // (re-sélectionner un tome déjà possédé signale un 2e exemplaire).
            .overlay(alignment: .topLeading) {
                if volume.alreadyOwned {
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundStyle(.green)
                        .background(Circle().fill(.white))
                        .padding(4)
                }
            }
            .overlay(alignment: .topTrailing) {
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
