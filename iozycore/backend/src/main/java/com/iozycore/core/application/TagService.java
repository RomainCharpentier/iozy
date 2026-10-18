package com.iozycore.core.application;

import com.iozycore.core.domain.catalog.Entity;
import com.iozycore.core.domain.catalog.EntityRepository;
import com.iozycore.core.domain.catalog.Tag;
import com.iozycore.core.domain.catalog.TagRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

/**
 * Use cases of the tags: free labels of the shared catalog, put on a WORK,
 * never on a volume nor on a copy. Who may write them is decided by
 * SecurityConfig, not here.
 */
@Service
@RequiredArgsConstructor
public class TagService {

    private final TagRepository tagRepository;
    private final EntityRepository entityRepository;

    /** Idempotent: a label that already exists returns its tag. */
    @Transactional
    public Tag create(String label) {
        return tagRepository.findByLabel(label)
                .orElseGet(() -> tagRepository.save(new Tag(UUID.randomUUID(), label)));
    }

    public List<Tag> listAll() {
        return tagRepository.findAll();
    }

    @Transactional
    public void attach(UUID entityId, UUID tagId) {
        Entity entity = requireEntity(entityId);
        // The tag must exist too: otherwise only the foreign key protected the
        // table, and the client got a 409 "conflict" for a tag that is ABSENT.
        requireTag(tagId);
        entity.addTag(tagId);
        entityRepository.save(entity);
    }

    @Transactional
    public void detach(UUID entityId, UUID tagId) {
        Entity entity = requireEntity(entityId);
        entity.removeTag(tagId);
        entityRepository.save(entity);
    }

    @Transactional
    public Tag rename(UUID tagId, String label) {
        Tag existing = requireTag(tagId);
        String trimmed = label == null ? "" : label.trim();
        if (trimmed.isEmpty()) {
            throw new IllegalArgumentException("Le libellé d'un tag ne peut pas être vide.");
        }
        // A label is unique in the database: say it here rather than letting a
        // constraint violation come up. Renaming a tag to its own name stays
        // allowed - it is a non-change, not a conflict.
        if (tagRepository.findByLabel(trimmed).filter(other -> !other.id().equals(tagId)).isPresent()) {
            throw new IllegalStateException("Un tag porte déjà ce nom.");
        }
        return tagRepository.save(new Tag(existing.id(), trimmed));
    }

    /** The links go with it, through the foreign key: a work only loses the label. */
    @Transactional
    public void delete(UUID tagId) {
        requireTag(tagId);
        tagRepository.supprimer(tagId);
    }

    private Entity requireEntity(UUID entityId) {
        return entityRepository.findById(entityId)
                .orElseThrow(() -> new NotFoundException("Entity introuvable : " + entityId));
    }

    private Tag requireTag(UUID tagId) {
        return tagRepository.findById(tagId)
                .orElseThrow(() -> new NotFoundException("Tag introuvable : " + tagId));
    }
}
