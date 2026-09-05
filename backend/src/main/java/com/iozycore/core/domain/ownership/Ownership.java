package com.iozycore.core.domain.ownership;

import com.iozycore.core.domain.shared.DomainEvent;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Racine d'agrégat représentant la possession d'un exemplaire d'une
 * Entity (ou d'un Variant précis). Ne référence jamais une Experience
 * et sa suppression n'affecte jamais l'Entity qu'elle référence.
 * <p>
 * Prix d'acquisition ({@code purchasePrice}) était explicitement hors
 * périmètre du MVP initial ("simplification demandée", voir
 * docs/CONCEPTION.md §4) - ajouté depuis sur demande explicite. Le statut
 * "prêté" a suivi le chemin inverse : ajouté puis retiré du produit, il n'a
 * jamais vécu ici mais dans un agrégat séparé, supprimé avec la
 * fonctionnalité (voir V19__drop_loan.sql). purchasePrice reste nullable et
 * n'est jamais deviné : une Ownership créée avant cette fonctionnalité, ou
 * simplement ajoutée sans prix, garde purchasePrice = null plutôt qu'une
 * valeur inventée (voir StatsService.computeCollectionValue, qui distingue
 * toujours la couverture connue du total réel plutôt que de sous-entendre
 * une valeur totale complète).
 * <p>
 * Porte un ownerId, mais ne le CHOISIT pas : à la création il vaut
 * null - « pas encore attribué ». C'est la session qui
 * tranche, à l'écriture, via la colonne marquée @TenantId (voir
 * ProprietaireCourant). Relu depuis la base, il porte le vrai propriétaire
 * de la ligne.
 */
public class Ownership {

    private final UUID id;
    private final UUID entityId;
    private final UUID variantId; // nullable : possession sans édition précise
    private final UUID ownerId;
    private OwnershipCondition condition;
    private OwnershipStatus status;
    private final LocalDate acquiredAt;
    private String note;
    private BigDecimal purchasePrice; // nullable : jamais deviné, voir Javadoc de la classe
    private final List<DomainEvent> pendingEvents = new ArrayList<>();

    private Ownership(UUID id, UUID entityId, UUID variantId, UUID ownerId, OwnershipCondition condition,
                       LocalDate acquiredAt, String note) {
        this.id = id;
        this.entityId = entityId;
        this.variantId = variantId;
        this.ownerId = ownerId;
        this.condition = condition;
        this.status = OwnershipStatus.OWNED;
        this.acquiredAt = acquiredAt;
        this.note = note;
    }

    public static Ownership acquire(UUID entityId, UUID variantId, OwnershipCondition condition,
                                     LocalDate acquiredAt, String note) {
        Ownership ownership = new Ownership(
                UUID.randomUUID(), entityId, variantId, null, condition, acquiredAt, note);
        ownership.pendingEvents.add(new OwnershipAdded(ownership.id, entityId, Instant.now()));
        return ownership;
    }

    public static Ownership reconstitute(UUID id, UUID entityId, UUID variantId, UUID ownerId,
                                          OwnershipCondition condition, OwnershipStatus status,
                                          LocalDate acquiredAt, String note, BigDecimal purchasePrice) {
        Ownership ownership = new Ownership(id, entityId, variantId, ownerId, condition, acquiredAt, note);
        ownership.status = status;
        ownership.purchasePrice = purchasePrice;
        return ownership;
    }

    private void release(OwnershipStatus newStatus) {
        if (this.status != OwnershipStatus.OWNED) {
            throw new IllegalStateException("Cette Ownership n'est plus active (statut actuel : %s)".formatted(status));
        }
        this.status = newStatus;
        pendingEvents.add(new OwnershipReleased(id, entityId, newStatus, Instant.now()));
    }

    public void markSold() {
        release(OwnershipStatus.SOLD);
    }

    public void markLost() {
        release(OwnershipStatus.LOST);
    }

    /**
     * Remet un exemplaire vendu ou perdu en possession.
     * <p>
     * Existe pour une raison précise : "Marquer vendu" et "Marquer perdu" sont
     * déclenchés d'un seul clic depuis le menu d'un exemplaire, et rien ne
     * permettait de revenir en arrière - une faute de frappe de geste faisait
     * disparaître un tome de la collection définitivement (voir
     * docs/USER_JOURNEYS.md, UX-11). L'interface propose désormais "Annuler"
     * juste après l'action ; sans cette méthode, ce bouton serait décoratif.
     * <p>
     * Refuse un exemplaire déjà actif plutôt que de ne rien faire en silence :
     * appeler restore() sur une possession en cours trahit un défaut d'appel.
     */
    public void restore() {
        if (this.status == OwnershipStatus.OWNED) {
            throw new IllegalStateException("Cette Ownership est déjà active");
        }
        this.status = OwnershipStatus.OWNED;
    }

    public void updateCondition(OwnershipCondition newCondition) {
        this.condition = newCondition;
    }

    public void updateNote(String newNote) {
        this.note = newNote;
    }

    /** {@code null} efface le prix renseigné (ex: saisie corrigée) - jamais refusé,
     * une Ownership peut tout à fait redevenir "prix inconnu" volontairement. */
    public void updatePurchasePrice(BigDecimal newPurchasePrice) {
        this.purchasePrice = newPurchasePrice;
    }

    public boolean isActive() {
        return status == OwnershipStatus.OWNED;
    }

    public List<DomainEvent> pullDomainEvents() {
        List<DomainEvent> events = List.copyOf(pendingEvents);
        pendingEvents.clear();
        return events;
    }

    public UUID id() {
        return id;
    }

    public UUID entityId() {
        return entityId;
    }

    public Optional<UUID> variantId() {
        return Optional.ofNullable(variantId);
    }

    public UUID ownerId() {
        return ownerId;
    }

    public OwnershipCondition condition() {
        return condition;
    }

    public OwnershipStatus status() {
        return status;
    }

    public LocalDate acquiredAt() {
        return acquiredAt;
    }

    public String note() {
        return note;
    }

    public Optional<BigDecimal> purchasePrice() {
        return Optional.ofNullable(purchasePrice);
    }
}
