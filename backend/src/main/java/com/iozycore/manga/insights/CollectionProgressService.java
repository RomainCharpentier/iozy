package com.iozycore.manga.insights;

import com.iozycore.domain.catalog.Entity;
import com.iozycore.domain.catalog.EntityRepository;
import com.iozycore.manga.domain.MangaEdition;
import com.iozycore.manga.domain.MangaEditionRepository;
import com.iozycore.domain.catalog.Variant;
import com.iozycore.domain.ownership.Ownership;
import com.iozycore.domain.ownership.OwnershipRepository;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.TreeSet;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * SOURCE DE VÉRITÉ UNIQUE de la progression "X tomes possédés sur Y".
 * <p>
 * Cette question était auparavant recalculée par quatre implémentations
 * indépendantes - la tuile de Ma collection, la fiche d'une œuvre, le moteur
 * de suggestions et la page publique - qui ne s'accordaient pas (audit du
 * 2026-08-21, voir docs/DESIGN_MIGRATION_V1.2.md, Lot 31) : une même série
 * s'affichait 3/72 à un endroit et 2/72 à un autre, une autre perdait
 * complètement son total. Toute nouvelle surface qui affiche une progression
 * doit passer par ici, jamais recalculer.
 * <p>
 * Lecture pure, cross-contexte (Catalog + Ownership), même convention que
 * {@link StatsService} : consomme les repositories directement, n'écrit rien.
 *
 * <h2>Les règles, en un seul endroit</h2>
 * <ol>
 *   <li>Les groupes viennent des Variant CATALOGUÉS, regroupés par leur
 *       attribut {@code edition} découpé (un tome sans édition rejoint le
 *       groupe {@code ""}).</li>
 *   <li><b>Fusion</b> : s'il existe exactement UNE édition nommée et un groupe
 *       de tomes sans édition précisée, les seconds rejoignent la première -
 *       c'est presque toujours un tome ajouté à la main sans retaper un nom
 *       déjà connu, pas une seconde édition. Dès qu'il existe 2+ éditions
 *       nommées, l'ambiguïté est réelle : rien n'est fusionné.</li>
 *   <li>Le possédé se mesure sur les Ownership ACTIVES uniquement (un tome
 *       revendu ou perdu n'est plus possédé), par numéro de tome DISTINCT :
 *       deux exemplaires du même tome ne font pas "2 tomes possédés".</li>
 *   <li>Le total vient de la fiche MangaEdition de cette édition précise,
 *       jamais d'un attribut de la série (voir Lot 16).</li>
 *   <li>L'édition <b>dominante</b> - celle qu'une vue à une seule ligne doit
 *       nommer - est l'unique groupe qui contient des tomes possédés. Zéro ou
 *       plusieurs groupes possédés : pas de dominante, la progression est
 *       genuinement ambiguë et ne doit pas être tranchée arbitrairement.</li>
 * </ol>
 */
@Service
public class CollectionProgressService {

    private static final String EDITION = "edition";
    private static final String VOLUME_NUMBER = "volumeNumber";

    private final EntityRepository entityRepository;
    private final OwnershipRepository ownershipRepository;
    private final MangaEditionRepository mangaEditionRepository;

    public CollectionProgressService(EntityRepository entityRepository,
                                      OwnershipRepository ownershipRepository,
                                      MangaEditionRepository mangaEditionRepository) {
        this.entityRepository = entityRepository;
        this.ownershipRepository = ownershipRepository;
        this.mangaEditionRepository = mangaEditionRepository;
    }

    /** Progression de toutes les œuvres - une seule passe sur les Ownership, pour que
     * Ma collection n'ait pas à faire une requête par série. */
    public List<CollectionProgress> computeAll() {
        Map<UUID, List<Ownership>> activeByEntity = ownershipRepository.findAll().stream()
                .filter(Ownership::isActive)
                .collect(Collectors.groupingBy(Ownership::entityId));
        // Toutes les éditions en UNE requête plutôt qu'une par groupe d'édition
        // et par œuvre : sur une collection de 500 séries, c'était ~1000 allers
        // à la base pour un seul affichage de Ma collection.
        Map<String, Integer> totalsByEntityAndEdition = indexEditionTotals();
        return entityRepository.search(null, null, null).stream()
                .map(entity -> compute(entity, activeByEntity.getOrDefault(entity.id(), List.of()),
                        totalsByEntityAndEdition))
                .collect(Collectors.toList());
    }

    private Map<String, Integer> indexEditionTotals() {
        Map<String, Integer> totals = new LinkedHashMap<>();
        for (MangaEdition edition : mangaEditionRepository.findAll()) {
            if (edition.entityId() != null && edition.totalVolumes() != null) {
                totals.put(editionKey(edition.entityId(), edition.editionName()), edition.totalVolumes());
            }
        }
        return totals;
    }

    /**
     * L'identité d'une édition : (œuvre, nom), à la casse et aux espaces près.
     *
     * <p>Publique parce qu'elle était RECOPIÉE - {@code StatsService} en avait
     * sa propre version pour valoriser la collection au prix neuf (Lot 56).
     * Deux copies d'une clé sont deux occasions de diverger, et c'est
     * exactement ce qui a produit les écarts de progression des Lots 31 et 49 :
     * la règle vit ici, avec le calcul qu'elle sert.
     */
    public static String editionKey(UUID entityId, String editionName) {
        return entityId + "|" + editionName.trim().toLowerCase();
    }

    /** Progression d'une œuvre précise - {@link Optional#empty()} si elle n'existe pas. */
    public Optional<CollectionProgress> compute(UUID entityId) {
        return entityRepository.findById(entityId)
                .map(entity -> compute(entity, ownershipRepository.findByEntityId(entityId).stream()
                        .filter(Ownership::isActive)
                        .collect(Collectors.toList()), indexEditionTotals()));
    }

    private CollectionProgress compute(Entity entity, List<Ownership> activeOwnerships,
                                        Map<String, Integer> totalsByEntityAndEdition) {
        Map<String, List<String>> groups = displayGroups(entity);
        Map<UUID, Variant> variantsById = entity.variants().stream()
                .collect(Collectors.toMap(Variant::id, v -> v, (a, b) -> a));

        List<CollectionProgress.EditionProgress> editions = new ArrayList<>();
        TreeSet<Integer> allOwned = new TreeSet<>();
        for (Map.Entry<String, List<String>> group : groups.entrySet()) {
            String editionName = group.getKey();
            List<String> sourceEditions = group.getValue();

            TreeSet<Integer> catalogued = new TreeSet<>();
            for (Variant variant : entity.variants()) {
                if (sourceEditions.contains(editionOf(variant))) {
                    Integer number = volumeNumberOf(variant);
                    if (number != null) {
                        catalogued.add(number);
                    }
                }
            }

            TreeSet<Integer> owned = new TreeSet<>();
            for (Ownership ownership : activeOwnerships) {
                Variant variant = ownership.variantId().map(variantsById::get).orElse(null);
                if (variant == null || !sourceEditions.contains(editionOf(variant))) {
                    continue;
                }
                Integer number = volumeNumberOf(variant);
                if (number != null) {
                    owned.add(number);
                }
            }
            allOwned.addAll(owned);

            editions.add(new CollectionProgress.EditionProgress(editionName, sourceEditions,
                    List.copyOf(owned), List.copyOf(catalogued),
                    editionName.isEmpty() ? null : totalsByEntityAndEdition.get(editionKey(entity.id(), editionName))));
        }

        // Ordre stable et utile : l'édition la plus fournie d'abord (même règle
        // que l'ancien groupVariantsByEdition côté web).
        editions.sort(Comparator.comparingInt((CollectionProgress.EditionProgress e) -> e.cataloguedVolumeNumbers().size())
                .reversed());

        List<CollectionProgress.EditionProgress> withOwned = editions.stream()
                .filter(e -> e.ownedCount() > 0)
                .toList();
        CollectionProgress.EditionProgress dominant = withOwned.size() == 1 ? withOwned.get(0) : null;

        return new CollectionProgress(entity.id(), entity.title(), List.copyOf(editions), dominant, allOwned.size());
    }

    /**
     * Groupes affichables : nom d'édition -> valeurs brutes qu'il recouvre.
     * Applique la règle de fusion décrite en tête de classe.
     */
    private static Map<String, List<String>> displayGroups(Entity entity) {
        Map<String, Boolean> present = new LinkedHashMap<>();
        for (Variant variant : entity.variants()) {
            if (volumeNumberOf(variant) == null) {
                continue;
            }
            present.putIfAbsent(editionOf(variant), Boolean.TRUE);
        }
        List<String> named = present.keySet().stream().filter(name -> !name.isEmpty()).toList();
        boolean hasBlank = present.containsKey("");

        Map<String, List<String>> groups = new LinkedHashMap<>();
        if (named.size() == 1 && hasBlank) {
            groups.put(named.get(0), List.of(named.get(0), ""));
            return groups;
        }
        for (String name : present.keySet()) {
            groups.put(name, List.of(name));
        }
        return groups;
    }


    private static String editionOf(Variant variant) {
        Object value = variant.attributes().get(EDITION);
        return value instanceof String s ? s.trim() : "";
    }

    /** Les attributs sont un sac non typé : un même champ peut arriver en Integer d'un
     * fournisseur et en String d'un autre (voir PublicShareController). */
    private static Integer volumeNumberOf(Variant variant) {
        Object value = variant.attributes().get(VOLUME_NUMBER);
        if (value instanceof Number number) {
            return number.intValue();
        }
        if (value instanceof String text) {
            try {
                return Integer.parseInt(text.trim());
            } catch (NumberFormatException ignored) {
                return null;
            }
        }
        return null;
    }
}
