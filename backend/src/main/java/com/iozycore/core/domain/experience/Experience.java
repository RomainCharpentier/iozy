package com.iozycore.core.domain.experience;

import com.iozycore.core.domain.shared.DomainEvent;

import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Aggregate root for a lived experience (read, played, finished...)
 * linked to an Entity. Never references an Ownership: an
 * Experience is independent of owning the item or not.
 * <p>
 * {@code variantId} (nullable) says WHICH volume/variant the experience
 * is about (e.g. "I read volume 3") - absent for a type with no notion of
 * volume (video game, board game) or when the experience is about the series
 * as a whole. Added later (audit "we mix volume and series"):
 * until then an Experience only referenced the whole series, with no way
 * to tell "I read volume 3" from "I read volume 4" in the history
 * - never checked against the real Variants of the Entity at the domain level
 * (no reference to Catalog here), this consistency is the responsibility
 * of the application/controller layer, like experienceType vs EntityType.
 * <p>
 * On purpose kept simple: one rating + one free comment per
 * entry, no detailed tracking of sessions/games.
 * <p>
 * Carries an ownerId, but does not CHOOSE it: at creation it is
 * null - "not yet assigned". The session decides, at write time,
 * through the column marked @TenantId (see
 * ProprietaireCourant). Read back from the database, it carries the real owner
 * of the row.
 */
public class Experience {

    private final UUID id;
    private final UUID entityId;
    private final UUID variantId; // nullable: see the class Javadoc
    private final UUID ownerId;
    private final String experienceType; // value checked against EntityType.allows(...) in the application layer
    private final LocalDate occurredAt;
    private Integer rating; // nullable
    private String comment;
    private final List<DomainEvent> pendingEvents = new ArrayList<>();

    private Experience(UUID id, UUID entityId, UUID variantId, UUID ownerId, String experienceType,
                        LocalDate occurredAt, Integer rating, String comment) {
        if (experienceType == null || experienceType.isBlank()) {
            throw new IllegalArgumentException("Le type d'expérience ne peut pas être vide");
        }
        if (rating != null && (rating < 0 || rating > 10)) {
            throw new IllegalArgumentException("La note doit être comprise entre 0 et 10");
        }
        // An experience is a DATED fact: "I read this volume" without when means
        // nothing, and the column is NOT NULL. Without this guard, a body
        // without a date went down to Hibernate, whose PropertyValueException
        // came out as a 409 "Cette donnée entre en conflit avec une donnée
        // existante" - an absurd sentence here: nothing conflicts, a field is
        // missing, and the user could not know which one.
        //
        // The date is above all not taken from today: people often log a
        // work read years ago, and inventing the date would silently
        // distort the yearly statistics. Same rule as for a recorded
        // price (see MarketPriceObservation).
        if (occurredAt == null) {
            throw new IllegalArgumentException("Une expérience doit porter une date");
        }
        this.id = id;
        this.entityId = entityId;
        this.variantId = variantId;
        this.ownerId = ownerId;
        this.experienceType = experienceType;
        this.occurredAt = occurredAt;
        this.rating = rating;
        this.comment = comment;
    }

    public static Experience record_(UUID entityId, UUID variantId, String experienceType, LocalDate occurredAt,
                                      Integer rating, String comment) {
        Experience experience = new Experience(
                UUID.randomUUID(), entityId, variantId, null, experienceType, occurredAt, rating, comment);
        experience.pendingEvents.add(new ExperienceRecorded(experience.id, entityId, experienceType, Instant.now()));
        return experience;
    }

    public static Experience reconstitute(UUID id, UUID entityId, UUID variantId, UUID ownerId, String experienceType,
                                           LocalDate occurredAt, Integer rating, String comment) {
        return new Experience(id, entityId, variantId, ownerId, experienceType, occurredAt, rating, comment);
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

    public Optional<UUID> variantId() {
        return Optional.ofNullable(variantId);
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
