package com.iozycore.domain.collectionshare;

import com.iozycore.domain.shared.DefaultOwner;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class CollectionShareSettingsTest {

    @Test
    void no_link_has_a_null_token_and_shares_nothing() {
        CollectionShareSettings settings = CollectionShareSettings.noLink();

        assertThat(settings.ownerId()).isEqualTo(DefaultOwner.ID);
        assertThat(settings.token()).isNull();
        assertThat(settings.hasLink()).isFalse();
        assertThat(settings.sharesTierLists()).isFalse();
    }

    @Test
    void a_new_link_never_shares_tier_lists_until_asked() {
        // Le choix le plus fermé au départ : un classement est un jugement
        // personnel, il ne part jamais avec la collection sans second geste.
        CollectionShareSettings settings = CollectionShareSettings.withNewToken();

        assertThat(settings.token()).isNotBlank();
        assertThat(settings.hasLink()).isTrue();
        assertThat(settings.includeTierLists()).isFalse();
        assertThat(settings.sharesTierLists()).isFalse();
    }

    @Test
    void toggling_tier_lists_keeps_the_link_already_distributed() {
        CollectionShareSettings withLink = CollectionShareSettings.withNewToken();

        CollectionShareSettings shared = withLink.withTierLists(true);

        assertThat(shared.token()).isEqualTo(withLink.token());
        assertThat(shared.sharesTierLists()).isTrue();
        assertThat(shared.withTierLists(false).sharesTierLists()).isFalse();
    }

    @Test
    void a_stale_tier_list_flag_exposes_nothing_once_the_link_is_gone() {
        // Cas défensif : une ligne restée à include_tier_lists = true alors que
        // le jeton a été supprimé ne doit rien exposer - "partage-t-il ses
        // classements" implique d'abord "partage-t-il quelque chose".
        CollectionShareSettings staleFlag = new CollectionShareSettings(DefaultOwner.ID, null, true);

        assertThat(staleFlag.hasLink()).isFalse();
        assertThat(staleFlag.sharesTierLists()).isFalse();
    }

    @Test
    void regenerating_produces_a_different_token_each_time() {
        assertThat(CollectionShareSettings.withNewToken().token())
                .isNotEqualTo(CollectionShareSettings.withNewToken().token());
    }
}
