package com.iozycore.core.listing;

import com.iozycore.core.listing.ListingPlatform;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.util.List;
import java.util.Optional;

/**
 * Point d'entrée unique du module : reçoit une URL collée par l'utilisateur,
 * trouve le provider qui la couvre, et lui délègue la lecture.
 * <p>
 * Toute la logique propre à une plateforme vit dans son provider - il n'y a ici
 * ni {@code if (url.contains("vinted"))}, ni parsing, ni appel réseau. Ajouter
 * Leboncoin consistera à publier un second {@link ListingProvider} : Spring
 * l'injectera dans la liste ci-dessous et rien d'autre ne bougera.
 * <p>
 * <b>Une URL non couverte n'est pas une erreur.</b> Elle rend
 * {@link ListingResolution.Status#UNSUPPORTED_SOURCE}, l'URL est conservée
 * telle quelle, et l'utilisateur saisit son annonce à la main comme avant. Le
 * lien reste utile : il permettra de retrouver l'annonce depuis l'analyse
 * enregistrée.
 */
@Service
public class ListingSourceResolver {

    private final List<ListingProvider> providers;

    public ListingSourceResolver(List<ListingProvider> providers) {
        this.providers = providers;
    }

    /**
     * La plateforme reconnue pour cette URL, sans aucun appel réseau -
     * c'est ce que le formulaire utilise pour annoncer « Détection : Vinted »
     * avant même de récupérer quoi que ce soit.
     */
    public ListingPlatform detectSource(String url) {
        return providerFor(url).map(ListingProvider::platform).orElse(ListingPlatform.OTHER);
    }

    /** Lit l'annonce si une source la couvre, sinon le dit sans rien tenter. */
    public ListingResolution resolve(String url) {
        if (url == null || url.isBlank() || !isWellFormedHttps(url)) {
            return ListingResolution.failed(ListingResolution.Status.INVALID_URL, ListingPlatform.OTHER, url);
        }
        return providerFor(url)
                .map(provider -> provider.resolve(url))
                .orElseGet(() -> ListingResolution.failed(
                        ListingResolution.Status.UNSUPPORTED_SOURCE, ListingPlatform.OTHER, url.trim()));
    }

    private Optional<ListingProvider> providerFor(String url) {
        if (url == null || url.isBlank()) {
            return Optional.empty();
        }
        return providers.stream().filter(provider -> provider.supports(url)).findFirst();
    }

    /**
     * Refus immédiat de ce qui n'est manifestement pas une adresse web
     * consultable : {@code file://}, {@code ftp://}, une adresse relative, du
     * texte libre. Le contrôle complet (liste blanche, adresses internes) reste
     * du ressort de {@link ListingUrlGuard}, au moment de la récupération -
     * celui-ci ne fait que distinguer « URL invalide » de « source non prise en
     * charge », deux messages différents pour l'utilisateur.
     */
    private static boolean isWellFormedHttps(String url) {
        try {
            URI uri = new URI(url.trim());
            return uri.isAbsolute() && "https".equalsIgnoreCase(uri.getScheme())
                    && uri.getHost() != null && !uri.getHost().isBlank();
        } catch (Exception e) {
            return false;
        }
    }
}
