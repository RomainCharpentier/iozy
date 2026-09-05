package com.iozycore.core.listing.leboncoin;

import com.iozycore.core.listing.ListingProvider;
import com.iozycore.core.listing.ListingResolution;
import com.iozycore.core.listing.ListingPlatform;
import org.springframework.stereotype.Component;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

/**
 * Reconnaît une annonce Leboncoin — et dit franchement qu'elle ne peut pas être
 * lue automatiquement.
 *
 * <h2>Pourquoi un provider qui ne lit rien</h2>
 * Sans lui, un lien Leboncoin ressort en {@code UNSUPPORTED_SOURCE}, dont
 * l'écran tire « cette plateforme n'est pas encore récupérée automatiquement ».
 * Ce « pas encore » laisse attendre une fonctionnalité à venir. Elle ne viendra
 * pas ainsi, et le faire croire coûte plus qu'un aveu.
 *
 * <h2>Ce qui a été constaté (2026-08-24)</h2>
 * Les pages d'annonce sont protégées par DataDome. Une requête serveur, sans
 * navigateur — exactement le profil de {@code ListingHttpFetcher} — reçoit un
 * <b>HTTP 403</b> de 771 octets pointant vers {@code captcha-delivery.com},
 * jamais l'annonce. Un navigateur automatisé reçoit la même page
 * d'interstitiel : titre vide, aucune donnée, {@code og:image} servi depuis
 * {@code img.datadome.co/captcha/…}. Il n'existe ni JSON-LD ni microdonnées à
 * lire.
 *
 * <h2>Ce que ce provider ne fera jamais</h2>
 * Passer outre. Ni cookie de session, ni API privée, ni maquillage de
 * navigateur, ni résolution de CAPTCHA : ce sont des lignes que ce projet ne
 * franchit pas, et une protection anti-robot est une volonté explicite de
 * l'éditeur, pas un obstacle technique à contourner.
 *
 * <h2>Aucune requête, par construction</h2>
 * {@link #allowedHosts()} rend un ensemble <b>vide</b> : ce provider n'autorise
 * le serveur à joindre aucun hôte. La reconnaissance passe par
 * {@link #supports(String)}, la lecture n'a pas lieu. Même un bug d'appel ne
 * pourrait pas déclencher de requête vers Leboncoin.
 *
 * <h2>Le jour où cela changerait</h2>
 * Si Leboncoin publiait une API ou levait la protection, cette classe devient
 * un vrai provider — même interface, mêmes appelants, aucun changement
 * ailleurs. C'est précisément ce que la couture {@code ListingProvider} permet.
 */
@Component
public class LeboncoinListingProvider implements ListingProvider {

    /**
     * Domaines énumérés un par un, jamais déduits d'un motif du genre « tout ce
     * qui contient leboncoin » - {@code leboncoin.fr.attaquant.example} ne doit
     * pas passer pour Leboncoin. Même règle que pour Vinted.
     */
    private static final Set<String> HOTES_RECONNUS = construireHotes();

    private static Set<String> construireHotes() {
        Set<String> hotes = new LinkedHashSet<>();
        for (String domaine : List.of("leboncoin.fr")) {
            hotes.add(domaine);
            hotes.add("www." + domaine);
            hotes.add("m." + domaine);
        }
        return Set.copyOf(hotes);
    }

    @Override
    public ListingPlatform platform() {
        return ListingPlatform.LEBONCOIN;
    }

    /**
     * Détection sur l'hôte seul, jamais sur « l'URL contient leboncoin ».
     * Reconnaître ne veut pas dire lire : voir {@link #resolve(String)}.
     */
    @Override
    public boolean supports(String url) {
        return hote(url).map(HOTES_RECONNUS::contains).orElse(false);
    }

    /**
     * Vide, et c'est le fond du sujet : ce provider n'autorise le serveur à
     * joindre <b>aucun</b> hôte, puisqu'il ne lit rien.
     */
    @Override
    public Set<String> allowedHosts() {
        return Set.of();
    }

    /** Sans lecture, pas de photos - donc aucun hôte d'images non plus. */
    @Override
    public Set<String> allowedImageHosts() {
        return Set.of();
    }

    /**
     * Rend immédiatement, <b>sans le moindre appel réseau</b> : le résultat est
     * connu d'avance, et solliciter la plateforme pour se faire refuser
     * n'apprendrait rien à personne.
     */
    @Override
    public ListingResolution resolve(String url) {
        return ListingResolution.failed(ListingResolution.Status.SOURCE_BLOCKS_AUTOMATION,
                ListingPlatform.LEBONCOIN, url == null ? null : url.trim());
    }

    private static java.util.Optional<String> hote(String url) {
        if (url == null || url.isBlank()) {
            return java.util.Optional.empty();
        }
        try {
            java.net.URI uri = new java.net.URI(url.trim());
            return java.util.Optional.ofNullable(uri.getHost())
                    .map(h -> h.toLowerCase(java.util.Locale.ROOT));
        } catch (Exception e) {
            return java.util.Optional.empty();
        }
    }
}
