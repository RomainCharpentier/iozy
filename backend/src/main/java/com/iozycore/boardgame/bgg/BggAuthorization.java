package com.iozycore.boardgame.bgg;

import java.net.http.HttpRequest;

/**
 * Depuis juillet 2025, BGG exige un enregistrement d'application et un
 * token Bearer pour la quasi-totalité de son API XML (voir
 * https://boardgamegeek.com/using_the_xml_api) - la seule exception
 * documentée est le téléchargement de sa PROPRE collection depuis un
 * navigateur connecté, ce qui ne couvre pas nos appels serveur-à-serveur.
 * <p>
 * Le token est optionnel côté configuration (bgg.application-token) pour
 * ne pas bloquer le développement local le temps qu'une application soit
 * enregistrée et approuvée par BGG (jusqu'à une semaine ou plus selon leur
 * documentation) - mais son absence est loggée pour rester honnête sur le
 * fait que l'usage n'est alors pas conforme aux conditions actuelles de BGG.
 */
final class BggAuthorization {

    private BggAuthorization() {
    }

    static HttpRequest.Builder applyToken(HttpRequest.Builder builder, String applicationToken) {
        if (applicationToken != null && !applicationToken.isBlank()) {
            builder.header("Authorization", "Bearer " + applicationToken);
        }
        return builder;
    }
}
