package com.iozycore.manga;

import com.iozycore.core.domain.insights.CollectionProgress;
import com.iozycore.core.application.insights.OwnedValueSource;
import com.iozycore.manga.domain.MangaEdition;
import com.iozycore.manga.domain.MangaEditionRepository;
import com.iozycore.manga.insights.CollectionProgressService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * What the volumes the user owns are worth, at the new price: the new price
 * per volume of the reference edition, multiplied by the owned volumes of
 * this edition. A volume found second-hand for 2 EUR is worth what this volume is worth
 * (logic extracted from StatsService in Batch 133).
 */
@Component
@RequiredArgsConstructor
public class MangaOwnedValueSource implements OwnedValueSource {

    private final MangaEditionRepository mangaEditionRepository;
    private final CollectionProgressService progressService;

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
