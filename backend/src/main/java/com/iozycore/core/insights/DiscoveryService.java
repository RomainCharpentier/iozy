package com.iozycore.core.insights;

import com.iozycore.core.domain.catalog.EntityTypeRepository;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * Heuristic discovery ("series I do not have", recommendations) -
 * never a real AI recommendation engine (consistent with the principle
 * "AI is a help, never a dependency" set from the design).
 * Each suggestion is justified by a concrete and traceable signal, and this
 * signal belongs to a universe: same author for mangas, common categories
 * for board games, similar games for video games.
 * Since Batch 133, the core knows none of these signals: it routes
 * to the {@link DiscoverySource} that covers the requested type.
 */
@Service
public class DiscoveryService {

    private final EntityTypeRepository entityTypeRepository;
    private final List<DiscoverySource> sources;

    public DiscoveryService(EntityTypeRepository entityTypeRepository, List<DiscoverySource> sources) {
        this.entityTypeRepository = entityTypeRepository;
        this.sources = sources;
    }

    /**
     * The discoveries of a type, by its code - resolved by the code, never by
     * a hard-coded id, to survive the editing of the type. An unknown
     * code, or a type that nobody covers, is a request we do not
     * know how to serve.
     */
    public List<DiscoveryCandidate> discover(String entityTypeCode) {
        return entityTypeRepository.findByCode(entityTypeCode)
                .flatMap(type -> sources.stream()
                        .filter(source -> source.supports(type))
                        .findFirst()
                        .map(source -> source.discover(type)))
                .orElseThrow(() -> new IllegalArgumentException("Aucune découverte pour le type : " + entityTypeCode));
    }
}
