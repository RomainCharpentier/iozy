import Foundation
import SwiftData

/// Cache local d'une Entity, pour la consultation hors ligne (parcours 3 :
/// vérification avant achat en brocante/salon sans réseau fiable).
/// La source de vérité reste toujours l'API backend ; ce modèle n'est
/// jamais modifié directement par l'utilisateur sans passer par une
/// synchronisation.
@Model
final class EntityRecord {
    @Attribute(.unique) var id: UUID
    var entityTypeId: UUID
    var title: String
    var attributesJSON: String   // JSON brut des attributs (JSONB côté backend)
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

    // Plus de propriété `entityType` calculée ici : les types sont
    // désormais dynamiques (EntityTypeRecord, éditeur de types), donc leur
    // résolution a besoin de la liste chargée - voir
    // EntityTypeRecord.find(id:in:), appelé depuis chaque vue avec son
    // propre @Query plutôt que déduit ici d'un enum à cas fixes.
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

/// Cache local d'une Ownership. Simplifiée comme validé en conception :
/// pas de prix, pas de statut "prêté".
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

/// Cache local d'une Experience. Une seule note + un commentaire, comme validé.
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
