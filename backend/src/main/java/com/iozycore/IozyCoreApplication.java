package com.iozycore;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

// Le seul travail planifié : la relecture nocturne des séries en cours pour le calendrier des sorties
// (voir MangaReleaseRefresh, lot 146). Désactivable par iozycore.releases.refresh.enabled.
@EnableScheduling
@SpringBootApplication
public class IozyCoreApplication {

    public static void main(String[] args) {
        SpringApplication.run(IozyCoreApplication.class, args);
    }
}
