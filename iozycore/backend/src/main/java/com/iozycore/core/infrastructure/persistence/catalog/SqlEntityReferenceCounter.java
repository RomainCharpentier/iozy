package com.iozycore.core.infrastructure.persistence.catalog;

import com.iozycore.core.application.EntityReferenceCounter;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.springframework.stereotype.Repository;

import java.util.UUID;

/**
 * Native SQL on purpose: the JPA entities carry {@code @TenantId}, so a JPA
 * query would only count the rows of the current account (same reason as
 * JdbcDonneesParProprietaire).
 *
 * <p>Only the foreign keys to {@code entity} WITHOUT {@code ON DELETE CASCADE}
 * are listed: they are the ones that make the deletion fail. Through the
 * EntityManager, Hibernate flushes pending writes before the query, so the
 * count also sees what the current transaction has just written.
 */
@Repository
public class SqlEntityReferenceCounter implements EntityReferenceCounter {

    private static final String COUNT = """
            SELECT
              (SELECT count(*) FROM ownership WHERE entity_id = :id),
              (SELECT count(*) FROM experience WHERE entity_id = :id),
              (SELECT count(*) FROM wishlist_entry WHERE entity_id = :id),
              (SELECT count(DISTINCT owner_id) FROM (
                  SELECT owner_id FROM followed_work WHERE entity_id = :id
                  UNION ALL SELECT owner_id FROM followed_edition WHERE entity_id = :id) followers),
              (SELECT count(*) FROM relationship WHERE source_entity_id = :id OR target_entity_id = :id)
            """;

    @PersistenceContext
    private EntityManager entityManager;

    @Override
    public EntityReferences count(UUID entityId) {
        Object[] row = (Object[]) entityManager.createNativeQuery(COUNT)
                .setParameter("id", entityId)
                .getSingleResult();
        return new EntityReferences(asLong(row[0]), asLong(row[1]), asLong(row[2]), asLong(row[3]), asLong(row[4]));
    }

    private static long asLong(Object value) {
        return ((Number) value).longValue();
    }
}
