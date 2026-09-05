package com.iozycore.application;

import com.iozycore.domain.catalog.EntityTypeRepository;
import com.iozycore.domain.ownership.OwnershipCondition;
import com.iozycore.metadata.boardgame.BggCollectionFetcher;
import com.iozycore.metadata.boardgame.BggCollectionItem;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Importe en une fois les jeux de société marqués "possédés" dans la
 * collection BGG d'un utilisateur. Réutilise QuickAddService (donc sa
 * déduplication par titre) plutôt que de dupliquer la logique de création
 * Entity+Ownership - un import BGG et un ajout rapide manuel sont
 * fondamentalement la même opération, juste déclenchée en masse.
 * <p>
 * Chaque jeu est importé dans sa propre transaction (via l'appel à
 * QuickAddService, lui-même @Transactional) : un item invalide au milieu
 * d'une collection de 200 jeux ne fait pas échouer les 199 autres.
 */
@Service
public class BggCollectionImportService {

    private static final Logger log = LoggerFactory.getLogger(BggCollectionImportService.class);

    private final BggCollectionFetcher collectionFetcher;
    private final QuickAddService quickAddService;
    private final EntityTypeRepository entityTypeRepository;

    public BggCollectionImportService(BggCollectionFetcher collectionFetcher, QuickAddService quickAddService,
                                       EntityTypeRepository entityTypeRepository) {
        this.collectionFetcher = collectionFetcher;
        this.quickAddService = quickAddService;
        this.entityTypeRepository = entityTypeRepository;
    }

    public record ImportResult(int totalFound, int created, int matchedExisting, int failed) {
    }

    public ImportResult importOwnedGames(String bggUsername) {
        List<BggCollectionItem> items = collectionFetcher.fetchOwnedGames(bggUsername);

        // Résolu une fois (pas par item) - l'import BGG reste intrinsèquement
        // lié au type "jeu de société", câblé sur son code bien connu.
        UUID boardGameTypeId = entityTypeRepository.findByCode("BOARD_GAME")
                .orElseThrow(() -> new IllegalStateException("Type BOARD_GAME introuvable"))
                .id();

        int created = 0;
        int matchedExisting = 0;
        int failed = 0;

        for (BggCollectionItem item : items) {
            try {
                Map<String, Object> attributes = item.yearPublished() != null
                        ? Map.of("yearPublished", item.yearPublished(), "bggId", item.externalId())
                        : Map.of("bggId", item.externalId());

                QuickAddService.QuickAddResult result = quickAddService.addNewEntityWithOwnership(
                        boardGameTypeId, item.title(), OwnershipCondition.USED, attributes);

                if (result.matchedExistingEntity()) {
                    matchedExisting++;
                } else {
                    created++;
                }
            } catch (Exception e) {
                // Un jeu qui échoue à l'import (titre vide, etc.) ne doit pas
                // arrêter l'import des suivants - on le compte et on continue.
                log.warn("Échec de l'import du jeu BGG '{}' (id {}) : {}", item.title(), item.externalId(), e.getMessage());
                failed++;
            }
        }

        return new ImportResult(items.size(), created, matchedExisting, failed);
    }
}
