package com.iozycore.listing.vinted;

import com.iozycore.listing.ListingHttpFetcher;
import com.iozycore.listing.ListingProvider;
import com.iozycore.listing.ListingResolution;
import com.iozycore.listing.ListingSnapshot;
import com.iozycore.listing.ListingSnapshot.ListingField;
import com.iozycore.purchaseanalysis.ListingPlatform;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

/**
 * Lit une annonce Vinted publique pour pré-remplir un brouillon d'analyse.
 *
 * <h2>Ce que Vinted permet, constaté le 2026-08-21</h2>
 * Une page d'annonce {@code /items/<id>} répond 200 à une simple requête
 * anonyme, sans connexion ni cookie, et publie des balises <b>OpenGraph</b>
 * (titre, description, URL canonique, photo principale) - des métadonnées
 * destinées à être lues par d'autres. Le {@code robots.txt} du site n'interdit
 * pas {@code /items} aux agents génériques.
 * <p>
 * Le <b>prix</b> et la <b>liste complète des photos</b> ne figurent en revanche
 * dans aucune donnée structurée publiée : ils ne vivent que dans le contenu
 * embarqué par le rendu de la page. On les lit au mieux (voir
 * {@link VintedPageParser}) en sachant que Vinted peut en changer la forme sans
 * préavis - leur absence dégrade alors le résultat en {@code PARTIAL}, elle ne
 * le fait pas échouer.
 *
 * <h2>Ce que Vinted empêche, et qu'on ne contourne pas</h2>
 * L'API interne du site exige une session et des jetons ; l'utiliser
 * supposerait de reproduire un mécanisme d'authentification. Ce n'est pas fait,
 * et ne doit pas l'être : aucune connexion, aucun cookie de compte, aucune
 * usurpation de navigateur, aucun contournement de protection anti-robot. La
 * requête annonce honnêtement IozyCore et n'est déclenchée que par un
 * utilisateur qui vient de coller ce lien précis.
 *
 * <h2>Ce qui n'est pas récupéré, volontairement</h2>
 * Rien sur le vendeur (pseudo, avatar, localisation) : ces données n'entrent
 * dans aucun calcul de verdict et n'ont donc pas à être lues ni conservées.
 */
@Component
public class VintedListingProvider implements ListingProvider {

    /**
     * Une annonce n'a pas besoin de plus pour être reconnue de visu, et ce
     * plafond garde la réponse, l'affichage et la mémoire dans des limites
     * prévisibles.
     */
    static final int MAX_IMAGES = 12;

    /**
     * Liste blanche stricte, propre à ce provider. Vinted opère un domaine par
     * pays ; chacun est nommé explicitement plutôt que déduit d'un motif du
     * genre « tout ce qui contient vinted », qui accepterait
     * {@code vinted.attaquant.example}.
     */
    private static final Set<String> ALLOWED_HOSTS = buildAllowedHosts();

    private static Set<String> buildAllowedHosts() {
        List<String> domains = List.of(
                "vinted.fr", "vinted.be", "vinted.lu", "vinted.com", "vinted.co.uk", "vinted.de", "vinted.at",
                "vinted.es", "vinted.it", "vinted.nl", "vinted.pl", "vinted.cz", "vinted.sk", "vinted.lt",
                "vinted.pt", "vinted.se", "vinted.fi", "vinted.dk", "vinted.gr", "vinted.ro", "vinted.hu",
                "vinted.ie", "vinted.hr", "vinted.si");
        Set<String> hosts = new LinkedHashSet<>();
        for (String domain : domains) {
            hosts.add(domain);
            hosts.add("www." + domain);
        }
        return Set.copyOf(hosts);
    }

    private final ListingHttpFetcher fetcher;

    public VintedListingProvider(ListingHttpFetcher fetcher) {
        this.fetcher = fetcher;
    }

    @Override
    public ListingPlatform platform() {
        return ListingPlatform.VINTED;
    }

    @Override
    public Set<String> allowedHosts() {
        return ALLOWED_HOSTS;
    }

    /**
     * Détection de source : uniquement sur l'hôte, jamais sur « l'URL contient
     * vinted » - {@code https://phishing.example/vinted.fr} ne serait pas une
     * annonce Vinted.
     */
    @Override
    public boolean supports(String url) {
        try {
            URI uri = new URI(url.trim());
            String host = uri.getHost();
            return host != null && ALLOWED_HOSTS.contains(host.toLowerCase(Locale.ROOT));
        } catch (Exception e) {
            return false;
        }
    }

    @Override
    public ListingResolution resolve(String url) {
        ListingHttpFetcher.Fetched fetched = fetcher.fetchHtml(url, ALLOWED_HOSTS);
        if (!fetched.isSuccess()) {
            return switch (fetched.failure()) {
                case URL_REJECTED -> ListingResolution.failed(
                        ListingResolution.Status.INVALID_URL, ListingPlatform.VINTED, url);
                case NOT_FOUND -> ListingResolution.failed(
                        ListingResolution.Status.LISTING_NOT_FOUND, ListingPlatform.VINTED, url);
                case UNAVAILABLE -> ListingResolution.failed(
                        ListingResolution.Status.UNAVAILABLE, ListingPlatform.VINTED, url);
            };
        }

        VintedPageParser.ParsedPage page = VintedPageParser.parse(fetched.html(), url, MAX_IMAGES);

        List<ListingField> retrieved = new ArrayList<>();
        if (page.title() != null) retrieved.add(ListingField.TITLE);
        if (page.description() != null) retrieved.add(ListingField.DESCRIPTION);
        if (page.price() != null) retrieved.add(ListingField.PRICE);
        if (page.shippingFee() != null) retrieved.add(ListingField.SHIPPING_FEE);
        if (page.buyerProtectionFee() != null) retrieved.add(ListingField.BUYER_PROTECTION_FEE);
        if (!page.imageUrls().isEmpty()) retrieved.add(ListingField.IMAGES);

        ListingSnapshot snapshot = new ListingSnapshot(
                ListingPlatform.VINTED,
                // L'URL canonique quand la page la donne : deux liens vers la même
                // annonce (avec ou sans slug, avec des paramètres de suivi) se
                // ramènent alors à la même adresse.
                page.canonicalUrl() != null ? page.canonicalUrl() : fetched.finalUri().toString(),
                page.externalId(), page.title(), page.description(), page.price(), page.currency(),
                page.shippingFee(), page.buyerProtectionFee(),
                page.imageUrls(), Instant.now(), retrieved);

        if (snapshot.isEmpty()) {
            // La page a bien répondu mais n'a livré aucun des champs attendus :
            // pour l'utilisateur, c'est indiscernable d'une indisponibilité, et
            // il n'y a rien à pré-remplir.
            return ListingResolution.failed(ListingResolution.Status.UNAVAILABLE, ListingPlatform.VINTED, url);
        }
        return retrieved.size() == ListingField.values().length
                ? ListingResolution.success(snapshot)
                : ListingResolution.partial(snapshot);
    }
}
