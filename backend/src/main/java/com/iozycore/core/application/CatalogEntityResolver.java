package com.iozycore.core.application;

import com.iozycore.core.domain.catalog.Entity;
import com.iozycore.core.domain.catalog.EntityRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/**
 * Identify-or-create the catalog page of a work, WITHOUT any ownership.
 * <p>
 * <b>Catalog is not Collection.</b> A work can be known to IozyCore without
 * belonging to the collection: this is the case of a series put in wishes without
 * being owned. Until now this rule had no execution path
 * though - the only way to bring an external work into the
 * catalog was {@link QuickAddService#addNewEntityWithOwnership}, which
 * always ends with an {@code Ownership.acquire}. Adding an unowned work
 * to the wishes was therefore impossible without making up a fake
 * ownership, which would have broken the model.
 * <p>
 * This class extracts the "make the page exist" part of this path,
 * as it was: {@link QuickAddService} calls it then creates its ownership, the
 * Wishes path calls it and stops there. The canonicalization rule stays
 * written <b>only once</b>, and both paths necessarily produce
 * the same Entity for the same work - no second parallel catalog
 * reserved for wishes.
 * <p>
 * Deduplication: by (type, trimmed title, case insensitive), exactly
 * as before. The given attributes complete the missing ones and
 * never overwrite those already filled in - an earlier manual entry
 * survives a later metadata search.
 */
@Service
public class CatalogEntityResolver {

    private final EntityRepository entityRepository;

    public CatalogEntityResolver(EntityRepository entityRepository) {
        this.entityRepository = entityRepository;
    }

    /** The canonical Entity, and whether it already existed - never a duplicate. */
    public record Resolution(Entity entity, boolean matchedExisting) {
    }

    /**
     * Returns the catalog page of this work, creating it if it does not exist
     * yet. <b>Never creates an Ownership</b>: the caller must create
     * one if it wants one.
     */
    @Transactional
    public Resolution resolveOrCreate(UUID entityTypeId, String title, Map<String, Object> prefilledAttributes) {
        String normalizedTitle = title.trim();
        Optional<Entity> existing = entityRepository.findByTypeAndTitle(entityTypeId, normalizedTitle);
        Map<String, Object> attributes = prefilledAttributes == null ? Map.of() : prefilledAttributes;

        if (existing.isPresent()) {
            Entity entity = existing.get();
            attributes.forEach((key, value) -> {
                if (!entity.attributes().containsKey(key)) {
                    entity.setAttribute(key, value);
                }
            });
            return new Resolution(entityRepository.save(entity), true);
        }

        Entity entity = Entity.create(entityTypeId, normalizedTitle);
        attributes.forEach(entity::setAttribute);
        return new Resolution(entityRepository.save(entity), false);
    }
}
