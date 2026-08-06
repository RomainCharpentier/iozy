import SwiftUI
import SwiftData

/// Formulaire de création/édition d'un type. Les types d'expérience
/// autorisés et les champs personnalisés sont des listes libres (chaque
/// type MVP historique a la sienne, il n'existe pas de liste canonique
/// commune côté backend à choisir dans un multi-select) - même saisie
/// "texte + bouton Ajouter, retirable" que ManageTagsSheet pour les tags.
struct EntityTypeFormView: View {
    enum Mode {
        case create
        case edit(EntityTypeRecord)
    }

    let mode: Mode

    @Environment(\.dismiss) private var dismiss
    @Environment(\.modelContext) private var modelContext

    @State private var code: String = ""
    @State private var label: String = ""
    @State private var allowedExperienceTypes: [String] = []
    @State private var customFieldKeys: [String] = []
    @State private var newExperienceType: String = ""
    @State private var newCustomFieldKey: String = ""
    @State private var isSubmitting = false
    @State private var errorMessage: String?

    private var isEditing: Bool {
        if case .edit = mode { return true }
        return false
    }

    var body: some View {
        Form {
            Section("Identité") {
                TextField("Label (ex : Films, Vinyles...)", text: $label)
                    .textInputAutocapitalization(.sentences)
                if isEditing {
                    LabeledContent("Code", value: code)
                } else {
                    // Normalisé côté backend en UPPER_SNAKE_CASE quoi qu'on saisisse ici.
                    TextField("Code (ex : FILM, VINYLE...)", text: $code)
                        .textInputAutocapitalization(.characters)
                        .disableAutocorrection(true)
                }
            } footer: {
                if !isEditing {
                    Text("Le code ne pourra plus être modifié après la création.")
                }
            }

            chipListSection(
                title: "Types d'expérience autorisés",
                placeholder: "ex : READ, PLAYED...",
                values: $allowedExperienceTypes,
                newValue: $newExperienceType
            )

            chipListSection(
                title: "Champs personnalisés",
                placeholder: "ex : auteur, plateforme...",
                values: $customFieldKeys,
                newValue: $newCustomFieldKey
            )

            if let errorMessage {
                Section {
                    Text(errorMessage).foregroundStyle(.red)
                }
            }
        }
        .scrollContentBackground(.hidden)
        .background(Theme.background)
        .navigationTitle(isEditing ? "Modifier le type" : "Nouveau type")
        .toolbarBackground(Theme.background, for: .navigationBar)
        .toolbarColorScheme(.dark, for: .navigationBar)
        .toolbar {
            ToolbarItem(placement: .confirmationAction) {
                Button(isEditing ? "Enregistrer" : "Créer") { submit() }
                    .disabled(label.trimmingCharacters(in: .whitespaces).isEmpty
                              || code.trimmingCharacters(in: .whitespaces).isEmpty || isSubmitting)
            }
        }
        .onAppear(perform: loadInitialValues)
    }

    @ViewBuilder
    private func chipListSection(title: String, placeholder: String, values: Binding<[String]>,
                                  newValue: Binding<String>) -> some View {
        Section(title) {
            HStack {
                TextField(placeholder, text: newValue)
                    .textInputAutocapitalization(.never)
                    .disableAutocorrection(true)
                Button("Ajouter") {
                    let trimmed = newValue.wrappedValue.trimmingCharacters(in: .whitespaces)
                    guard !trimmed.isEmpty, !values.wrappedValue.contains(trimmed) else { return }
                    values.wrappedValue.append(trimmed)
                    newValue.wrappedValue = ""
                }
                .disabled(newValue.wrappedValue.trimmingCharacters(in: .whitespaces).isEmpty)
            }
            if !values.wrappedValue.isEmpty {
                ForEach(values.wrappedValue, id: \.self) { value in
                    HStack {
                        Text(value)
                        Spacer()
                        Button {
                            values.wrappedValue.removeAll { $0 == value }
                        } label: {
                            Image(systemName: "xmark.circle.fill").foregroundStyle(.secondary)
                        }
                    }
                }
            }
        }
    }

    private func loadInitialValues() {
        guard case .edit(let type) = mode else { return }
        code = type.code
        label = type.label
        allowedExperienceTypes = type.allowedExperienceTypes
        customFieldKeys = type.customFieldKeys
    }

    private func submit() {
        isSubmitting = true
        errorMessage = nil
        let trimmedLabel = label.trimmingCharacters(in: .whitespaces)

        Task {
            do {
                switch mode {
                case .create:
                    let request = CreateEntityTypeRequest(
                        code: code, label: trimmedLabel,
                        allowedExperienceTypes: allowedExperienceTypes, customFieldKeys: customFieldKeys)
                    let dto = try await APIClient.shared.createEntityType(request)
                    await MainActor.run {
                        modelContext.insert(EntityTypeRecord(
                            id: dto.id, code: dto.code, label: dto.label,
                            allowedExperienceTypes: dto.allowedExperienceTypes, customFieldKeys: dto.customFieldKeys,
                            hasMetadataProvider: dto.hasMetadataProvider))
                        dismiss()
                    }
                case .edit(let type):
                    let request = UpdateEntityTypeRequest(
                        label: trimmedLabel, allowedExperienceTypes: allowedExperienceTypes,
                        customFieldKeys: customFieldKeys)
                    let dto = try await APIClient.shared.updateEntityType(id: type.id, request)
                    await MainActor.run {
                        type.update(from: dto)
                        dismiss()
                    }
                }
            } catch {
                await MainActor.run {
                    errorMessage = "Échec de l'enregistrement : \(error.localizedDescription)"
                    isSubmitting = false
                }
            }
        }
    }
}
