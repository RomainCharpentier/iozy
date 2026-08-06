package com.iozycore.domain.experience;

import com.iozycore.domain.shared.DefaultOwner;
import com.iozycore.domain.shared.DomainEvent;

import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Racine d'agrégat représentant une expérience vécue (lu, joué, terminé...)
 * en lien avec une Entity. Ne référence jamais un Ownership : une
 * Expérience est indépendante du fait de posséder ou non l'élément.
 * <p>
 * Volontairement simplifié : une seule note + un commentaire libre par
 * entrée, pas de suivi détaillé de sessions/parties.
 * <p>
 * Porte un ownerId (DefaultOwner.ID tant qu'aucun vrai système
 * multi-utilisateur n'existe) - préparation au multi-utilisateur, voir
 * DefaultOwner.
 */
public class Experience {

    private final UUID id;
    private final UUID entityId;
    private final UUID ownerId;
    private final String experienceType; // valeur validée contre EntityType.allows(...) en couche application
    private final LocalDate occurredAt;
    private Integer rating; // nullable
    private String comment;
    private final List<DomainEvent> pendingEvents = new ArrayList<>();

    private Experience(UUID id, UUID entityId, UUID ownerId, String experienceType, LocalDate occurredAt,
                        Integer rating, String comment) {
        if (experienceType == null || experienceType.isBlank()) {
            throw new IllegalArgumentException("Le type d'expérience ne peut pas être vide");
        }
        if (rating != null && (rating < 0 || rating > 10)) {
            throw new IllegalArgumentException("La note doit être comprise entre 0 et 10");
        }
        this.id = id;
        this.entityId = entityId;
        this.ownerId = ownerId;
        this.experienceType = experienceType;
        this.occurredAt = occurredAt;
        this.rating = rating;
        this.comment = comment;
    }

    public static Experience record_(UUID entityId, String experienceType, LocalDate occurredAt,
                                      Integer rating, String comment) {
        Experience experience = new Experience(
                UUID.randomUUID(), entityId, DefaultOwner.ID, experienceType, occurredAt, rating, comment);
        experience.pendingEvents.add(new ExperienceRecorded(experience.id, entityId, experienceType, Instant.now()));
        return experience;
    }

    public static Experience reconstitute(UUID id, UUID entityId, UUID ownerId, String experienceType,
                                           LocalDate occurredAt, Integer rating, String comment) {
        return new Experience(id, entityId, ownerId, experienceType, occurredAt, rating, comment);
    }

    public void updateRating(Integer newRating) {
        if (newRating != null && (newRating < 0 || newRating > 10)) {
            throw new IllegalArgumentException("La note doit être comprise entre 0 et 10");
        }
        this.rating = newRating;
    }

    public void updateComment(String newComment) {
        this.comment = newComment;
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

    public UUID ownerId() {
        return ownerId;
    }

    public String experienceType() {
        return experienceType;
    }

    public LocalDate occurredAt() {
        return occurredAt;
    }

    public Optional<Integer> rating() {
        return Optional.ofNullable(rating);
    }

    public String comment() {
        return comment;
    }
}
