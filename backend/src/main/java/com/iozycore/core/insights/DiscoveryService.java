package com.iozycore.core.insights;

import com.iozycore.core.domain.catalog.EntityTypeRepository;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * Découverte heuristique (« séries que je n'ai pas », recommandations) -
 * jamais un vrai moteur de recommandation IA (cohérent avec le principe
 * « l'IA est une aide, jamais une dépendance » posé dès la conception).
 * Chaque suggestion est justifiée par un signal concret et traçable, et ce
 * signal appartient à un univers : même auteur pour les mangas, catégories
 * communes pour les jeux de société, jeux similaires pour les jeux vidéo.
 * Depuis le Lot 133, le cœur ne connaît aucun de ces signaux : il aiguille
 * vers la {@link DiscoverySource} qui couvre le type demandé.
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
     * Les découvertes d'un type, par son code - résolu par le code, jamais par
     * un identifiant en dur, pour survivre à l'édition du type. Un code
     * inconnu, ou un type que personne ne couvre, est une demande qu'on ne
     * sait pas servir.
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
