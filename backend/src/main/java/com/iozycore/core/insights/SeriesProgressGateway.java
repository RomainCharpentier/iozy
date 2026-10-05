package com.iozycore.core.insights;

import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * All the progress values that the universes can compute, seen as one
 * source - what the core consumes (Batch 133). With no universe with volumes,
 * the list is empty and nothing breaks.
 */
@Service
public class SeriesProgressGateway {

    private final List<SeriesProgressSource> sources;

    public SeriesProgressGateway(List<SeriesProgressSource> sources) {
        this.sources = sources;
    }

    public List<CollectionProgress> computeAll() {
        List<CollectionProgress> toutes = new ArrayList<>();
        for (SeriesProgressSource source : sources) {
            toutes.addAll(source.computeAll());
        }
        return toutes;
    }

    public Optional<CollectionProgress> compute(UUID entityId) {
        for (SeriesProgressSource source : sources) {
            Optional<CollectionProgress> progression = source.compute(entityId);
            if (progression.isPresent()) {
                return progression;
            }
        }
        return Optional.empty();
    }
}
