package com.iozycore;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

// The only scheduled job: the nightly re-read of ongoing series for the release calendar
// (see MangaReleaseRefresh, batch 146). Can be turned off with iozycore.releases.refresh.enabled.
@EnableScheduling
@SpringBootApplication
public class IozyCoreApplication {

    public static void main(String[] args) {
        SpringApplication.run(IozyCoreApplication.class, args);
    }
}
