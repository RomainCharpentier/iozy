import Foundation
import SwiftData

/// Cache local des types d'entité (éditeur de types dynamique) - contrairement
/// aux tags/relations (jamais persistés, juste @State éphémère le temps de
/// la session sur la fiche détail), les types sont nécessaires hors ligne
/// pour que les pickers QuickAdd/Shelf restent utilisables sans réseau,
/// donc suivent le même pattern persistant que EntityRecord/OwnershipRecord.
/// Remplace l'ancien EntityTypeMVP (enum à 3 cas codés en dur, supprimé).
@Model
final class EntityTypeRecord {
    @Attribute(.unique) var id: UUID
    var code: String
    var label: String
    var allowedExperienceTypesJSON: String   // [String] encodé en JSON, même convention que attributesJSON
    var customFieldKeysJSON: String
    var lastSyncedAt: Date

    init(id: UUID, code: String, label: String, allowedExperienceTypes: [String], customFieldKeys: [String],
         lastSyncedAt: Date = .now) {
        self.id = id
        self.code = code
        self.label = label
        self.allowedExperienceTypesJSON = Self.encode(allowedExperienceTypes)
        self.customFieldKeysJSON = Self.encode(customFieldKeys)
        self.lastSyncedAt = lastSyncedAt
    }

    var allowedExperienceTypes: [String] {
        Self.decode(allowedExperienceTypesJSON)
    }

    var customFieldKeys: [String] {
        Self.decode(customFieldKeysJSON)
    }

    /// Met à jour ce record depuis une réponse serveur fraîche (upsert-by-id,
    /// même pattern que les autres records - voir EntityDetailView.syncFromServer()).
    func update(from dto: EntityTypeDTO) {
        code = dto.code
        label = dto.label
        allowedExperienceTypesJSON = Self.encode(dto.allowedExperienceTypes)
        customFieldKeysJSON = Self.encode(dto.customFieldKeys)
        lastSyncedAt = .now
    }

    /// Résout un type par id dans une liste déjà chargée (ex: un @Query) -
    /// remplace l'ancien EntityTypeMVP.from(uuid:) statique, puisque la
    /// liste des types est maintenant dynamique et doit être passée
    /// explicitement plutôt que déduite d'un enum à cas fixes.
    static func find(id: UUID, in types: [EntityTypeRecord]) -> EntityTypeRecord? {
        types.first { $0.id == id }
    }

    /// Récupère les types depuis l'API et upsert-by-id dans le cache local -
    /// appelé depuis le `.task` de chaque écran qui en a besoin (Shelf,
    /// QuickAdd, EntityDetail, Stats), même pattern que
    /// EntityDetailView.syncFromServer() pour les autres records. Échec
    /// réseau silencieux : le cache local existant (potentiellement vide au
    /// tout premier lancement) reste affiché, cohérent avec le
    /// comportement dégradé déjà en place ailleurs dans l'app.
    @MainActor
    static func syncFromServer(modelContext: ModelContext, existing: [EntityTypeRecord]) async {
        guard let fetched = try? await APIClient.shared.listEntityTypes() else {
            return
        }
        var byId = Dictionary(uniqueKeysWithValues: existing.map { ($0.id, $0) })
        for dto in fetched {
            if let record = byId[dto.id] {
                record.update(from: dto)
            } else {
                let record = EntityTypeRecord(
                    id: dto.id, code: dto.code, label: dto.label,
                    allowedExperienceTypes: dto.allowedExperienceTypes, customFieldKeys: dto.customFieldKeys)
                modelContext.insert(record)
                byId[dto.id] = record
            }
        }
    }

    private static func encode(_ values: [String]) -> String {
        (try? String(data: JSONEncoder().encode(values), encoding: .utf8)) ?? "[]"
    }

    private static func decode(_ json: String) -> [String] {
        guard let data = json.data(using: .utf8),
              let values = try? JSONDecoder().decode([String].self, from: data) else {
            return []
        }
        return values
    }
}
