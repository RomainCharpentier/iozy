package com.iozycore.domain.catalog;

import com.iozycore.domain.shared.DomainEvent;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

/**
 * Racine d'agrégat représentant une œuvre/chose unique, indépendante de
 * sa possession, de ses expériences et de ses médias.
 * <p>
 * Invariant : le {@code entityTypeId} est fixé à la création et ne
 * change jamais — changer de type ferait perdre le sens des attributs
 * personnalisés (voir modèle de domaine, étape 7).
 */
public class Entity {

    private final UUID id;
    private final UUID entityTypeId;
    private String title;
    private final Map<String, Object> attributes = new HashMap<>();
    private final List<Variant> variants = new ArrayList<>();
    private final Set<UUID> tagIds = new HashSet<>();
    private final List<DomainEvent> pendingEvents = new ArrayList<>();

    private Entity(UUID id, UUID entityTypeId, String title) {
        if (title == null || title.isBlank()) {
            throw new IllegalArgumentException("Le titre d'une Entity ne peut pas être vide");
        }
        this.id = id;
        this.entityTypeId = entityTypeId;
        this.title = title;
    }

    /** Crée une nouvelle Entity et enregistre l'événement {@link EntityCreated}. */
    public static Entity create(UUID entityTypeId, String title) {
        Entity entity = new Entity(UUID.randomUUID(), entityTypeId, title);
        entity.pendingEvents.add(new EntityCreated(entity.id, entityTypeId, title, Instant.now()));
        return entity;
    }

    /** Reconstruit une Entity depuis la persistance (aucun événement émis). */
    public static Entity reconstitute(UUID id, UUID entityTypeId, String title,
                                       Map<String, Object> attributes, List<Variant> variants, Set<UUID> tagIds) {
        Entity entity = new Entity(id, entityTypeId, title);
        entity.attributes.putAll(attributes);
        entity.variants.addAll(variants);
        entity.tagIds.addAll(tagIds);
        return entity;
    }

    public void rename(String newTitle) {
        if (newTitle == null || newTitle.isBlank()) {
            throw new IllegalArgumentException("Le titre d'une Entity ne peut pas être vide");
        }
        this.title = newTitle;
    }

    public void setAttribute(String key, Object value) {
        attributes.put(key, value);
    }

    public Variant addVariant(String label, Map<String, Object> variantAttributes) {
        Variant variant = new Variant(UUID.randomUUID(), label, variantAttributes);
        variants.add(variant);
        return variant;
    }

    /** Retrouve un Variant existant par son label (insensible à la casse) - utilisé
     * par QuickAddService pour éviter de recréer "Tome 3" en double si l'utilisateur
     * ajoute un deuxième exemplaire du même tome. */
    public Optional<Variant> findVariantByLabel(String label) {
        return variants.stream().filter(v -> v.label().equalsIgnoreCase(label)).findFirst();
    }

    /**
     * Complète les attributs d'un Variant déjà existant SANS écraser ceux déjà
     * renseignés (même logique de fusion que QuickAddService pour l'Entity) -
     * typiquement pour retrouver après coup la jaquette propre à un tome ajouté
     * en saisie manuelle (voir "Retrouver les jaquettes manquantes", Ma
     * collection) sans avoir à recréer le Variant. {@code additionalAttributes}
     * gagne sur les clés déjà présentes - utilisé volontairement pour remplacer
     * une jaquette introuvable (null) par une jaquette retrouvée, jamais l'inverse
     * (un appelant ne doit fournir que des données fraîches qu'il veut voir
     * persistées, jamais une valeur vide pour "effacer" un attribut existant).
     */
    public void mergeVariantAttributes(UUID variantId, Map<String, Object> additionalAttributes) {
        int index = -1;
        for (int i = 0; i < variants.size(); i++) {
            if (variants.get(i).id().equals(variantId)) {
                index = i;
                break;
            }
        }
        if (index < 0) {
            throw new IllegalArgumentException("Variant introuvable : " + variantId);
        }
        Variant existing = variants.get(index);
        Map<String, Object> merged = new HashMap<>(existing.attributes());
        merged.putAll(additionalAttributes);
        variants.set(index, new Variant(existing.id(), existing.label(), merged));
    }

    public void addTag(UUID tagId) {
        tagIds.add(tagId);
    }

    public void removeTag(UUID tagId) {
        tagIds.remove(tagId);
    }

    public List<DomainEvent> pullDomainEvents() {
        List<DomainEvent> events = List.copyOf(pendingEvents);
        pendingEvents.clear();
        return events;
    }

    public UUID id() {
        return id;
    }

    public UUID entityTypeId() {
        return entityTypeId;
    }

    public String title() {
        return title;
    }

    public Map<String, Object> attributes() {
        return Map.copyOf(attributes);
    }

    public List<Variant> variants() {
        return List.copyOf(variants);
    }

    public Set<UUID> tagIds() {
        return Set.copyOf(tagIds);
    }
}
