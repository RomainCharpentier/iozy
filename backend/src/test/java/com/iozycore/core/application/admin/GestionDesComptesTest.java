package com.iozycore.core.application.admin;

import com.iozycore.core.domain.user.AppUser;
import com.iozycore.core.domain.user.AppUserRepository;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import com.iozycore.manga.deals.Volume;

/**
 * <b>What an administrator can do, and what they cannot.</b>
 *
 * <p>Three rules, two of which protect the instance from its own
 * administrator:
 * <ul>
 *   <li>the list says what each account <b>weighs</b> - without that, deleting is
 *       a gamble;</li>
 *   <li><b>you do not delete yourself</b>: this guarantees that someone
 *       is always left to administer;</li>
 *   <li>the <b>data goes before the account</b> - the other way round, a
 *       failure between the two would leave rows belonging to an
 *       identifier that nobody carries anymore.</li>
 * </ul>
 */
class GestionDesComptesTest {

    private static final UUID PATRON = UUID.fromString("00000000-0000-0000-0000-000000000001");
    private static final UUID INVITE = UUID.fromString("00000000-0000-0000-0000-000000000002");

    /** An in-memory accounts table: these rules have nothing to do with SQL. */
    static class ComptesEnMemoire implements AppUserRepository {
        final Map<UUID, AppUser> parId = new LinkedHashMap<>();

        @Override
        public AppUser save(AppUser user) {
            parId.put(user.id(), user);
            return user;
        }

        @Override
        public Optional<AppUser> findByEmail(String email) {
            return parId.values().stream().filter(u -> u.email().equals(AppUser.normaliserEmail(email))).findFirst();
        }

        @Override
        public Optional<AppUser> findByPseudo(String pseudo) {
            return parId.values().stream()
                    .filter(u -> AppUser.normaliserPseudo(u.pseudo()).equals(AppUser.normaliserPseudo(pseudo)))
                    .findFirst();
        }

        @Override
        public Optional<AppUser> findById(UUID id) {
            return Optional.ofNullable(parId.get(id));
        }

        @Override
        public List<AppUser> lister() {
            return List.copyOf(parId.values());
        }

        @Override
        public void supprimer(UUID id) {
            parId.remove(id);
        }

        @Override
        public boolean isEmpty() {
            return parId.isEmpty();
        }
    }

    /** Records the ORDER of the actions: it is half of what this service guarantees. */
    static class DonneesEnMemoire implements DonneesParProprietaire {
        final Map<UUID, Volume> volumes = new HashMap<>();
        final List<String> gestes = new ArrayList<>();

        @Override
        public Map<UUID, Volume> compter() {
            return volumes;
        }

        @Override
        public void effacerToutCeQuiAppartientA(UUID proprietaire) {
            gestes.add("données " + proprietaire);
        }
    }

    private final ComptesEnMemoire comptes = new ComptesEnMemoire();
    private final DonneesEnMemoire donnees = new DonneesEnMemoire();
    private final GestionDesComptes gestion = new GestionDesComptes(comptes, donnees);

    private AppUser poser(UUID id, String pseudo, boolean admin) {
        AppUser compte = new AppUser(id, pseudo + "@example.com", "hache", pseudo, admin, Instant.now());
        return comptes.save(compte);
    }

    @Test
    void la_liste_dit_ce_que_chaque_compte_pese() {
        poser(PATRON, "patron", true);
        poser(INVITE, "invite", false);
        donnees.volumes.put(INVITE, new DonneesParProprietaire.Volume(412, 7, 30, 2, 5));

        List<GestionDesComptes.CompteAdministre> liste = gestion.lister();

        assertThat(liste).hasSize(2);
        assertThat(liste.get(0).pseudo()).isEqualTo("patron");
        assertThat(liste.get(0).admin()).isTrue();
        // An account without data is not an unknown account: it weighs zero.
        assertThat(liste.get(0).volume()).isEqualTo(DonneesParProprietaire.Volume.AUCUN);
        assertThat(liste.get(1).volume().possessions()).isEqualTo(412);
        assertThat(liste.get(1).volume().total()).isEqualTo(456);
    }

    @Test
    void supprimer_efface_les_donnees_puis_le_compte() {
        poser(PATRON, "patron", true);
        poser(INVITE, "invite", false);

        gestion.supprimer(INVITE, PATRON);

        assertThat(donnees.gestes).containsExactly("données " + INVITE);
        assertThat(comptes.findById(INVITE)).isEmpty();
        assertThat(comptes.findById(PATRON)).isPresent();
    }

    @Test
    void un_administrateur_ne_peut_pas_supprimer_son_propre_compte() {
        poser(PATRON, "patron", true);

        assertThatThrownBy(() -> gestion.supprimer(PATRON, PATRON))
                .isInstanceOf(GestionDesComptes.SuppressionRefusee.class)
                .hasMessageContaining("son propre compte");
        // And nothing was touched: the refusal happens BEFORE the first deletion.
        assertThat(donnees.gestes).isEmpty();
        assertThat(comptes.findById(PATRON)).isPresent();
    }

    @Test
    void supprimer_un_compte_qui_n_existe_pas_ne_detruit_rien() {
        poser(PATRON, "patron", true);

        assertThatThrownBy(() -> gestion.supprimer(INVITE, PATRON))
                .isInstanceOf(GestionDesComptes.CompteIntrouvable.class);
        assertThat(donnees.gestes).isEmpty();
    }
}
