package com.iozycore.manga;

import com.iozycore.core.insights.CollectionProgress;
import com.iozycore.core.insights.OwnedValueSource;
import com.iozycore.manga.domain.MangaEdition;
import com.iozycore.manga.domain.MangaEditionRepository;
import com.iozycore.manga.insights.CollectionProgressService;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Ce que valent, au prix du neuf, les tomes qu'on possède : le prix neuf
 * par tome de l'édition de référence, multiplié par les tomes possédés de
 * cette édition. Un tome trouvé d'occasion à 2 € vaut ce que vaut ce tome
 * (logique extraite de StatsService au Lot 133).
 */
@Component
public class MangaOwnedValueSource implements OwnedValueSource {

    private final MangaEditionRepository mangaEditionRepository;
    private final CollectionProgressService progressService;

    public MangaOwnedValueSource(MangaEditionRepository mangaEditionRepository, CollectionProgressService progressService) {
        this.mangaEditionRepository = mangaEditionRepository;
        this.progressService = progressService;
    }

    @Override
    public List<OwnedValue> valeurs() {
        Map<String, BigDecimal> prixNeufParEdition = new HashMap<>();
        for (MangaEdition edition : mangaEditionRepository.findAll()) {
            if (edition.entityId() != null && edition.retailPriceNewPerVolume() != null) {
                prixNeufParEdition.put(CollectionProgress.editionKey(edition.entityId(), edition.editionName()),
                        edition.retailPriceNewPerVolume());
            }
        }
        List<OwnedValue> valeurs = new ArrayList<>();
        for (CollectionProgress progression : progressService.computeAll()) {
            for (CollectionProgress.EditionProgress groupe : progression.editions()) {
                BigDecimal prixNeuf = prixNeufParEdition.get(CollectionProgress.editionKey(progression.entityId(), groupe.editionName()));
                if (prixNeuf == null || groupe.ownedVolumeNumbers().isEmpty()) {
                    continue;
                }
                long tomes = groupe.ownedVolumeNumbers().size();
                valeurs.add(new OwnedValue(progression.entityId(), prixNeuf.multiply(BigDecimal.valueOf(tomes)), tomes));
            }
        }
        return valeurs;
    }
}
