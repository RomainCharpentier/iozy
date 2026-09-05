package com.iozycore.application.admin;

import com.iozycore.domain.user.AppUser;
import com.iozycore.domain.user.AppUserRepository;
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
 * <b>Ce qu'un administrateur peut faire, et ce qu'il ne peut pas.</b>
 *
 * <p>Trois règles, dont deux protègent l'instance de son propre
 * administrateur :
 * <ul>
 *   <li>la liste dit ce que chaque compte <b>pèse</b> - sans ça, supprimer est
 *       un pari ;</li>
 *   <li><b>on ne se supprime pas soi-même</b> : c'est ce qui garantit qu'il
 *       reste toujours quelqu'un pour administrer ;</li>
 *   <li>les <b>données partent avant le compte</b> - dans l'autre sens, un
 *       échec entre les deux laisserait des lignes appartenant à un
 *       identifiant que plus personne ne porte.</li>
 * </ul>
 */
class GestionDesComptesTest {

    private static final UUID PATRON = UUID.fromString("00000000-0000-0000-0000-000000000001");
    private static final UUID INVITE = UUID.fromString("00000000-0000-0000-0000-000000000002");

    /** Une table de comptes en mémoire : ces règles n'ont rien à voir avec SQL. */
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

    /** Note l'ORDRE des gestes : c'est la moitié de ce que ce service garantit. */
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
        // Un compte sans données n'est pas un compte inconnu : il pèse zéro.
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
        // Et rien n'a été touché : le refus tombe AVANT le premier effacement.
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
