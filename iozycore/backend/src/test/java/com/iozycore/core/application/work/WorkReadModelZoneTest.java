package com.iozycore.core.application.work;

import com.iozycore.integration.PostgresIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.time.ZoneId;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The real bean reads "this month" in the collector's zone, not in the zone of
 * the server: the test JVM runs in UTC, like the Docker image.
 */
class WorkReadModelZoneTest extends PostgresIntegrationTest {

    @Autowired private WorkReadModel works;

    @Test
    void the_calendar_is_the_collector_zone_from_the_configuration() {
        assertThat(works.collectorZone()).isEqualTo(ZoneId.of("Europe/Paris"));
    }
}
