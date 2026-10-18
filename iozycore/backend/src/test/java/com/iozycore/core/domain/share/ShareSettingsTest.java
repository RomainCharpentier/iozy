package com.iozycore.core.domain.share;

import com.iozycore.core.domain.shared.DefaultOwner;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * The rules of space sharing: one link, sections, and two invariants
 * that must never give way - an inactive link exposes nothing, an active link
 * exposes at least something.
 *
 */
class ShareSettingsTest {

    @Test
    void sans_lien_rien_n_est_partage_meme_si_les_sections_sont_a_vrai() {
        ShareSettings settings = ShareSettings.noLink(DefaultOwner.ID);

        assertThat(settings.hasLink()).isFalse();
        assertThat(settings.token()).isNull();
        // The flags are true (this will be the state of the next link created) but
        // none exposes anything as long as no token exists: without
        // this rule, a forgotten row in the database would open an access.
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
        // A ranking is a personal judgment, not an inventory: it never
        // leaves with the rest without having been asked for separately.
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

        // A link that exposes nothing is not a discreet share, it is an
        // active URL to an empty page: the invariant lives in the domain, not
        // only in a form.
        assertThatThrownBy(() -> settings.withSections(false, false))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void sans_lien_actif_avoir_les_deux_sections_a_faux_reste_permis() {
        // Nothing is exposed anyway: forbidding this state would prevent
        // simply deleting the link.
        assertThatCode(() -> new ShareSettings(DefaultOwner.ID, null, false, false, false))
                .doesNotThrowAnyException();
    }

    @Test
    void les_classements_ne_sortent_jamais_sans_la_collection() {
        ShareSettings avecClassements = ShareSettings.withNewToken(DefaultOwner.ID).withTierLists(true);
        assertThat(avecClassements.sharesTierLists()).isTrue();

        ShareSettings enviesSeules = avecClassements.withSections(false, true);

        // Rankings go with the collection: removing it removes them
        // too, without having to remember to untick a second box.
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
        // Regenerating must really invalidate the old link - a reused token
        // would let the old recipient in.
        assertThat(ShareSettings.withNewToken(DefaultOwner.ID).token())
                .isNotEqualTo(ShareSettings.withNewToken(DefaultOwner.ID).token());
    }

    @Test
    void le_jeton_n_est_ni_sequentiel_ni_derive_de_l_identifiant_du_proprietaire() {
        String token = ShareSettings.withNewToken(DefaultOwner.ID).token();

        // A guessable token (/share/1, /share/2...) or one derived from the owner
        // would make the "private link" enumerable.
        assertThat(token).hasSize(36).doesNotContain(DefaultOwner.ID.toString());
        assertThat(token).doesNotMatch("^[0-9]+$");
    }




}
