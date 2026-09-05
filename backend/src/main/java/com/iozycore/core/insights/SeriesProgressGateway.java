package com.iozycore.core.insights;

import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Toutes les progressions que les univers savent calculer, vues comme une
 * seule source - ce que le cœur consomme (Lot 133). Sans univers à tomes,
 * la liste est vide et rien ne casse.
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
