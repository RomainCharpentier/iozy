package com.iozycore.integration.http;

import com.iozycore.domain.user.AppUser;
import com.iozycore.domain.user.AppUserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.util.UUID;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * <b>La porte de l'administration.</b>
 *
 * <p>Ce que ces routes offrent — la liste des comptes, et la suppression
 * définitive de l'un d'eux — n'a pas d'équivalent ailleurs dans l'application :
 * partout, un compte ne voit que ses données ; ici, quelqu'un voit que les
 * autres existent, et peut les faire disparaître.
 *
 * <p>Le refus opposé à un compte ordinaire est donc <b>la</b> chose à vérifier,
 * et elle se casse en silence : une règle déclarée après {@code anyRequest()},
 * un {@code @RequestMapping} qui glisse hors de {@code /api/admin}, et
 * n'importe quel compte connecté peut lister — puis supprimer — tout le monde.
 * Rien à l'écran ne changerait.
 */
class ComptesAdminHttpContractTest extends HttpContractTestBase {

    @Autowired
    private AppUserRepository comptes;

    @Test
    void un_compte_ordinaire_est_refuse_en_403() throws Exception {
        // L'identité par défaut de cette suite n'est PAS administratrice : ce
        // test frappe exactement comme les centaines d'autres.
        mockMvc.perform(get("/api/admin/comptes")).andExpect(status().isForbidden());
        mockMvc.perform(delete("/api/admin/comptes/" + ABSENT)).andExpect(status().isForbidden());
    }

    /**
     * Un compte RÉEL en base.
     * <p>
     * L'identité qui signe ces requêtes est un principal fabriqué, pas une
     * ligne : sans ce semis, la table des comptes est vide et la liste ne
     * prouverait rien. Annulé avec la transaction du test.
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
                // Un compte neuf ne possède rien - et c'est un ZÉRO, pas une
                // absence : c'est ce nombre qui dit à l'administrateur ce qu'il
                // détruirait.
                .andExpect(jsonPath("$[?(@.id=='" + invite.id() + "')].volume.total").value(0));
    }

    @Test
    void la_liste_ne_rend_jamais_un_hachage_de_mot_de_passe() throws Exception {
        // Le record de réponse ne le porte pas ; ce test existe pour le jour où
        // quelqu'un rendra `AppUser` directement, ce qui marcherait.
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

        // Et il ne revient pas : une suppression qui répond 204 sans effacer se
        // lit exactement comme une suppression réussie.
        mockMvc.perform(delete("/api/admin/comptes/" + invite.id()).with(user(IDENTITE_ADMIN)))
                .andExpect(status().isNotFound());
    }
}
