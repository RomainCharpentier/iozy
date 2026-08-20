package com.iozycore.integration;

import com.iozycore.domain.collectionshare.CollectionShareSettings;
import com.iozycore.domain.collectionshare.CollectionShareSettingsRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.transaction.annotation.Transactional;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import static org.assertj.core.api.Assertions.assertThat;

/** Validates the CollectionShareSettings persistence module (Flyway V14 + JPA) against a real
 * PostgreSQL - mirrors WishlistShareSettingsPersistenceIntegrationTest, with the extra
 * "include tier lists" flag. */
@Testcontainers
@SpringBootTest
@Transactional
class CollectionShareSettingsPersistenceIntegrationTest {

    @Container
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine")
            .withDatabaseName("iozycore_test")
            .withUsername("iozycore")
            .withPassword("iozycore");

    @DynamicPropertySource
    static void configureDatasource(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
        registry.add("spring.datasource.username", POSTGRES::getUsername);
        registry.add("spring.datasource.password", POSTGRES::getPassword);
    }

    @Autowired
    private CollectionShareSettingsRepository repository;

    @Test
    void falls_back_to_no_link_before_any_save() {
        assertThat(repository.find().hasLink()).isFalse();
    }

    @Test
    void a_generated_token_can_be_reloaded_and_looked_up() {
        CollectionShareSettings saved = repository.save(CollectionShareSettings.withNewToken());

        assertThat(repository.find().token()).isEqualTo(saved.token());
        assertThat(repository.findByToken(saved.token())).isPresent();
    }

    @Test
    void the_tier_lists_flag_survives_a_reload_without_changing_the_token() {
        CollectionShareSettings withLink = repository.save(CollectionShareSettings.withNewToken());

        repository.save(withLink.withTierLists(true));

        CollectionShareSettings reloaded = repository.find();
        assertThat(reloaded.token()).isEqualTo(withLink.token());
        assertThat(reloaded.sharesTierLists()).isTrue();
    }

    @Test
    void removing_the_link_makes_the_previous_token_stop_resolving_and_shares_nothing() {
        CollectionShareSettings saved = repository.save(CollectionShareSettings.withNewToken().withTierLists(true));

        repository.save(CollectionShareSettings.noLink());

        assertThat(repository.findByToken(saved.token())).isEmpty();
        assertThat(repository.find().sharesTierLists()).isFalse();
    }

    @Test
    void a_blank_token_never_matches_the_row_of_a_removed_link() {
        // Le lien supprimé laisse une ligne avec token = null : chercher un jeton
        // vide ne doit surtout pas retomber dessus (voir la garde de l'adapter).
        repository.save(CollectionShareSettings.noLink());

        assertThat(repository.findByToken(null)).isEmpty();
        assertThat(repository.findByToken("  ")).isEmpty();
    }
}
