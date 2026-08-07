import SwiftUI

/// Réglage propre à cet appareil (UserDefaults, pas de compte/backend - voir
/// TitleLanguagePreference.swift) : seule la recherche/ajout de manga
/// (Jikan/MyAnimeList) est concernée, ni Jikan ni MAL ne renvoyant de titre
/// français nativement. Miroir de SettingsPage côté web (QuickAddPage.tsx).
///
/// Glisser-déposer natif (List + .onMove, mode édition forcé en permanence -
/// pas de bouton "Modifier" séparé, cohérent avec le glisser-déposer
/// toujours actif côté web) : la première langue active devient le titre
/// sauvegardé, les suivantes actives suivent entre parenthèses dans l'ordre
/// choisi ici.
struct SettingsView: View {
    @State private var composition: TitleComposition = TitleCompositionStore.load()

    /// Premier item ACTIF (pas forcément le premier de la liste, si
    /// l'utilisateur a désactivé celui du dessus) - c'est lui qui devient le
    /// titre sauvegardé. Sert juste au badge "principal" ci-dessous.
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

    /// Au moins une langue doit rester active - sinon plus aucun titre ne
    /// serait résolvable pour l'ajout rapide (voir garde-fou similaire dans
    /// resolvePrimaryTitle côté QuickAddView, qui retombe sur candidate.title
    /// en dernier recours, mais autant l'empêcher ici plutôt que de compter
    /// dessus).
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
