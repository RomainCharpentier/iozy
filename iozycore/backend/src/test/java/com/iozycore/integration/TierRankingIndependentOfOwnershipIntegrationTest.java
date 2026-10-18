package com.iozycore.integration;

import com.iozycore.core.api.dto.TierListDtos.SetRankRequest;
import com.iozycore.core.api.tierlist.TierListController;
import com.iozycore.core.application.TierListService;
import com.iozycore.core.domain.catalog.Entity;
import com.iozycore.core.domain.catalog.EntityRepository;
import com.iozycore.core.domain.catalog.EntityTypeFixtures;
import com.iozycore.core.domain.ownership.Ownership;
import com.iozycore.core.domain.ownership.OwnershipCondition;
import com.iozycore.core.domain.ownership.OwnershipRepository;
import com.iozycore.core.domain.tierlist.EntityRankRepository;
import com.iozycore.core.domain.tierlist.Rank;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.time.LocalDate;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * <b>Ranking a work is not owning it.</b>
 * <p>
 * A ranking says what the user thinks of a work. Selling it,
 * losing it, or never having bought it does not change this opinion - none of this
 * must therefore erase or hide its rank.
 * <p>
 * The model already allowed it: {@code EntityRank} only references an Entity,
 * never an Ownership, no deletion of an ownership cascades to it,
 * and the ranking API only requires the work to exist. It was the
 * READ of the board that broke the rule: it only started from the owned
 * works, so that selling a manga ranked S made it disappear from the
 * S row while its rank still existed in the database.
 * <p>
 * The other half of the rule is checked here too: the "to rank" queue
 * stays, on purpose, tied to ownership. <b>Being able to be
 * ranked</b> and <b>having to appear in "to rank"</b> are two distinct
 * questions - otherwise this queue would be drowned under the works
 * only added to the wishes.
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

    /** Case B of the specification: a catalogue work, never owned, must be able to be ranked. */
    @Test
    void une_oeuvre_cataloguee_sans_possession_peut_etre_classee_sans_qu_aucune_possession_ne_soit_creee() {
        UUID entityId = uneOeuvreCataloguee("Monster");
        assertThat(possessionsDe(entityId)).isZero();

        tierListController.setGeneralRank(entityId, new SetRankRequest(Rank.A));

        assertThat(entityRankRepository.findByEntityId(entityId)).isPresent();
        assertThat(entityRankRepository.findByEntityId(entityId).get().rank()).isEqualTo(Rank.A);
        // The assertion that matters: ranking acquires nothing.
        assertThat(possessionsDe(entityId)).isZero();
        assertThat(apparaitClassee(entityId, Rank.A)).isTrue();
    }

    /** Case A: acquiring then selling a ranked work does not change its rank. */
    @Test
    void le_rang_survit_a_l_acquisition_puis_a_la_revente() {
        UUID entityId = uneOeuvreCataloguee("Vinland Saga");
        tierListController.setGeneralRank(entityId, new SetRankRequest(Rank.A));

        // 1. We buy it: the rank does not move.
        Ownership ownership = ownershipRepository.save(
                Ownership.acquire(entityId, null, OwnershipCondition.NEW, LocalDate.now(), null));
        assertThat(entityRankRepository.findByEntityId(entityId).orElseThrow().rank()).isEqualTo(Rank.A);
        assertThat(apparaitClassee(entityId, Rank.A)).isTrue();

        // 2. We sell it again: the rank does not move either. Before this module, the
        //    board only started from the owned works - the work disappeared
        //    here from the A row while its EntityRank was still there.
        ownership.markSold();
        ownershipRepository.save(ownership);
        assertThat(entityRankRepository.findByEntityId(entityId).orElseThrow().rank()).isEqualTo(Rank.A);
        assertThat(apparaitClassee(entityId, Rank.A)).isTrue();

        // 3. We delete the ownership for good: same.
        ownershipRepository.deleteById(ownership.id());
        assertThat(entityRankRepository.findByEntityId(entityId).orElseThrow().rank()).isEqualTo(Rank.A);
        assertThat(apparaitClassee(entityId, Rank.A)).isTrue();
    }

    /**
     * Case C: the "to rank" queue is not filled with the whole catalogue.
     * Being able to be ranked does not mean having to appear automatically.
     */
    @Test
    void la_file_a_classer_ne_propose_que_des_oeuvres_possedees() {
        UUID cataloguee = uneOeuvreCataloguee("Ashita no Joe");
        UUID possedee = uneOeuvreCataloguee("Slam Dunk");
        ownershipRepository.save(Ownership.acquire(possedee, null, OwnershipCondition.NEW, LocalDate.now(), null));

        assertThat(apparaitAClasser(possedee)).isTrue();
        // A work that is only catalogued (added to the wishes, met in a search)
        // can still be ranked on demand, but does not clutter the queue.
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
        // Demoted, it becomes again an owned work to rank.
        assertThat(apparaitAClasser(entityId)).isTrue();
        assertThat(ownershipRepository.findById(ownership.id())).isPresent();
    }
}
