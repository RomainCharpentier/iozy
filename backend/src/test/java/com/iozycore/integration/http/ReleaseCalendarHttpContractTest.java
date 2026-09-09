package com.iozycore.integration.http;

import com.iozycore.core.application.QuickAddService;
import com.iozycore.core.domain.catalog.EntityTypeFixtures;
import com.iozycore.core.domain.ownership.OwnershipCondition;
import com.iozycore.core.domain.wishlist.WishlistEntry;
import com.iozycore.core.domain.wishlist.WishlistEntryRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.time.LocalDate;
import java.util.Map;
import java.util.UUID;

import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Le contrat HTTP de {@code /api/insights/releases} - le calendrier des
 * sorties (lot 146).
 *
 * <h2>Ce que ces tests figent</h2>
 * La forme d'une ligne, telle que le client la lit pour construire son mois ;
 * la relation, toujours écrite ; la période, bornée en 400 et non en 500 ; et
 * le drapeau {@code hasReleaseSource} des catégories, qui dit au client
 * lesquelles ont une source de dates. La date passe ici par la fiche
 * (attribut saisi), le seul chemin qui ne dépende d'aucun fournisseur ; les
 * sources de chaque univers ont leurs propres tests.
 */
class ReleaseCalendarHttpContractTest extends HttpContractTestBase {

    @Autowired
    private QuickAddService quickAddService;

    @Autowired
    private WishlistEntryRepository wishlistEntryRepository;

    @Test
    void lists_a_hand_dated_owned_work_with_everything_the_calendar_page_needs() throws Exception {
        String title = "Ark Nova " + UUID.randomUUID();
        QuickAddService.QuickAddResult result = quickAddService.addNewEntityWithOwnership(
                EntityTypeFixtures.BOARD_GAME.id(), title, OwnershipCondition.NEW,
                Map.of("releaseDate", "2026-10-14", "coverImageUrl", "https://img/ark-nova.jpg"));

        mockMvc.perform(get("/api/insights/releases").param("from", "2026-10-01").param("to", "2026-10-31"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.from").value("2026-10-01"))
                .andExpect(jsonPath("$.to").value("2026-10-31"))
                .andExpect(jsonPath("$.entries[?(@.entityId == '" + result.entityId() + "')]").exists())
                .andExpect(jsonPath("$.entries[?(@.entityId == '" + result.entityId() + "')].date").value("2026-10-14"))
                .andExpect(jsonPath("$.entries[?(@.entityId == '" + result.entityId() + "')].precision").value("DAY"))
                .andExpect(jsonPath("$.entries[?(@.entityId == '" + result.entityId() + "')].entityTitle").value(title))
                .andExpect(jsonPath("$.entries[?(@.entityId == '" + result.entityId() + "')].entityTypeId")
                        .value(EntityTypeFixtures.BOARD_GAME.id().toString()))
                .andExpect(jsonPath("$.entries[?(@.entityId == '" + result.entityId() + "')].relation").value("OWNED"))
                .andExpect(jsonPath("$.entries[?(@.entityId == '" + result.entityId() + "')].source").value("MANUAL"))
                .andExpect(jsonPath("$.entries[?(@.entityId == '" + result.entityId() + "')].label").value(""))
                .andExpect(jsonPath("$.entries[?(@.entityId == '" + result.entityId() + "')].coverImageUrl")
                        .value("https://img/ark-nova.jpg"));

        // Le mois d'avant ne la montre pas : la période est la question, pas un filtre d'affichage.
        mockMvc.perform(get("/api/insights/releases").param("from", "2026-09-01").param("to", "2026-09-30"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.entries[?(@.entityId == '" + result.entityId() + "')]").doesNotExist());
    }

    @Test
    void a_wanted_work_dated_to_a_month_is_listed_as_wanted_at_month_precision() throws Exception {
        String title = "Dune Imperium " + UUID.randomUUID();
        QuickAddService.QuickAddResult result = quickAddService.addNewEntityWithOwnership(
                EntityTypeFixtures.BOARD_GAME.id(), title, OwnershipCondition.NEW, Map.of("releaseDate", "2026-11"));
        // Un exemplaire est né avec la fiche : l'œuvre est possédée ET voulue, et possédée l'emporte.
        wishlistEntryRepository.save(WishlistEntry.add(result.entityId(), LocalDate.now()));

        mockMvc.perform(get("/api/insights/releases").param("from", "2026-11-01").param("to", "2026-11-30"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.entries[?(@.entityId == '" + result.entityId() + "')].date").value("2026-11"))
                .andExpect(jsonPath("$.entries[?(@.entityId == '" + result.entityId() + "')].precision").value("MONTH"))
                .andExpect(jsonPath("$.entries[?(@.entityId == '" + result.entityId() + "')].relation").value("OWNED"));
    }

    @Test
    void answers_400_on_an_unreadable_date_a_reversed_period_or_more_than_a_year() throws Exception {
        mockMvc.perform(get("/api/insights/releases").param("from", "octobre").param("to", "2026-10-31"))
                .andExpect(status().isBadRequest());
        mockMvc.perform(get("/api/insights/releases").param("from", "2026-10-31").param("to", "2026-10-01"))
                .andExpect(status().isBadRequest());
        mockMvc.perform(get("/api/insights/releases").param("from", "2026-01-01").param("to", "2027-06-01"))
                .andExpect(status().isBadRequest());
        mockMvc.perform(get("/api/insights/releases").param("from", "2026-10-01"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void an_empty_month_is_an_empty_list_not_an_error() throws Exception {
        mockMvc.perform(get("/api/insights/releases").param("from", "1990-01-01").param("to", "1990-01-31"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.entries").isArray())
                .andExpect(jsonPath("$.entries", hasSize(0)));
    }

    @Test
    void each_category_says_whether_an_universe_dates_its_releases() throws Exception {
        mockMvc.perform(get("/api/entity-types"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.code == 'MANGA')].hasReleaseSource").value(true))
                .andExpect(jsonPath("$[?(@.code == 'VIDEO_GAME')].hasReleaseSource").value(true))
                // BoardGameGeek ne date qu'à l'année : rien d'automatique, seulement la fiche.
                .andExpect(jsonPath("$[?(@.code == 'BOARD_GAME')].hasReleaseSource").value(false));
    }
}
