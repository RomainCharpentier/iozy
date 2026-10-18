import Foundation
import SwiftData

/// Local cache of an Entity, for offline use (journey 3:
/// check before buying at a flea market/fair without reliable network).
/// The source of truth is always the backend API; this model is
/// never changed directly by the user without going through a
/// synchronization.
@Model
final class EntityRecord {
    @Attribute(.unique) var id: UUID
    var entityTypeId: UUID
    var title: String
    var attributesJSON: String   // Raw JSON of the attributes (JSONB on the backend side)
    var lastSyncedAt: Date

    @Relationship(deleteRule: .cascade, inverse: \VariantRecord.entity)
    var variants: [VariantRecord] = []

    init(id: UUID, entityTypeId: UUID, title: String, attributesJSON: String, lastSyncedAt: Date = .now) {
        self.id = id
        self.entityTypeId = entityTypeId
        self.title = title
        self.attributesJSON = attributesJSON
        self.lastSyncedAt = lastSyncedAt
    }

    // No more computed `entityType` property here: types are
    // now dynamic (EntityTypeRecord, type editor), so resolving them
    // needs the loaded list - see
    // EntityTypeRecord.find(id:in:), called from each view with its
    // own @Query rather than deduced here from an enum with fixed cases.
}

@Model
final class VariantRecord {
    @Attribute(.unique) var id: UUID
    var label: String
    var entity: EntityRecord?

    init(id: UUID, label: String, entity: EntityRecord? = nil) {
        self.id = id
        self.label = label
        self.entity = entity
    }
}

/// Local cache of an Ownership. Simplified as validated during design:
/// no price, no "lent" status.
@Model
final class OwnershipRecord {
    @Attribute(.unique) var id: UUID
    var entityId: UUID
    var variantId: UUID?
    var condition: String   // NEW / USED / DAMAGED
    var status: String      // OWNED / SOLD / LOST
    var acquiredAt: Date
    var note: String?

    init(id: UUID, entityId: UUID, variantId: UUID?, condition: String, status: String,
         acquiredAt: Date, note: String?) {
        self.id = id
        self.entityId = entityId
        self.variantId = variantId
        self.condition = condition
        self.status = status
        self.acquiredAt = acquiredAt
        self.note = note
    }
}

/// Local cache of an Experience. A single rating + a comment, as validated.
@Model
final class ExperienceRecord {
    @Attribute(.unique) var id: UUID
    var entityId: UUID
    var experienceType: String
    var occurredAt: Date
    var rating: Int?
    var comment: String?

    init(id: UUID, entityId: UUID, experienceType: String, occurredAt: Date,
         rating: Int?, comment: String?) {
        self.id = id
        self.entityId = entityId
        self.experienceType = experienceType
        self.occurredAt = occurredAt
        self.rating = rating
        self.comment = comment
    }
}

@Model
final class WishlistEntryRecord {
    @Attribute(.unique) var id: UUID
    var entityId: UUID
    var addedAt: Date

    init(id: UUID, entityId: UUID, addedAt: Date) {
        self.id = id
        self.entityId = entityId
        self.addedAt = addedAt
    }
}
