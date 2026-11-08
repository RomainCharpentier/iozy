package com.iozycore.manga.application;

import com.iozycore.core.application.EditionLinker;
import com.iozycore.core.application.NotFoundException;
import com.iozycore.core.domain.catalog.Entity;
import com.iozycore.core.domain.catalog.EntityRepository;
import com.iozycore.core.domain.catalog.EntityTypeRepository;
import com.iozycore.core.domain.shared.TexteRecherche;
import com.iozycore.manga.domain.MangaEdition;
import com.iozycore.manga.domain.MangaEditionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * The volume count of a French edition, said by a person (lot 207).
 *
 * <p>The PATCH of {@code /api/purchase-analysis/editions/{id}} keeps a value
 * when it receives null, so a known total could never become unknown again.
 * This use case sets it explicitly: a number is stored as {@code MANUAL} (the
 * background job never touches it), {@code null} clears it and lets the job
 * try again.
 *
 * <p>The edition must be one the series already has (a volume under that
 * name, or a reference row linked to it): a typo never creates an edition in
 * the shared catalogue. A reference row that belongs to a homonym series
 * (same title, another work) is refused rather than given this series' count.
 */
@Service
@RequiredArgsConstructor
public class EditionTotalService {

    private static final String MANGA = "MANGA";

    private final EntityRepository entityRepository;
    private final EntityTypeRepository entityTypeRepository;
    private final MangaEditionRepository mangaEditionRepository;
    private final List<EditionLinker> editionLinkers;

    /**
     * @param editionName  the edition; optional when the series has a single named edition
     * @param totalVolumes at least 1, or null to make the total unknown again
     */
    @Transactional
    public MangaEdition setTotal(UUID entityId, String editionName, Integer totalVolumes) {
        Entity entity = entityRepository.findById(entityId)
                .orElseThrow(() -> new NotFoundException("Série introuvable : " + entityId));
        boolean isManga = entityTypeRepository.findByCode(MANGA)
                .map(type -> type.id().equals(entity.entityTypeId()))
                .orElse(false);
        if (!isManga) {
            throw new IllegalArgumentException("Seul un manga a des éditions avec un nombre de tomes");
        }
        if (totalVolumes != null && totalVolumes < 1) {
            throw new IllegalArgumentException("Le nombre de tomes doit être d'au moins 1");
        }
        String name = resolveEditionName(entity, editionName);
        MangaEdition edition = mangaEditionRepository.findByEntityIdAndEditionName(entityId, name)
                .or(() -> editionLinkers.stream()
                        .map(linker -> linker.editionIdPour(entity, name))
                        .flatMap(java.util.Optional::stream)
                        .findFirst()
                        .flatMap(mangaEditionRepository::findById))
                .orElseThrow(() -> new IllegalStateException("L'édition « " + name + " » n'a pas pu être créée"));
        if (!entity.id().equals(edition.entityId())) {
            throw new IllegalArgumentException("L'édition « " + name + " » appartient à une autre série du même titre");
        }
        return mangaEditionRepository.save(edition.withManualTotal(totalVolumes));
    }

    /**
     * The edition named, as the series writes it, or its single named edition
     * when none is given. The names come from its volumes, then its reference
     * rows; case, accents and punctuation are folded.
     */
    private String resolveEditionName(Entity entity, String editionName) {
        Map<String, String> names = new LinkedHashMap<>();
        for (String name : CataloguedEditions.of(entity).keySet()) {
            names.putIfAbsent(fold(name), name.trim());
        }
        for (MangaEdition edition : mangaEditionRepository.findByEntityId(entity.id())) {
            names.putIfAbsent(fold(edition.editionName()), edition.editionName().trim());
        }
        if (editionName != null && !editionName.isBlank()) {
            String known = names.get(fold(editionName));
            if (known == null) {
                throw new IllegalArgumentException("Cette série n'a pas d'édition « " + editionName.trim() + " »");
            }
            return known;
        }
        if (names.size() != 1) {
            throw new IllegalArgumentException(names.isEmpty()
                    ? "Cette série n'a pas encore d'édition : ajoute d'abord un tome"
                    : "Cette série a plusieurs éditions : précise laquelle");
        }
        return names.values().iterator().next();
    }

    private static String fold(String name) {
        return TexteRecherche.normaliser(name).trim();
    }
}
