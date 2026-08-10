package com.iozycore.domain.editionupgrade;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface EditionUpgradeWishRepository {

    EditionUpgradeWish save(EditionUpgradeWish wish);

    Optional<EditionUpgradeWish> findById(UUID id);

    /** Envies d'amélioration pour une série précise (voir SeriesCompletenessSection côté web). */
    List<EditionUpgradeWish> findByEntityId(UUID entityId);

    /** Toutes les envies d'amélioration ("Mon profil" - voir EditionUpgradesPage côté web). */
    List<EditionUpgradeWish> findAll();

    void deleteById(UUID id);
}
