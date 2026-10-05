package com.iozycore.core.domain.catalog;

import com.iozycore.core.domain.shared.DomainEvent;

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
 * Aggregate root for one unique work or thing, independent of
 * its ownership, its experiences and its media.
 * <p>
 * Invariant: {@code entityTypeId} is set at creation and never
 * changes. Changing the type would lose the meaning of the custom
 * attributes (see domain model, step 7).
 */
public class Entity {

    private final UUID id;
    private final UUID entityTypeId;
    private String title;
    private final Map<String, Object> attributes = new HashMap<>();
    private final List<Variant> variants = new ArrayList<>();
    private final Set<UUID> tagIds = new HashSet<>();
    /** The keys of {@link #attributes} typed by hand (Batch 130) - see {@link #saisirAttributs}. */
    private final Set<String> champsSaisis = new HashSet<>();
    private final List<DomainEvent> pendingEvents = new ArrayList<>();

    private Entity(UUID id, UUID entityTypeId, String title) {
        if (title == null || title.isBlank()) {
            throw new IllegalArgumentException("Le titre d'une Entity ne peut pas être vide");
        }
        this.id = id;
        this.entityTypeId = entityTypeId;
        this.title = title;
    }

    /** Creates a new Entity and records the {@link EntityCreated} event. */
    public static Entity create(UUID entityTypeId, String title) {
        Entity entity = new Entity(UUID.randomUUID(), entityTypeId, title);
        entity.pendingEvents.add(new EntityCreated(entity.id, entityTypeId, title, Instant.now()));
        return entity;
    }

    /** Rebuilds an Entity from persistence (no event is emitted). */
    public static Entity reconstitute(UUID id, UUID entityTypeId, String title,
                                       Map<String, Object> attributes, List<Variant> variants, Set<UUID> tagIds) {
        return reconstitute(id, entityTypeId, title, attributes, variants, tagIds, Set.of());
    }

    /** Same, with the fields typed by hand (Batch 130). */
    public static Entity reconstitute(UUID id, UUID entityTypeId, String title,
                                       Map<String, Object> attributes, List<Variant> variants, Set<UUID> tagIds,
                                       Set<String> champsSaisis) {
        Entity entity = new Entity(id, entityTypeId, title);
        entity.attributes.putAll(attributes);
        entity.variants.addAll(variants);
        entity.tagIds.addAll(tagIds);
        entity.champsSaisis.addAll(champsSaisis);
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

    /**
     * Completes/corrects the attributes of the Series itself without overwriting those
     * not concerned - same semantics as {@link #mergeVariantAttributes} at the
     * Volume level (UX audit "manual correction": until now, only the Volume
     * could get a cover fixed afterwards, never the Series). {@code
     * additionalAttributes} wins over keys already present - used
     * on purpose to replace a missing/wrong cover with the right one,
     * never the reverse (a caller must only give fresh data
     * that it wants to be saved, never an empty value to "erase" an
     * existing attribute).
     */
    public void mergeAttributes(Map<String, Object> additionalAttributes) {
        attributes.putAll(additionalAttributes);
    }

    /**
     * What the user TYPES (Batch 130): written like {@link #mergeAttributes},
     * and marks each key as typed by hand. A source will no longer
     * come back to it (see {@link #recopierDepuisLaSource}). A typed value
     * equal to the one from the source is marked anyway: the user
     * has decided, and the source must not contradict it later.
     */
    public void saisirAttributs(Map<String, Object> attributsSaisis) {
        attributes.putAll(attributsSaisis);
        champsSaisis.addAll(attributsSaisis.keySet());
    }

    /**
     * What a SOURCE returns (reload, catch-up): writes only the keys
     * that were not typed by hand, and says which ones. User rule
     * (2026-09-04): "if we reload from the api then we
     * overwrite the info that was not already edited".
     */
    public Set<String> recopierDepuisLaSource(Map<String, Object> attributsDeLaSource) {
        Set<String> ecrites = new HashSet<>();
        for (Map.Entry<String, Object> entree : attributsDeLaSource.entrySet()) {
            if (champsSaisis.contains(entree.getKey())) {
                continue;
            }
            attributes.put(entree.getKey(), entree.getValue());
            ecrites.add(entree.getKey());
        }
        return ecrites;
    }

    /** Takes marks as they are - the import of an export (Batch 130). */
    public void marquerSaisis(java.util.Collection<String> cles) {
        champsSaisis.addAll(cles);
    }

    /**
     * Removes an attribute - a SEPARATE operation from {@link #mergeAttributes}, whose
     * javadoc forbids an empty value as a way to erase.
     * Clearing a field in an edit form must really make it
     * disappear, not leave an empty string that would then look like
     * filled-in data. No effect if the key does not exist: erasing what
     * is not there is not an error.
     */
    public void removeAttribute(String key) {
        attributes.remove(key);
        // Clearing a field by hand also gives the place back to the source:
        // it can fill it at the next reload (Batch 130).
        champsSaisis.remove(key);
    }

    public Variant addVariant(String label, Map<String, Object> variantAttributes) {
        Variant variant = new Variant(UUID.randomUUID(), label, variantAttributes, null);
        variants.add(variant);
        return variant;
    }

    /** Finds an existing Variant by its label (case insensitive) - used
     * by QuickAddService to avoid creating "Tome 3" twice if the user
     * adds a second copy of the same volume. */
    public Optional<Variant> findVariantByLabel(String label) {
        return variants.stream().filter(v -> v.label().equalsIgnoreCase(label)).findFirst();
    }

    /**
     * Completes the attributes of an existing Variant WITHOUT overwriting those already
     * filled in (same merge logic as QuickAddService for the Entity) -
     * typically to find afterwards the own cover of a volume added
     * by manual entry (see "Find missing covers", My
     * collection) without having to recreate the Variant. {@code additionalAttributes}
     * wins over keys already present - used on purpose to replace
     * a cover that was not found (null) with a cover that was found, never the reverse
     * (a caller must only give fresh data that it wants to be
     * saved, never an empty value to "erase" an existing attribute).
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
        variants.set(index, new Variant(existing.id(), existing.label(), merged, existing.mangaEditionId()));
    }

    /**
     * Links an existing Volume to its catalog Edition ({@link MangaEdition}) - target
     * model Series -> Edition -> Volume. Same search pattern as
     * {@link #mergeVariantAttributes(UUID, Map)}. Never removes an existing link (no
     * need found for now) - a caller that resolves a more precise link can
     * simply call this method again with the new id.
     */
    public void linkVariantToEdition(UUID variantId, UUID mangaEditionId) {
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
        variants.set(index, new Variant(existing.id(), existing.label(), existing.attributes(), mangaEditionId));
    }

    /**
     * Removes a Volume from the catalog - explicit user action (see "Delete this
     * volume"), never automatic when Ownership drops to zero (target model Series ->
     * Edition -> Volume: a cataloged Volume exists independently of its ownership, see
     * Variant). The guard against Ownership/Experience that still reference it lives
     * in the application layer (VariantDeletionService), not here - same reason as for
     * {@link #mergeVariantAttributes}: Entity does not know the repositories of the
     * other aggregates.
     */
    public void removeVariant(UUID variantId) {
        boolean removed = variants.removeIf(v -> v.id().equals(variantId));
        if (!removed) {
            throw new IllegalArgumentException("Variant introuvable : " + variantId);
        }
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

    /** The keys typed by hand, which a reload from the source does not touch (Batch 130). */
    public Set<String> champsSaisis() {
        return Set.copyOf(champsSaisis);
    }
}
