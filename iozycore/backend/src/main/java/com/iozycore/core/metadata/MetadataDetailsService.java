package com.iozycore.core.metadata;

import com.iozycore.core.domain.catalog.EntityType;
import com.iozycore.core.domain.catalog.EntityTypeRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Asks the sources for the details of ONE work (see
 * {@link MetadataProvider#details}): when it is added, when its preview is
 * opened, when its page is reloaded from the source.
 *
 * <h2>Why (batch 160)</h2>
 * BGG gives only an id, a title and a year at search time. Every board game
 * was added without a cover, players or designers: Carcassonne had
 * {@code bggId} and {@code yearPublished}, nothing else. The details need a
 * second call per game, which is fine for the one game being added and far
 * too much for every search result.
 *
 * <h2>Never a reason to fail</h2>
 * A silent source gives no details, and the add goes on with what the search
 * gave. No provider is mandatory.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class MetadataDetailsService {

    private final List<MetadataProvider> providers;
    private final EntityTypeRepository entityTypeRepository;

    /**
     * What the sources of this type know beyond {@code attributes}. Empty
     * when no source has more, or when the one that has more did not answer.
     */
    public Map<String, Object> details(EntityType entityType, Map<String, Object> attributes) {
        Map<String, Object> details = new LinkedHashMap<>();
        for (MetadataProvider provider : providers) {
            if (!provider.supports(entityType)) {
                continue;
            }
            try {
                provider.details(attributes).forEach(details::putIfAbsent);
            } catch (RuntimeException e) {
                log.warn("Details of a {} not available from {}: {}",
                        entityType.code(), provider.getClass().getName(), e.getMessage());
            }
        }
        return details;
    }

    /**
     * The attributes of a work about to be added, completed with its details.
     * What the caller already has always wins: a detail only fills a missing
     * key. Unknown type: the attributes as they came.
     */
    public Map<String, Object> complete(UUID entityTypeId, Map<String, Object> attributes) {
        Map<String, Object> given = attributes == null ? Map.of() : attributes;
        if (entityTypeId == null) {
            return given;
        }
        return entityTypeRepository.findById(entityTypeId)
                .map(entityType -> {
                    Map<String, Object> completed = new LinkedHashMap<>(given);
                    details(entityType, given).forEach(completed::putIfAbsent);
                    return (Map<String, Object>) completed;
                })
                .orElse(given);
    }
}
