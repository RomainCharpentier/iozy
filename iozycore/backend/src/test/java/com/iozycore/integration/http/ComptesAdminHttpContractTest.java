package com.iozycore.integration.http;

import com.iozycore.core.domain.user.AppUser;
import com.iozycore.core.domain.user.AppUserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.util.UUID;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * <b>The administration door.</b>
 *
 * <p>What these routes offer - the list of the accounts, and the permanent
 * deletion of one of them - has no equivalent elsewhere in the application:
 * everywhere, an account only sees its data; here, someone sees that the
 * others exist, and can make them disappear.
 *
 * <p>The refusal given to an ordinary account is therefore <b>the</b> thing to check,
 * and it breaks silently: a rule declared after {@code anyRequest()},
 * a {@code @RequestMapping} that slips out of {@code /api/admin}, and
 * any connected account can list - then delete - everyone.
 * Nothing on the screen would change.
 */
class ComptesAdminHttpContractTest extends HttpContractTestBase {

    @Autowired
    private AppUserRepository comptes;

    @Test
    void un_compte_ordinaire_est_refuse_en_403() throws Exception {
        // The default identity of this suite is NOT an administrator: this
        // test knocks exactly like the hundreds of others.
        mockMvc.perform(get("/api/admin/comptes")).andExpect(status().isForbidden());
        mockMvc.perform(delete("/api/admin/comptes/" + ABSENT)).andExpect(status().isForbidden());
    }

    /**
     * A REAL account in the database.
     * <p>
     * The identity that signs these requests is a made-up principal, not a
     * row: without this seed, the accounts table is empty and the list would
     * prove nothing. Rolled back with the transaction of the test.
     */
    private AppUser unCompte() {
        String pseudo = "invite" + UUID.randomUUID().toString().substring(0, 8);
        return comptes.save(AppUser.nouveau(pseudo + "@example.com", "hache", pseudo));
    }

    @Test
    void un_administrateur_voit_la_liste_et_ce_que_chaque_compte_pese() throws Exception {
        AppUser invite = unCompte();

        mockMvc.perform(get("/api/admin/comptes").with(user(IDENTITE_ADMIN)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.id=='" + invite.id() + "')].pseudo").value(invite.pseudo()))
                .andExpect(jsonPath("$[?(@.id=='" + invite.id() + "')].email").value(invite.email()))
                .andExpect(jsonPath("$[?(@.id=='" + invite.id() + "')].admin").value(false))
                .andExpect(jsonPath("$[?(@.id=='" + invite.id() + "')].creeLe").exists())
                // A new account owns nothing - and it is a ZERO, not an
                // absence: it is this number that tells the administrator what they
                // would destroy.
                .andExpect(jsonPath("$[?(@.id=='" + invite.id() + "')].volume.total").value(0));
    }

    @Test
    void la_liste_ne_rend_jamais_un_hachage_de_mot_de_passe() throws Exception {
        // The response record does not carry it; this test exists for the day when
        // someone returns `AppUser` directly, which would work.
        unCompte();

        mockMvc.perform(get("/api/admin/comptes").with(user(IDENTITE_ADMIN)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].passwordHash").doesNotExist())
                .andExpect(jsonPath("$[0].motDePasseHache").doesNotExist());
    }

    @Test
    void un_administrateur_ne_peut_pas_supprimer_son_propre_compte() throws Exception {
        mockMvc.perform(delete("/api/admin/comptes/" + IDENTITE_ADMIN.id()).with(user(IDENTITE_ADMIN)))
                .andExpect(status().isConflict());
    }

    @Test
    void supprimer_un_compte_inconnu_repond_404() throws Exception {
        mockMvc.perform(delete("/api/admin/comptes/" + ABSENT).with(user(IDENTITE_ADMIN)))
                .andExpect(status().isNotFound());
    }

    @Test
    void un_identifiant_malforme_ne_part_jamais_en_500() throws Exception {
        mockMvc.perform(delete("/api/admin/comptes/" + MALFORME).with(user(IDENTITE_ADMIN)))
                .andExpect(status().isBadRequest());
    }

    @Test
    void supprimer_un_autre_compte_le_retire_vraiment() throws Exception {
        AppUser invite = unCompte();

        mockMvc.perform(delete("/api/admin/comptes/" + invite.id()).with(user(IDENTITE_ADMIN)))
                .andExpect(status().isNoContent());

        // And it does not come back: a deletion that answers 204 without erasing
        // reads exactly like a successful deletion.
        mockMvc.perform(delete("/api/admin/comptes/" + invite.id()).with(user(IDENTITE_ADMIN)))
                .andExpect(status().isNotFound());
    }
}
