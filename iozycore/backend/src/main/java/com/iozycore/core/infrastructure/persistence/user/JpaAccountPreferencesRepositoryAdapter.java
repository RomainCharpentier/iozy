package com.iozycore.core.infrastructure.persistence.user;

import com.iozycore.core.domain.user.AccountPreferences;
import com.iozycore.core.domain.user.AccountPreferences.Accent;
import com.iozycore.core.domain.user.AccountPreferences.Appearance;
import com.iozycore.core.domain.user.AccountPreferences.BlindtestSound;
import com.iozycore.core.domain.user.AccountPreferencesRepository;
import com.iozycore.core.infrastructure.multitenance.ProprietaireCourant;
import lombok.RequiredArgsConstructor;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

interface AccountPreferencesJpaRepository extends JpaRepository<AccountPreferencesJpaEntity, UUID> {

    // A derived query, so filtered by owner - never findById (loads by key, unfiltered).
    Optional<AccountPreferencesJpaEntity> findFirstByOrderByUpdatedAtDesc();

    /**
     * Insert or update in one statement: two first saves at once (two tabs,
     * or IozyCore and IozyTest) would otherwise fail on the unique owner.
     * Native SQL, so the owner is passed by hand: {@code @TenantId} does not
     * apply here.
     */
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query(value = """
            INSERT INTO account_preferences (id, owner_id, accent, appearance, title_composition,
                                             blindtest_sound_enabled, blindtest_sound_volume, updated_at)
            VALUES (:id, :ownerId, :accent, :appearance, :titleComposition, :soundEnabled, :soundVolume, :updatedAt)
            ON CONFLICT (owner_id)
            DO UPDATE SET accent = EXCLUDED.accent, appearance = EXCLUDED.appearance,
                          title_composition = EXCLUDED.title_composition,
                          blindtest_sound_enabled = EXCLUDED.blindtest_sound_enabled,
                          blindtest_sound_volume = EXCLUDED.blindtest_sound_volume,
                          updated_at = EXCLUDED.updated_at
            """, nativeQuery = true)
    void upsert(@Param("id") UUID id, @Param("ownerId") UUID ownerId, @Param("accent") String accent,
                @Param("appearance") String appearance, @Param("titleComposition") String titleComposition,
                @Param("soundEnabled") Boolean soundEnabled, @Param("soundVolume") Short soundVolume,
                @Param("updatedAt") Instant updatedAt);
}

@Repository
@Transactional
@RequiredArgsConstructor
class JpaAccountPreferencesRepositoryAdapter implements AccountPreferencesRepository {

    private final AccountPreferencesJpaRepository jpaRepository;
    private final ProprietaireCourant owner;

    @Override
    public AccountPreferences find() {
        return jpaRepository.findFirstByOrderByUpdatedAtDesc()
                .map(JpaAccountPreferencesRepositoryAdapter::toDomain)
                .orElse(AccountPreferences.NONE);
    }

    @Override
    public AccountPreferences save(AccountPreferences preferences) {
        BlindtestSound sound = preferences.blindtestSound();
        jpaRepository.upsert(UUID.randomUUID(), owner.resolveCurrentTenantIdentifier(),
                preferences.accent() == null ? null : preferences.accent().name(),
                preferences.appearance() == null ? null : preferences.appearance().name(),
                AccountPreferences.encodeComposition(preferences.titleComposition()),
                sound == null ? null : sound.enabled(),
                sound == null ? null : (short) sound.volume(),
                Instant.now());
        return find();
    }

    private static AccountPreferences toDomain(AccountPreferencesJpaEntity jpa) {
        BlindtestSound sound = jpa.getBlindtestSoundEnabled() == null || jpa.getBlindtestSoundVolume() == null
                ? null
                : new BlindtestSound(jpa.getBlindtestSoundEnabled(), jpa.getBlindtestSoundVolume());
        return new AccountPreferences(
                jpa.getAccent() == null ? null : Accent.parse(jpa.getAccent()),
                jpa.getAppearance() == null ? null : Appearance.parse(jpa.getAppearance()),
                AccountPreferences.decodeComposition(jpa.getTitleComposition()),
                sound);
    }
}
