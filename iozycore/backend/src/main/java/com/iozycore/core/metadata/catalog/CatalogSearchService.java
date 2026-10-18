package com.iozycore.core.metadata.catalog;

import com.iozycore.core.domain.catalog.Entity;
import com.iozycore.core.domain.catalog.EntityRepository;
import com.iozycore.core.domain.shared.TexteRecherche;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Retrieval VIA THE IOZYCORE DATABASE - the fourth module of metadata
 * (Batch 132), next to mangas, video games and board games.
 * <p>
 * What the instance already knows goes through here: the cross-type search of the
 * catalog (title, type, tag - the "Search" screen queries it at the
 * same time as the external providers, see SearchPage on the web side) and the
 * titles already known for a type, which {@code MetadataSearchService} uses
 * so as not to propose again for adding what is already owned.
 * <p>
 * Read only. Making a work EXIST (identify-or-create) remains a use
 * case of the application (see CatalogEntityResolver): this module says what
 * the database contains, it writes nothing to it.
 */
@Service
@RequiredArgsConstructor
public class CatalogSearchService {

    private final EntityRepository entityRepository;

    /** Cross-type search on the catalog (UC4): by title, filterable by type and/or tag, all optional. */
    public List<Entity> rechercher(String titre, UUID entityTypeId, UUID tagId) {
        return entityRepository.search(titre, entityTypeId, tagId);
    }

    /**
     * The titles already in the catalog for this type, under their
     * comparison key (accents and punctuation folded, see TexteRecherche) - the
     * same rule as the deduplication of quick add.
     */
    public Set<String> titresConnus(UUID entityTypeId) {
        return entityRepository.findAllByType(entityTypeId).stream()
                .map(entity -> TexteRecherche.normaliser(entity.title()))
                .collect(Collectors.toSet());
    }
}
