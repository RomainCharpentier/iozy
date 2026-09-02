package com.iozycore.api.version;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Quelle livraison tourne, en ce moment, sur ce serveur.
 *
 * <h2>Pourquoi cette route existe</h2>
 * Depuis que les mises à jour sont automatiques, plus personne ne sait de
 * mémoire ce qui est en ligne : on pousse, et quelque chose arrive cinq minutes
 * plus tard. Devant un comportement inattendu, la première question n'est plus
 * « qu'est-ce qui cloche ? » mais « est-ce que ma correction est seulement
 * déployée ? » - et sans réponse, on cherche un bug dans du code qui n'est pas
 * encore là.
 *
 * <h2>Un numéro de livraison, et pas le numéro du pom</h2>
 * {@code 0.1.0-SNAPSHOT} ne bouge jamais : il ne distingue pas deux
 * déploiements. Le numéro de livraison, lui, est un Majeure.Mineure.Patch
 * <b>déduit des messages de commit</b> au moment de la publication (la règle
 * vit dans {@code web/scripts/version.mjs}) — il croît, donc <b>il se
 * compare</b> : « serveur 1.2.0 » sous « version 1.3.1 » dit immédiatement
 * laquelle des deux images est en retard, ce qu'un SHA ne dira jamais. Et il
 * dit ce qui a changé : une mineure a ajouté, un patch a corrigé.
 *
 * <p>Ce même numéro étiquette l'image dans GHCR ({@code -api:v1.3.1}) et le
 * commit livré ({@code git show v1.3.1}). Un seul identifiant relie donc
 * l'écran, l'image et le commit.
 *
 * <h2>Authentifiée, comme presque tout le reste</h2>
 * Elle ne figure pas dans les exceptions de {@code SecurityConfig} : connaître
 * la version exacte d'un serveur est une information d'attaquant autant que
 * d'exploitant, et personne n'a besoin de la lire <b>avant</b> de se connecter.
 * Un invité, lui, la voit - il est authentifié au sens de la chaîne de
 * sécurité, et ce n'est pas un secret vis-à-vis de quelqu'un qu'on laisse déjà
 * parcourir la collection.
 */
@RestController
@RequestMapping("/api/version")
@Tag(name = "Version", description = "La livraison en cours d'exécution")
public class VersionController {

    private final String version;

    public VersionController(@Value("${iozycore.version:dev}") String version) {
        this.version = version;
    }

    /**
     * {@code version} vaut le numéro de la livraison en cours ({@code "1.3.1"}),
     * ou {@code dev} hors conteneur. C'est une chaîne et non un entier : elle
     * doit pouvoir porter {@code dev}, et le client ne fait que l'afficher et
     * la comparer à la sienne — jamais d'arithmétique dessus.
     */
    public record VersionReponse(String version) {
    }

    @Operation(summary = "Le numéro de la livraison en cours, ou « dev » hors conteneur.")
    @GetMapping
    public VersionReponse version() {
        return new VersionReponse(version);
    }
}
