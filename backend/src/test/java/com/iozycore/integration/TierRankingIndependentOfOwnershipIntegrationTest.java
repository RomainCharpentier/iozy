package com.iozycore.integration;

import com.iozycore.api.dto.TierListDtos.SetRankRequest;
import com.iozycore.api.tierlist.TierListController;
import com.iozycore.application.TierListService;
import com.iozycore.domain.catalog.Entity;
import com.iozycore.domain.catalog.EntityRepository;
import com.iozycore.domain.catalog.EntityTypeFixtures;
import com.iozycore.domain.ownership.Ownership;
import com.iozycore.domain.ownership.OwnershipCondition;
import com.iozycore.domain.ownership.OwnershipRepository;
import com.iozycore.domain.tierlist.EntityRankRepository;
import com.iozycore.domain.tierlist.Rank;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.time.LocalDate;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * <b>Classer une œuvre n'est pas la posséder.</b>
 * <p>
 * Un classement dit ce que l'utilisateur pense d'une œuvre. Le vendre, le
 * perdre, ou ne l'avoir jamais acheté ne change pas cet avis - rien de tout
 * cela ne doit donc effacer ni masquer son rang.
 * <p>
 * Le modèle le permettait déjà : {@code EntityRank} ne référence qu'une Entity,
 * jamais une Ownership, aucune suppression de possession ne le met en cascade,
 * et l'API de classement n'exige que l'existence de l'œuvre. C'était la
 * LECTURE du board qui rompait la règle : il ne partait que des œuvres
 * possédées, si bien que vendre un manga classé S le faisait disparaître de la
 * ligne S alors que son rang existait toujours en base.
 * <p>
 * L'autre moitié de la règle est vérifiée ici aussi : la file « à classer »
 * reste, elle, volontairement adossée à la possession. <b>Pouvoir être
 * classée</b> et <b>devoir apparaître dans « à classer »</b> sont deux
 * questions distinctes - sinon cette file serait noyée sous les œuvres
 * seulement mises en envies.
 */
class TierRankingIndependentOfOwnershipIntegrationTest extends PostgresIntegrationTest {

    @Autowired
    private TierListController tierListController;

    @Autowired
    private TierListService tierListService;

    @Autowired
    private EntityRankRepository entityRankRepository;

    @Autowired
    private EntityRepository entityRepository;

    @Autowired
    private OwnershipRepository ownershipRepository;

    private static final UUID MANGA = EntityTypeFixtures.MANGA.id();

    private UUID uneOeuvreCataloguee(String prefixe) {
        return entityRepository.save(Entity.create(MANGA, prefixe + " " + UUID.randomUUID())).id();
    }

    private long possessionsDe(UUID entityId) {
        return ownershipRepository.findAll().stream().filter(o -> o.entityId().equals(entityId)).count();
    }

    private boolean apparaitClassee(UUID entityId, Rank rank) {
        return tierListService.generalBoard(MANGA).ranked().get(rank).stream()
                .anyMatch(e -> e.id().equals(entityId));
    }

    private boolean apparaitAClasser(UUID entityId) {
        return tierListService.generalBoard(MANGA).unranked().stream()
                .anyMatch(e -> e.id().equals(entityId));
    }

    /** Cas B du cahier des charges : une œuvre du catalogue, jamais possédée, doit pouvoir être classée. */
    @Test
    void une_oeuvre_cataloguee_sans_possession_peut_etre_classee_sans_qu_aucune_possession_ne_soit_creee() {
        UUID entityId = uneOeuvreCataloguee("Monster");
        assertThat(possessionsDe(entityId)).isZero();

        tierListController.setGeneralRank(entityId, new SetRankRequest(Rank.A));

        assertThat(entityRankRepository.findByEntityId(entityId)).isPresent();
        assertThat(entityRankRepository.findByEntityId(entityId).get().rank()).isEqualTo(Rank.A);
        // L'assertion qui compte : classer n'acquiert rien.
        assertThat(possessionsDe(entityId)).isZero();
        assertThat(apparaitClassee(entityId, Rank.A)).isTrue();
    }

    /** Cas A : acquérir puis revendre une œuvre classée ne change pas son rang. */
    @Test
    void le_rang_survit_a_l_acquisition_puis_a_la_revente() {
        UUID entityId = uneOeuvreCataloguee("Vinland Saga");
        tierListController.setGeneralRank(entityId, new SetRankRequest(Rank.A));

        // 1. On l'achète : le rang ne bouge pas.
        Ownership ownership = ownershipRepository.save(
                Ownership.acquire(entityId, null, OwnershipCondition.NEW, LocalDate.now(), null));
        assertThat(entityRankRepository.findByEntityId(entityId).orElseThrow().rank()).isEqualTo(Rank.A);
        assertThat(apparaitClassee(entityId, Rank.A)).isTrue();

        // 2. On la revend : le rang ne bouge pas davantage. Avant ce module, le
        //    board ne partait que des œuvres possédées - l'œuvre disparaissait
        //    ici de la ligne A alors que son EntityRank était toujours là.
        ownership.markSold();
        ownershipRepository.save(ownership);
        assertThat(entityRankRepository.findByEntityId(entityId).orElseThrow().rank()).isEqualTo(Rank.A);
        assertThat(apparaitClassee(entityId, Rank.A)).isTrue();

        // 3. On supprime la possession pour de bon : idem.
        ownershipRepository.deleteById(ownership.id());
        assertThat(entityRankRepository.findByEntityId(entityId).orElseThrow().rank()).isEqualTo(Rank.A);
        assertThat(apparaitClassee(entityId, Rank.A)).isTrue();
    }

    /**
     * Cas C : la file « à classer » ne se remplit pas de tout le catalogue.
     * Pouvoir être classée n'est pas devoir apparaître automatiquement.
     */
    @Test
    void la_file_a_classer_ne_propose_que_des_oeuvres_possedees() {
        UUID cataloguee = uneOeuvreCataloguee("Ashita no Joe");
        UUID possedee = uneOeuvreCataloguee("Slam Dunk");
        ownershipRepository.save(Ownership.acquire(possedee, null, OwnershipCondition.NEW, LocalDate.now(), null));

        assertThat(apparaitAClasser(possedee)).isTrue();
        // Une œuvre seulement cataloguée (mise en envies, croisée en recherche)
        // reste classable à la demande, mais ne vient pas encombrer la file.
        assertThat(apparaitAClasser(cataloguee)).isFalse();
    }

    @Test
    void declasser_une_oeuvre_la_retire_du_board_sans_toucher_a_sa_possession() {
        UUID entityId = uneOeuvreCataloguee("Berserk");
        Ownership ownership = ownershipRepository.save(
                Ownership.acquire(entityId, null, OwnershipCondition.NEW, LocalDate.now(), null));
        tierListController.setGeneralRank(entityId, new SetRankRequest(Rank.S));

        tierListController.setGeneralRank(entityId, new SetRankRequest(null));

        assertThat(entityRankRepository.findByEntityId(entityId)).isEmpty();
        assertThat(apparaitClassee(entityId, Rank.S)).isFalse();
        // Déclassée, elle redevient une œuvre possédée à classer.
        assertThat(apparaitAClasser(entityId)).isTrue();
        assertThat(ownershipRepository.findById(ownership.id())).isPresent();
    }
}
