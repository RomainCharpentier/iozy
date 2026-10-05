import Foundation
import SwiftData

/// Local cache of entity types (dynamic type editor) - unlike
/// tags/relations (never persisted, just temporary @State for the time of
/// the session on the detail page), types are needed offline
/// so the QuickAdd/Shelf pickers stay usable without network,
/// so they follow the same persistent pattern as EntityRecord/OwnershipRecord.
/// Replaces the old EntityTypeMVP (enum with 3 hard-coded cases, removed).
@Model
final class EntityTypeRecord {
    @Attribute(.unique) var id: UUID
    var code: String
    var label: String
    var allowedExperienceTypesJSON: String   // [String] encoded as JSON, same convention as attributesJSON
    var customFieldKeysJSON: String
    /// At least one metadata provider (Jikan/BGG/IGDB) supports this
    /// type - never the case for a custom type created with this editor
    /// (see QuickAddView: adding is blocked without a chosen suggestion
    /// only when this is true).
    var hasMetadataProvider: Bool
    var lastSyncedAt: Date

    init(id: UUID, code: String, label: String, allowedExperienceTypes: [String], customFieldKeys: [String],
         hasMetadataProvider: Bool, lastSyncedAt: Date = .now) {
        self.id = id
        self.code = code
        self.label = label
        self.allowedExperienceTypesJSON = Self.encode(allowedExperienceTypes)
        self.customFieldKeysJSON = Self.encode(customFieldKeys)
        self.hasMetadataProvider = hasMetadataProvider
        self.lastSyncedAt = lastSyncedAt
    }

    var allowedExperienceTypes: [String] {
        Self.decode(allowedExperienceTypesJSON)
    }

    var customFieldKeys: [String] {
        Self.decode(customFieldKeysJSON)
    }

    /// Updates this record from a fresh server response (upsert-by-id,
    /// same pattern as the other records - see EntityDetailView.syncFromServer()).
    func update(from dto: EntityTypeDTO) {
        code = dto.code
        label = dto.label
        allowedExperienceTypesJSON = Self.encode(dto.allowedExperienceTypes)
        customFieldKeysJSON = Self.encode(dto.customFieldKeys)
        hasMetadataProvider = dto.hasMetadataProvider
        lastSyncedAt = .now
    }

    /// Resolves a type by id in an already loaded list (e.g. a @Query) -
    /// replaces the old static EntityTypeMVP.from(uuid:), since the
    /// list of types is now dynamic and must be passed
    /// explicitly rather than deduced from an enum with fixed cases.
    static func find(id: UUID, in types: [EntityTypeRecord]) -> EntityTypeRecord? {
        types.first { $0.id == id }
    }

    /// Fetches the types from the API and upserts-by-id into the local cache -
    /// called from the `.task` of each screen that needs them (Shelf,
    /// QuickAdd, EntityDetail, Stats), same pattern as
    /// EntityDetailView.syncFromServer() for the other records. Silent
    /// network failure: the existing local cache (possibly empty on the
    /// very first launch) stays displayed, consistent with the
    /// degraded behavior already in place elsewhere in the app.
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
                    allowedExperienceTypes: dto.allowedExperienceTypes, customFieldKeys: dto.customFieldKeys,
                    hasMetadataProvider: dto.hasMetadataProvider)
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
