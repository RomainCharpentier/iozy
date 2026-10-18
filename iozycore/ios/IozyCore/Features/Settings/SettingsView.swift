import SwiftUI

/// Setting specific to this device (UserDefaults, no account/backend - see
/// TitleLanguagePreference.swift): only the manga search/add
/// (Jikan/MyAnimeList) is concerned, since neither Jikan nor MAL returns a
/// French title natively. Mirror of SettingsPage on the web side (QuickAddPage.tsx).
///
/// Native drag and drop (List + .onMove, edit mode forced permanently -
/// no separate "Modifier" button, consistent with the drag and drop
/// always active on the web side): the first active language becomes the
/// saved title, the following active ones come between parentheses in the order
/// chosen here.
struct SettingsView: View {
    @State private var composition: TitleComposition = TitleCompositionStore.load()

    /// First ACTIVE item (not always the first of the list, if
    /// the user disabled the one above) - it becomes the
    /// saved title. Only used for the "principal" badge below.
    private var primaryIndex: Int? {
        composition.firstIndex { $0.enabled }
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    Text("Fais glisser pour choisir l'ordre, active/désactive chaque langue. La première langue "
                        + "active devient le titre ajouté à ta collection ; les suivantes actives apparaissent "
                        + "entre parenthèses. \"Français\" déclenche une recherche best-effort supplémentaire "
                        + "(Open Library, puis Google Books en repli) - ni Jikan ni MyAnimeList n'en fournissent "
                        + "nativement. \"Anglais\" et \"Romaji\" n'appellent jamais cette recherche : aucun appel "
                        + "externe en plus si \"Français\" est désactivé.")
                        .font(.caption)
                        .foregroundStyle(Theme.textDim)
                }

                Section("Titre des mangas") {
                    ForEach(Array(composition.enumerated()), id: \.element.id) { index, item in
                        HStack(spacing: 12) {
                            Button {
                                toggle(at: index)
                            } label: {
                                Image(systemName: item.enabled ? "checkmark.square.fill" : "square")
                                    .foregroundStyle(item.enabled ? Theme.accent : Theme.textDim)
                            }
                            .buttonStyle(.plain)

                            Text(item.language.label).foregroundStyle(Theme.textPrimary)

                            Spacer()

                            if index == primaryIndex {
                                Text("principal")
                                    .font(.caption)
                                    .padding(.horizontal, 8)
                                    .padding(.vertical, 2)
                                    .background(Theme.accent, in: Capsule())
                                    .foregroundStyle(Theme.accentText)
                            }
                        }
                    }
                    .onMove(perform: move)
                }
            }
            .environment(\.editMode, .constant(.active))
            .navigationTitle("Réglages")
            .scrollContentBackground(.hidden)
            .background(Theme.background)
            .toolbarBackground(Theme.background, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
        }
    }

    /// At least one language must stay active - otherwise no title would
    /// be resolvable for quick add (see a similar safeguard in
    /// resolvePrimaryTitle on the QuickAddView side, which falls back to candidate.title
    /// as a last resort, but better to prevent it here than to count
    /// on it).
    private func toggle(at index: Int) {
        var next = composition
        next[index].enabled.toggle()
        guard next.contains(where: { $0.enabled }) else { return }
        composition = next
        TitleCompositionStore.save(next)
    }

    private func move(from source: IndexSet, to destination: Int) {
        composition.move(fromOffsets: source, toOffset: destination)
        TitleCompositionStore.save(composition)
    }
}
