package com.iozycore.manga.shelfimport;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Un tome que l'utilisateur a confirmé depuis l'écran de vérification.
 *
 * <p>Le serveur ne garde rien entre l'analyse et l'import : c'est l'écran qui
 * renvoie, pour chaque tome, ce qu'il a montré - le titre retenu, le numéro
 * (lu ou saisi), l'édition choisie, et les attributs de la fiche proposée si
 * l'utilisateur l'a gardée. Même contrat que l'ajout rapide du Catalogue.
 *
 * @param seriesTitle   le titre sous lequel la série est retrouvée ou créée
 * @param volumeNumber  le numéro du tome, supérieur ou égal à 1
 * @param edition       l'édition, ou {@code null}/vide quand elle n'est pas connue
 * @param attributes    les attributs de la fiche source (auteur, année...) - vide si aucune
 * @param coverImageUrl la jaquette de la série proposée par la source, ou {@code null}
 */
public record ItemToImport(String seriesTitle, int volumeNumber, String edition,
                           Map<String, Object> attributes, String coverImageUrl) {

    public static final String COVER_IMAGE_ATTRIBUTE = "coverImageUrl";

    public ItemToImport {
        if (seriesTitle == null || seriesTitle.isBlank()) {
            throw new IllegalArgumentException("Le titre de la série est requis");
        }
        if (volumeNumber < 1) {
            throw new IllegalArgumentException("Le numéro de tome doit être supérieur ou égal à 1");
        }
        attributes = attributes == null ? Map.of() : Map.copyOf(attributes);
    }

    String editionOrNull() {
        return edition == null || edition.isBlank() ? null : edition.trim();
    }

    /**
     * Les attributs à poser sur la série : ceux de la fiche, plus la jaquette
     * sous la clé que le Catalogue et le scan utilisent déjà. Une clé déjà
     * présente dans les attributs n'est pas écrasée par la jaquette.
     */
    Map<String, Object> attributesForEntity() {
        Map<String, Object> resultat = new LinkedHashMap<>(attributes);
        if (coverImageUrl != null && !coverImageUrl.isBlank()) {
            resultat.putIfAbsent(COVER_IMAGE_ATTRIBUTE, coverImageUrl.trim());
        }
        return resultat;
    }
}
