package com.iozycore.core.application;

import com.iozycore.core.application.EntityReferenceCounter.EntityReferences;
import com.iozycore.core.domain.catalog.EntityRepository;
import com.iozycore.core.domain.shared.EntityDeletionNotAllowedException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;
import java.util.List;

/**
 * Expresses in the application layer the rule validated in step 7: the
 * deletion of an Entity is blocked as long as something references it. It
 * is not up to the domain to know the repositories of the other aggregates
 * (they are independent), so the rule is orchestrated here rather than in
 * the Entity aggregate itself.
 * <p>
 * The core references (ownerships, experiences, wishes, follows, links) are
 * counted for ALL accounts (see EntityReferenceCounter): a row of another
 * account blocks the delete through its foreign key just the same, and the
 * user must get a clear reason, not a raw SQL error.
 * <p>
 * Target catalog model Series -> Edition -> Volume (step 5): also blocked
 * as long as a catalog Edition ({@code MangaEdition.entityId}) still references
 * this Entity - without this guard, deleting an Entity whose Volumes
 * were all already removed one by one (see VariantDeletionService) but of which
 * an Edition still survives (e.g. market observations exist for
 * it) would be rejected with a raw SQL error rather than a clear message.
 * <p>
 * Rankings (tier list items, entity ranks) do not block: their foreign keys
 * are ON DELETE CASCADE, a ranking follows its work.
 */
@Service
@RequiredArgsConstructor
public class EntityDeletionService {

    private final EntityRepository entityRepository;
    private final EntityReferenceCounter referenceCounter;
    /** What each universe can still hold - the reference editions of a manga (Batch 133). */
    private final List<EntityDeletionGuard> guards;

    /**
     * The refusal is thrown before any write, so it must not mark the caller's
     * transaction for rollback: VariantDeletionService catches it to stop its
     * cascade and still commits the volume removal.
     */
    @Transactional(noRollbackFor = EntityDeletionNotAllowedException.class)
    public void delete(UUID entityId) {
        EntityReferences references = referenceCounter.count(entityId);
        long editionCount = guards.stream().mapToLong(guard -> guard.referencesRestantes(entityId)).sum();

        if (references.any() || editionCount > 0) {
            throw new EntityDeletionNotAllowedException(references.ownerships(), references.experiences(),
                    editionCount, references.wishes(), references.follows(), references.links());
        }

        entityRepository.deleteById(entityId);
    }
}
