package com.iozycore.integration.http;

import com.iozycore.core.domain.user.AppUser;
import com.iozycore.core.domain.user.AppUserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.util.List;
import java.util.Map;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * The common profile (lot 218): {@code PATCH /api/auth/me} changes the pseudo
 * and the preferences of the signed-in account, {@code GET /api/auth/me}
 * gives them back. The door itself (anonymous, visit, real session) is in
 * {@link AuthHttpContractTest}.
 */
class AccountProfileHttpContractTest extends HttpContractTestBase {

    @Autowired
    private AppUserRepository accounts;

    private org.springframework.test.web.servlet.ResultActions update(Object body) throws Exception {
        return mockMvc.perform(patch("/api/auth/me").contentType("application/json").content(json(body)));
    }

    @Test
    void an_account_that_never_chose_anything_has_empty_preferences() throws Exception {
        mockMvc.perform(get("/api/auth/me"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.pseudo").value("Test"))
                .andExpect(jsonPath("$.preferences").exists())
                .andExpect(jsonPath("$.preferences.accent").doesNotExist())
                .andExpect(jsonPath("$.preferences.appearance").doesNotExist())
                .andExpect(jsonPath("$.preferences.titleComposition").doesNotExist())
                .andExpect(jsonPath("$.preferences.blindtestSound").doesNotExist());
    }

    @Test
    void the_pseudo_changes_and_me_says_the_new_one() throws Exception {
        update(Map.of("pseudo", "  Néo-2  "))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.pseudo").value("Néo-2"));

        mockMvc.perform(get("/api/auth/me")).andExpect(jsonPath("$.pseudo").value("Néo-2"));
    }

    @Test
    void a_pseudo_with_a_bad_form_is_refused_with_the_sign_up_rule() throws Exception {
        update(Map.of("pseudo", "jean dupont"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value(AppUser.PSEUDO_RULE));
        update(Map.of("pseudo", "ab")).andExpect(status().isBadRequest());
        update(Map.of("pseudo", "moi@example.com")).andExpect(status().isBadRequest());
    }

    @Test
    void a_pseudo_taken_by_another_account_is_refused_whatever_the_case() throws Exception {
        accounts.save(AppUser.nouveau("autre@example.com", "{noop}x", "Pris"));

        update(Map.of("pseudo", "pRIS"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("Ce pseudo est déjà pris."));
    }

    @Test
    void its_own_pseudo_with_other_capitals_is_not_taken() throws Exception {
        update(Map.of("pseudo", "TEST"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.pseudo").value("TEST"));
    }

    @Test
    void the_preferences_are_kept_and_a_change_keeps_the_fields_it_does_not_name() throws Exception {
        update(Map.of("preferences", Map.of(
                "accent", "TERRACOTTA",
                "appearance", "LIGHT",
                "titleComposition", List.of(
                        Map.of("language", "ROMAJI", "enabled", true),
                        Map.of("language", "FRENCH", "enabled", false),
                        Map.of("language", "ENGLISH", "enabled", true)),
                "blindtestSound", Map.of("enabled", false, "volume", 35))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.preferences.accent").value("TERRACOTTA"));

        update(Map.of("preferences", Map.of("appearance", "DARK"))).andExpect(status().isOk());

        mockMvc.perform(get("/api/auth/me"))
                .andExpect(jsonPath("$.preferences.accent").value("TERRACOTTA"))
                .andExpect(jsonPath("$.preferences.appearance").value("DARK"))
                .andExpect(jsonPath("$.preferences.titleComposition[0].language").value("ROMAJI"))
                .andExpect(jsonPath("$.preferences.titleComposition[1].enabled").value(false))
                .andExpect(jsonPath("$.preferences.titleComposition[2].language").value("ENGLISH"))
                .andExpect(jsonPath("$.preferences.blindtestSound.enabled").value(false))
                .andExpect(jsonPath("$.preferences.blindtestSound.volume").value(35));
    }

    @Test
    void values_the_account_cannot_hold_are_refused_with_a_reason() throws Exception {
        update(Map.of("preferences", Map.of("accent", "VIOLET")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("Couleur inconnue : VIOLET"));
        update(Map.of("preferences", Map.of("appearance", "SEPIA"))).andExpect(status().isBadRequest());
        update(Map.of("preferences", Map.of("blindtestSound", Map.of("enabled", true, "volume", 150))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("Le volume du blindtest va de 0 à 100."));
        update(Map.of("preferences", Map.of("blindtestSound", Map.of("volume", 20))))
                .andExpect(status().isBadRequest());
        update(Map.of("preferences", Map.of("titleComposition", List.of(
                Map.of("language", "FRENCH", "enabled", false),
                Map.of("language", "ROMAJI", "enabled", false),
                Map.of("language", "ENGLISH", "enabled", false)))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("Au moins une langue de titre doit rester cochée."));
        update(Map.of("preferences", Map.of("titleComposition", List.of(
                Map.of("language", "FRENCH", "enabled", true),
                Map.of("language", "FRENCH", "enabled", true),
                Map.of("language", "ENGLISH", "enabled", false)))))
                .andExpect(status().isBadRequest());

        mockMvc.perform(get("/api/auth/me")).andExpect(jsonPath("$.preferences.accent").doesNotExist());
    }

    @Test
    void a_refused_pseudo_saves_none_of_the_preferences_sent_with_it() throws Exception {
        update(Map.of("pseudo", "x", "preferences", Map.of("accent", "TERRACOTTA")))
                .andExpect(status().isBadRequest());

        mockMvc.perform(get("/api/auth/me"))
                .andExpect(jsonPath("$.pseudo").value("Test"))
                .andExpect(jsonPath("$.preferences.accent").doesNotExist());
    }
}
