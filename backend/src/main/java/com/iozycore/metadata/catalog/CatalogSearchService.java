package com.iozycore.metadata.catalog;

import com.iozycore.domain.catalog.Entity;
import com.iozycore.domain.catalog.EntityRepository;
import com.iozycore.domain.shared.TexteRecherche;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * La récupération VIA LA BASE IOZYCORE - le quatrième module de metadata
 * (Lot 132), à côté des mangas, des jeux vidéo et des jeux de société.
 * <p>
 * Ce que l'instance sait déjà passe par ici : la recherche transversale du
 * catalogue (titre, type, tag - l'écran « Rechercher » l'interroge en même
 * temps que les fournisseurs externes, voir SearchPage côté web) et les
 * titres déjà connus d'un type, dont {@code MetadataSearchService} se sert
 * pour ne pas reproposer à l'ajout ce qu'on possède déjà.
 * <p>
 * Lecture seule. Faire EXISTER une fiche (identifier-ou-créer) reste un cas
 * d'usage de l'application (voir CatalogEntityResolver) : ce module dit ce
 * que la base contient, il n'y écrit rien.
 */
@Service
public class CatalogSearchService {

    private final EntityRepository entityRepository;

    public CatalogSearchService(EntityRepository entityRepository) {
        this.entityRepository = entityRepository;
    }

    /** Recherche transversale sur le catalogue (UC4) : par titre, filtrable par type et/ou tag, tous optionnels. */
    public List<Entity> rechercher(String titre, UUID entityTypeId, UUID tagId) {
        return entityRepository.search(titre, entityTypeId, tagId);
    }

    /**
     * Les titres déjà au catalogue pour ce type, sous leur clé de
     * comparaison (accents et ponctuation pliés, voir TexteRecherche) - la
     * même règle que la déduplication de l'ajout rapide.
     */
    public Set<String> titresConnus(UUID entityTypeId) {
        return entityRepository.findAllByType(entityTypeId).stream()
                .map(entity -> TexteRecherche.normaliser(entity.title()))
                .collect(Collectors.toSet());
    }
}
