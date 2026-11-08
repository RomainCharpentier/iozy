package com.iozycore.core.application;

import com.iozycore.core.domain.catalog.Entity;
import com.iozycore.core.domain.catalog.EntityRepository;
import com.iozycore.core.domain.catalog.EntityType;
import com.iozycore.core.domain.catalog.EntityTypeRepository;
import com.iozycore.core.metadata.MetadataDetailsService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

/**
 * Fills the publisher (and, for video games, the consoles) of the works
 * added before the shelves were arranged by publisher, by itself.
 *
 * <h2>Why a job, when a button already exists</h2>
 * Works added before batch 203 kept no {@code publisher}, and video games no
 * {@code platforms}: their room says "Éditeur inconnu" and a game cannot be
 * shelved by console. "Compléter les éditeurs" (Ma collection) fixes it, but
 * nobody presses such buttons - the lesson of the cover backfill (see
 * MangaCoverBackfill in the manga module). The catalogue now does the same
 * work on its own, a little after each start and then every hour, as long
 * as works miss these keys.
 *
 * <h2>The same rules as the button</h2>
 * A work is asked only when it has its source id (see
 * {@link ShelfDetailsSource}) and misses one of the shelf keys. Only the
 * missing keys are written, and as a source: a key typed by hand is never
 * overwritten, nor written again after the user removed it (the rule of
 * {@link Entity#recopierDepuisLaSource}, the one behind the PATCH with
 * {@code origine=source}).
 *
 * <h2>Gentle with the providers</h2>
 * A bounded number of works per run, a pause between two calls, and a type
 * stops at its first silent provider, after keeping what it got: the next
 * run picks up there. A work whose provider answered without the key is not
 * asked again until the next start, so that a few games IGDB knows no
 * publisher for do not take the whole budget of every run. The catalogue is
 * shared, so this runs outside any session.
 */
@Component
@Slf4j
public class ShelfDetailsBackfill {

    private final EntityTypeRepository entityTypeRepository;
    private final EntityRepository entityRepository;
    private final MetadataDetailsService metadataDetailsService;
    private final List<ShelfDetailsSource> sources;
    private final boolean enabled;
    private final int worksPerRun;
    private final Duration pause;
    private final Set<UUID> answeredWithout = new HashSet<>();

    @Autowired
    public ShelfDetailsBackfill(EntityTypeRepository entityTypeRepository, EntityRepository entityRepository,
                                MetadataDetailsService metadataDetailsService, List<ShelfDetailsSource> sources,
                                @Value("${iozycore.shelf-details.backfill.enabled:true}") boolean enabled,
                                @Value("${iozycore.shelf-details.backfill.works-per-run:40}") int worksPerRun,
                                @Value("${iozycore.shelf-details.backfill.pause-ms:1000}") long pauseMs) {
        this(entityTypeRepository, entityRepository, metadataDetailsService, sources, enabled, worksPerRun,
                Duration.ofMillis(pauseMs));
    }

    ShelfDetailsBackfill(EntityTypeRepository entityTypeRepository, EntityRepository entityRepository,
                         MetadataDetailsService metadataDetailsService, List<ShelfDetailsSource> sources,
                         boolean enabled, int worksPerRun, Duration pause) {
        this.entityTypeRepository = entityTypeRepository;
        this.entityRepository = entityRepository;
        this.metadataDetailsService = metadataDetailsService;
        this.sources = sources;
        this.enabled = enabled;
        this.worksPerRun = worksPerRun;
        this.pause = pause;
    }

    /** What one run did. */
    public record Result(int worksAsked, int worksCompleted, boolean stoppedOnUnavailable) {
    }

    /** A little after each start, then every hour. With nothing missing, a
     *  run is one database read per type (see application.yml). */
    @Scheduled(initialDelayString = "${iozycore.shelf-details.backfill.initial-delay-ms:180000}",
               fixedDelayString = "${iozycore.shelf-details.backfill.every-ms:3600000}")
    public void scheduled() {
        if (!enabled) {
            return;
        }
        try {
            Result result = run();
            log.info("Shelf details backfill: {} works asked, {} completed{}", result.worksAsked(),
                    result.worksCompleted(), result.stoppedOnUnavailable() ? ", stopped on a silent provider" : "");
        } catch (RuntimeException e) {
            // A background job must never take the application down with it.
            log.warn("Shelf details backfill failed: {}", e.getMessage());
        }
    }

    public synchronized Result run() {
        int asked = 0;
        int completed = 0;
        boolean stopped = false;
        for (ShelfDetailsSource source : sources) {
            Optional<EntityType> found = entityTypeRepository.findByCode(source.entityTypeCode());
            if (found.isEmpty()) {
                continue;
            }
            EntityType type = found.get();
            for (Entity entity : entityRepository.findAllByType(type.id())) {
                String sourceId = textOf(entity, source.sourceIdKey());
                List<String> missing = missingKeys(entity, source.shelfKeys());
                if (sourceId == null || missing.isEmpty() || answeredWithout.contains(entity.id())) {
                    continue;
                }
                if (asked >= worksPerRun) {
                    return new Result(asked, completed, stopped);
                }
                if (asked > 0) {
                    attendre();
                }
                asked++;
                MetadataDetailsService.Answer answer = metadataDetailsService.ask(type,
                        Map.of(source.sourceIdKey(), sourceId));
                Map<String, Object> toWrite = new LinkedHashMap<>();
                for (String key : missing) {
                    Object value = answer.details().get(key);
                    if (value instanceof String text && !text.isBlank()) {
                        toWrite.put(key, text);
                    }
                }
                if (!toWrite.isEmpty() && write(entity.id(), toWrite)) {
                    completed++;
                }
                if (answer.sourceUnavailable()) {
                    // The rest of this type waits for the next run rather
                    // than hammering a provider that stopped answering.
                    stopped = true;
                    break;
                }
                if (toWrite.size() < missing.size()) {
                    answeredWithout.add(entity.id());
                }
            }
        }
        return new Result(asked, completed, stopped);
    }

    /**
     * Writes as a source on a fresh read of the work: the list was read at
     * the start of the run, minutes ago, and saving that copy would undo
     * what the user changed meanwhile. Only the keys still missing are kept.
     */
    private boolean write(UUID entityId, Map<String, Object> fromSource) {
        Optional<Entity> fresh = entityRepository.findById(entityId);
        if (fresh.isEmpty()) {
            return false;
        }
        Entity entity = fresh.get();
        Map<String, Object> stillMissing = new LinkedHashMap<>(fromSource);
        stillMissing.keySet().retainAll(missingKeys(entity, List.copyOf(fromSource.keySet())));
        if (stillMissing.isEmpty() || entity.recopierDepuisLaSource(stillMissing).isEmpty()) {
            return false;
        }
        entityRepository.save(entity);
        return true;
    }

    /** The shelf keys without a value and not typed by hand (a key the user removed stays removed). */
    static List<String> missingKeys(Entity entity, List<String> shelfKeys) {
        return shelfKeys.stream()
                .filter(key -> !entity.champsSaisis().contains(key))
                .filter(key -> isBlank(entity.attributes().get(key)))
                .toList();
    }

    private static boolean isBlank(Object value) {
        return value == null || value instanceof String text && text.isBlank();
    }

    private static String textOf(Entity entity, String key) {
        Object value = entity.attributes().get(key);
        if (value == null) {
            return null;
        }
        String text = value.toString().trim();
        return text.isEmpty() ? null : text;
    }

    private void attendre() {
        try {
            Thread.sleep(pause.toMillis());
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }
}
