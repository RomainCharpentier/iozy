package com.iozycore.integration;

import com.iozycore.domain.wishlist.WishlistShareSettings;
import com.iozycore.domain.wishlist.WishlistShareSettingsRepository;
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

/** Validates the WishlistShareSettings persistence module (Flyway V7 + JPA) against a real PostgreSQL - mirrors LoanPersistenceIntegrationTest. */
@Testcontainers
@SpringBootTest
@Transactional
class WishlistShareSettingsPersistenceIntegrationTest {

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
    private WishlistShareSettingsRepository shareSettingsRepository;

    @Test
    void falls_back_to_no_link_before_any_save() {
        WishlistShareSettings settings = shareSettingsRepository.find();

        assertThat(settings.hasLink()).isFalse();
    }

    @Test
    void a_generated_token_can_be_found_reloaded_and_looked_up_by_token() {
        WishlistShareSettings saved = shareSettingsRepository.save(WishlistShareSettings.withNewToken());

        assertThat(shareSettingsRepository.find().token()).isEqualTo(saved.token());
        assertThat(shareSettingsRepository.findByToken(saved.token())).isPresent();
    }

    @Test
    void regenerating_the_link_makes_the_previous_token_stop_resolving() {
        WishlistShareSettings first = shareSettingsRepository.save(WishlistShareSettings.withNewToken());
        WishlistShareSettings second = shareSettingsRepository.save(WishlistShareSettings.withNewToken());

        assertThat(shareSettingsRepository.findByToken(first.token())).isEmpty();
        assertThat(shareSettingsRepository.findByToken(second.token())).isPresent();
    }

    @Test
    void removing_the_link_makes_its_token_stop_resolving() {
        WishlistShareSettings generated = shareSettingsRepository.save(WishlistShareSettings.withNewToken());

        shareSettingsRepository.save(WishlistShareSettings.noLink());

        assertThat(shareSettingsRepository.find().hasLink()).isFalse();
        assertThat(shareSettingsRepository.findByToken(generated.token())).isEmpty();
    }

    @Test
    void an_unknown_or_blank_token_never_resolves() {
        assertThat(shareSettingsRepository.findByToken("does-not-exist")).isEmpty();
        assertThat(shareSettingsRepository.findByToken(null)).isEmpty();
        assertThat(shareSettingsRepository.findByToken("")).isEmpty();
    }
}
