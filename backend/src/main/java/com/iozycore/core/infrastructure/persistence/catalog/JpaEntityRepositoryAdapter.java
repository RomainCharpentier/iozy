package com.iozycore.core.infrastructure.persistence.catalog;

import com.iozycore.core.domain.catalog.Entity;
import com.iozycore.core.domain.catalog.EntityRepository;
import com.iozycore.core.domain.catalog.Variant;
import com.iozycore.core.domain.shared.TexteRecherche;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Repository
@Transactional
@RequiredArgsConstructor
public class JpaEntityRepositoryAdapter implements EntityRepository {

    private final EntityJpaRepository entityJpaRepository;
    private final VariantJpaRepository variantJpaRepository;

    @Override
    public Entity save(Entity entity) {
        Instant createdAt = entityJpaRepository.findById(entity.id())
                .map(EntityJpaEntity::getCreatedAt)
                .orElse(Instant.now());

        EntityJpaEntity saved = entityJpaRepository.save(EntityMapper.toJpa(entity, createdAt));

        // The variants are internal to the Entity, but can be referenced
        // by an Ownership (FK ownership.variant_id) - so we cannot
        // delete them all and then recreate them identically as before:
        // deleting a Variant that is still referenced raises a constraint violation,
        // even if it is reinserted with the same id right after (observed: adding
        // a 2nd volume to a series that already has an Ownership on its 1st volume
        // raised a DataIntegrityViolationException). So we only delete
        // the variants that really disappeared from the Entity, and we upsert
        // (save) the rest - an id already known to Postgres becomes an
        // update, an unknown id an insert (same mechanism as EntityJpaEntity
        // above).
        List<VariantJpaEntity> existingVariants = variantJpaRepository.findByEntityId(entity.id());
        Set<UUID> currentVariantIds = entity.variants().stream().map(Variant::id).collect(Collectors.toSet());
        List<VariantJpaEntity> removedVariants = existingVariants.stream()
                .filter(variant -> !currentVariantIds.contains(variant.getId()))
                .collect(Collectors.toList());
        variantJpaRepository.deleteAll(removedVariants);
        variantJpaRepository.saveAll(EntityMapper.toJpaVariants(entity));

        return EntityMapper.toDomain(saved, variantJpaRepository.findByEntityId(entity.id()));
    }

    @Override
    public Optional<Entity> findById(UUID id) {
        return entityJpaRepository.findById(id)
                .map(jpaEntity -> {
                    List<VariantJpaEntity> variants = variantJpaRepository.findByEntityId(id);
                    return EntityMapper.toDomain(jpaEntity, variants);
                });
    }

    @Override
    public Optional<Entity> findByTypeAndTitle(UUID entityTypeId, String title) {
        return entityJpaRepository.findByEntityTypeIdAndTitleIgnoreCase(entityTypeId, title)
                .map(jpaEntity -> {
                    List<VariantJpaEntity> variants = variantJpaRepository.findByEntityId(jpaEntity.getId());
                    return EntityMapper.toDomain(jpaEntity, variants);
                });
    }

    @Override
    public List<Entity> findAllByType(UUID entityTypeId) {
        return withVariants(entityJpaRepository.findByEntityTypeId(entityTypeId));
    }

    /**
     * The attributes where we ALSO search, after the title: the search
     * field promises "a title, an author...", and only kept the
     * first half.
     */
    private static final List<String> ATTRIBUTS_CHERCHES = List.of("mangaka", "author", "studio", "designer",
            "developer", "publisher");

    /**
     * Type and tag are filtered in the database; the title in memory, to fold
     * accents and punctuation (see {@link TexteRecherche}). The cost is
     * that of listing a whole type, which My collection and the Catalog
     * already pay at each visit - and the request is debounced on the client side.
     *
     * <p>The order tells the relevance: the titles that START with the
     * search, then those that contain it, then the works found
     * by an author. Alphabetical inside each group - this is
     * the order of the database, which the stable sort keeps. Before, "one" returned
     * "Bone" before "One Piece".
     */
    @Override
    public List<Entity> search(String titleQuery, UUID entityTypeId, UUID tagId) {
        List<Entity> perimetre = withVariants(entityJpaRepository.findByFiltres(entityTypeId, tagId));
        String requete = TexteRecherche.normaliser(titleQuery);
        if (requete.isEmpty()) {
            return perimetre;
        }
        List<Entity> retenues = new ArrayList<>();
        List<Integer> rangs = new ArrayList<>();
        for (Entity entity : perimetre) {
            int rang = rangDe(entity, requete);
            if (rang >= 0) {
                retenues.add(entity);
                rangs.add(rang);
            }
        }
        List<Integer> indices = new ArrayList<>();
        for (int i = 0; i < retenues.size(); i++) {
            indices.add(i);
        }
        indices.sort(Comparator.comparingInt(rangs::get));
        return indices.stream().map(retenues::get).collect(Collectors.toList());
    }

    private static int rangDe(Entity entity, String requete) {
        String titre = TexteRecherche.normaliser(entity.title());
        if (titre.startsWith(requete)) {
            return 0;
        }
        if (titre.contains(requete)) {
            return 1;
        }
        // "attaque titans" must find "L'Attaque des Titans": each
        // typed word is in the title, not necessarily in a row.
        if (TexteRecherche.contientChaqueMot(titre, requete)) {
            return 2;
        }
        for (String cle : ATTRIBUTS_CHERCHES) {
            Object valeur = entity.attributes().get(cle);
            if (valeur instanceof String s && TexteRecherche.contientChaqueMot(TexteRecherche.normaliser(s), requete)) {
                return 3;
            }
        }
        return -1;
    }

    /**
     * Attaches their volumes to several works in ONE query, instead of one per
     * work.
     * <p>
     * These two listings are the busiest path of the app - My
     * collection, a shelf, the export, the progress, the suggestions and the public
     * page all depend on them - and each cost 1 + N queries. Measured at the
     * time of the fix: 6 works, so 6 volume queries avoided; at 500
     * series, 500. The grouping is done in memory, the list of works being
     * already loaded anyway.
     */
    private List<Entity> withVariants(List<EntityJpaEntity> jpaEntities) {
        if (jpaEntities.isEmpty()) {
            return List.of();
        }
        Map<UUID, List<VariantJpaEntity>> variantsByEntityId = variantJpaRepository
                .findByEntityIdIn(jpaEntities.stream().map(EntityJpaEntity::getId).collect(Collectors.toSet()))
                .stream()
                .collect(Collectors.groupingBy(VariantJpaEntity::getEntityId));
        return jpaEntities.stream()
                .map(jpaEntity -> EntityMapper.toDomain(jpaEntity,
                        variantsByEntityId.getOrDefault(jpaEntity.getId(), List.of())))
                .collect(Collectors.toList());
    }

    @Override
    public boolean existsByType(UUID entityTypeId) {
        return entityJpaRepository.existsByEntityTypeId(entityTypeId);
    }

    @Override
    public void deleteById(UUID id) {
        entityJpaRepository.deleteById(id);
    }
}
