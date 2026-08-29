package com.iozycore.domain.share;

import com.iozycore.domain.shared.DefaultOwner;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Les règles du partage d'espace : un lien, des sections, et deux invariants
 * qui ne doivent jamais céder - un lien inactif n'expose rien, un lien actif
 * expose au moins quelque chose.
 */
class ShareSettingsTest {

    @Test
    void sans_lien_rien_n_est_partage_meme_si_les_sections_sont_a_vrai() {
        ShareSettings settings = ShareSettings.noLink(DefaultOwner.ID);

        assertThat(settings.hasLink()).isFalse();
        assertThat(settings.token()).isNull();
        // Les drapeaux valent vrai (ce sera l'état du prochain lien créé) mais
        // aucun n'expose quoi que ce soit tant qu'aucun jeton n'existe : sans
        // cette règle, une ligne oubliée en base ouvrirait un accès.
        assertThat(settings.sharesCollection()).isFalse();
        assertThat(settings.sharesWishlist()).isFalse();
        assertThat(settings.sharesTierLists()).isFalse();
    }

    @Test
    void un_lien_neuf_expose_les_deux_sections_et_exclut_les_classements() {
        ShareSettings settings = ShareSettings.withNewToken(DefaultOwner.ID);

        assertThat(settings.hasLink()).isTrue();
        assertThat(settings.sharesCollection()).isTrue();
        assertThat(settings.sharesWishlist()).isTrue();
        // Un classement est un jugement personnel, pas un inventaire : il ne
        // part jamais avec le reste sans avoir été demandé à part.
        assertThat(settings.includeTierLists()).isFalse();
        assertThat(settings.sharesTierLists()).isFalse();
    }

    @Test
    void changer_les_sections_ne_touche_pas_au_jeton_deja_distribue() {
        ShareSettings initial = ShareSettings.withNewToken(DefaultOwner.ID);

        ShareSettings enviesSeules = initial.withSections(false, true);

        assertThat(enviesSeules.token()).isEqualTo(initial.token());
        assertThat(enviesSeules.sharesCollection()).isFalse();
        assertThat(enviesSeules.sharesWishlist()).isTrue();
    }

    @Test
    void un_lien_actif_ne_peut_pas_tout_decocher() {
        ShareSettings settings = ShareSettings.withNewToken(DefaultOwner.ID);

        // Un lien qui n'expose rien n'est pas un partage discret, c'est une URL
        // active vers une page vide : l'invariant vit dans le domaine, pas
        // seulement dans un formulaire.
        assertThatThrownBy(() -> settings.withSections(false, false))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void sans_lien_actif_avoir_les_deux_sections_a_faux_reste_permis() {
        // Rien n'est exposé de toute façon : interdire cet état empêcherait de
        // simplement supprimer le lien.
        assertThatCode(() -> new ShareSettings(DefaultOwner.ID, null, false, false, false))
                .doesNotThrowAnyException();
    }

    @Test
    void les_classements_ne_sortent_jamais_sans_la_collection() {
        ShareSettings avecClassements = ShareSettings.withNewToken(DefaultOwner.ID).withTierLists(true);
        assertThat(avecClassements.sharesTierLists()).isTrue();

        ShareSettings enviesSeules = avecClassements.withSections(false, true);

        // Les classements accompagnent la collection : la retirer les retire
        // aussi, sans avoir à penser à décocher une seconde case.
        assertThat(enviesSeules.includeTierLists()).isTrue();
        assertThat(enviesSeules.sharesTierLists()).isFalse();
    }

    @Test
    void basculer_les_classements_ne_touche_pas_au_jeton() {
        ShareSettings initial = ShareSettings.withNewToken(DefaultOwner.ID);

        assertThat(initial.withTierLists(true).token()).isEqualTo(initial.token());
    }

    @Test
    void deux_liens_successifs_ne_portent_jamais_le_meme_jeton() {
        // Régénérer doit réellement invalider l'ancien lien - un jeton
        // reconduit laisserait l'ancien destinataire entrer.
        assertThat(ShareSettings.withNewToken(DefaultOwner.ID).token())
                .isNotEqualTo(ShareSettings.withNewToken(DefaultOwner.ID).token());
    }

    @Test
    void le_jeton_n_est_ni_sequentiel_ni_derive_de_l_identifiant_du_proprietaire() {
        String token = ShareSettings.withNewToken(DefaultOwner.ID).token();

        // Un jeton devinable (/share/1, /share/2…) ou dérivé du propriétaire
        // rendrait le « lien privé » énumérable.
        assertThat(token).hasSize(36).doesNotContain(DefaultOwner.ID.toString());
        assertThat(token).doesNotMatch("^[0-9]+$");
    }
}
