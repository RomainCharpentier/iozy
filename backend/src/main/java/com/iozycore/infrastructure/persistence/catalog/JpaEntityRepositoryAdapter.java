package com.iozycore.infrastructure.persistence.catalog;

import com.iozycore.domain.catalog.Entity;
import com.iozycore.domain.catalog.EntityRepository;
import com.iozycore.domain.catalog.Variant;
import com.iozycore.domain.shared.TexteRecherche;
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
public class JpaEntityRepositoryAdapter implements EntityRepository {

    private final EntityJpaRepository entityJpaRepository;
    private final VariantJpaRepository variantJpaRepository;

    public JpaEntityRepositoryAdapter(EntityJpaRepository entityJpaRepository,
                                       VariantJpaRepository variantJpaRepository) {
        this.entityJpaRepository = entityJpaRepository;
        this.variantJpaRepository = variantJpaRepository;
    }

    @Override
    public Entity save(Entity entity) {
        Instant createdAt = entityJpaRepository.findById(entity.id())
                .map(EntityJpaEntity::getCreatedAt)
                .orElse(Instant.now());

        EntityJpaEntity saved = entityJpaRepository.save(EntityMapper.toJpa(entity, createdAt));

        // Les variants sont internes à l'Entity, mais peuvent être référencés
        // par une Ownership (FK ownership.variant_id) - on ne peut donc pas les
        // supprimer intégralement puis les recréer à l'identique comme avant :
        // supprimer un Variant encore référencé lève une violation de contrainte,
        // même s'il est réinséré avec le même id juste après (constaté : ajouter
        // un 2e tome à une série qui possède déjà une Ownership sur son 1er tome
        // levait une DataIntegrityViolationException). On ne supprime donc que
        // les variants qui ont réellement disparu de l'Entity, et on upsert
        // (save) le reste - un id déjà connu de Postgres devient une mise à
        // jour, un id inconnu une insertion (même mécanisme que EntityJpaEntity
        // ci-dessus).
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
     * Les attributs ou l'on cherche AUSSI, apres le titre : le champ de
     * recherche promet « un titre, un auteur… », et ne tenait que la
     * premiere moitie.
     */
    private static final List<String> ATTRIBUTS_CHERCHES = List.of("mangaka", "author", "studio", "designer",
            "developer", "publisher");

    /**
     * Type et tag se filtrent en base ; le titre en memoire, pour plier
     * accents et ponctuation (voir {@link TexteRecherche}). Le cout est
     * celui du listing complet d'un type, que Ma collection et le Catalogue
     * paient deja a chaque visite - et la requete est temporisee cote client.
     *
     * <p>L'ordre dit la pertinence : les titres qui COMMENCENT par la
     * recherche, puis ceux qui la contiennent, puis les oeuvres retrouvees
     * par un auteur. Alphabetique a l'interieur de chaque groupe - c'est
     * l'ordre de la base, que le tri stable conserve. Avant, « one » rendait
     * « Bone » avant « One Piece ».
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
        // « attaque titans » doit trouver « L'Attaque des Titans » : chaque
        // mot tape est dans le titre, pas forcement a la suite.
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
     * Rattache leurs tomes à plusieurs œuvres en UNE requête, au lieu d'une par
     * œuvre.
     * <p>
     * Ces deux listings sont le chemin le plus fréquenté de l'app - Ma
     * collection, un rayon, l'export, la progression, les suggestions et la page
     * publique en dépendent tous - et chacun coûtait 1 + N requêtes. Mesuré au
     * moment du correctif : 6 œuvres, donc 6 requêtes de tomes évitées ; à 500
     * séries, 500. Le regroupement se fait en mémoire, la liste des œuvres étant
     * de toute façon déjà chargée.
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
