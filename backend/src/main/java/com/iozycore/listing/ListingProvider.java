package com.iozycore.listing;

import com.iozycore.listing.ListingPlatform;

import java.util.Set;

/**
 * Une source d'annonces qu'IozyCore sait lire.
 * <p>
 * L'abstraction reste volontairement minuscule - elle existe pour qu'ajouter
 * Leboncoin demain soit une classe de plus et rien d'autre, pas pour construire
 * un moteur d'extraction générique. Trois responsabilités, pas une de plus :
 * dire de quelle plateforme il s'agit, déclarer les hôtes qu'il autorise, et
 * rendre un {@link ListingSnapshot} normalisé.
 * <p>
 * <b>Chaque provider apporte ses propres hôtes</b> ({@link #allowedHosts()}) :
 * aucun n'hérite de la liste blanche d'un autre, et il n'existe aucune liste
 * globale. Ajouter un provider n'élargit donc jamais ce que les autres peuvent
 * atteindre.
 */
public interface ListingProvider {

    /** La plateforme couverte - c'est elle qu'on retrouve ensuite sur l'analyse enregistrée. */
    ListingPlatform platform();

    /** Vrai si cette URL relève de ce provider. Sert à la détection de source, avant toute récupération. */
    boolean supports(String url);

    /**
     * Hôtes exacts, en minuscules, que ce provider autorise le serveur à
     * joindre. Liste blanche stricte : tout ce qui n'y figure pas est refusé
     * avant le moindre appel réseau (voir {@link ListingUrlGuard}).
     */
    Set<String> allowedHosts();

    /**
     * Hôtes exacts, en minuscules, depuis lesquels le serveur peut télécharger
     * les <b>photos</b> d'une annonce de cette source - typiquement un CDN
     * d'images, distinct des hôtes de pages.
     * <p>
     * Volontairement séparé de {@link #allowedHosts()} : lire une page HTML et
     * télécharger un binaire ne présentent pas le même risque, et un provider
     * doit pouvoir autoriser l'un sans l'autre. Le défaut est <b>vide</b> -
     * un provider qui ne se prononce pas n'autorise aucun téléchargement
     * d'image, plutôt que d'hériter d'une permission qu'il n'a pas demandée.
     *
     * @see com.iozycore.manga.recognition.RecognitionImageFetcher
     */
    default Set<String> allowedImageHosts() {
        return Set.of();
    }

    /**
     * Lit l'annonce, ou dit pourquoi elle n'a pas pu être lue.
     * <p>
     * Ne lève pas d'exception pour un échec attendu (annonce supprimée, source
     * indisponible, page illisible) : ce sont des issues normales du parcours,
     * que l'utilisateur doit pouvoir dépasser en saisissant à la main.
     */
    ListingResolution resolve(String url);
}
