package com.iozycore.listing;

import java.net.InetAddress;
import java.net.URI;
import java.net.UnknownHostException;
import java.util.Locale;
import java.util.Optional;
import java.util.Set;

/**
 * Décide si une URL fournie par l'utilisateur peut être récupérée par le
 * serveur, et le refuse dans le doute.
 * <p>
 * Le point sensible : c'est le <b>backend</b> qui va chercher une URL <b>saisie
 * par quelqu'un d'autre</b>. Sans garde-fou, ce serait un proxy ouvert vers
 * tout ce que le serveur peut atteindre et que l'extérieur ne peut pas :
 * {@code localhost}, le réseau Docker, la base de données, ou l'endpoint de
 * métadonnées d'un hébergeur cloud (169.254.169.254) qui délivre des
 * identifiants. C'est la faille SSRF, et elle se referme ici, en un seul
 * endroit, pour tous les providers.
 * <p>
 * La règle est une <b>liste blanche</b>, pas une liste noire : seuls les hôtes
 * qu'un provider déclare explicitement sont joignables. Un domaine inconnu
 * n'est pas « probablement sûr », il est refusé - et le parcours manuel prend
 * le relais. Chaque provider apporte ses propres hôtes ; aucun n'hérite de
 * ceux d'un autre.
 * <p>
 * Les vérifications s'appliquent <b>à chaque saut</b> : les redirections sont
 * suivies à la main par {@link ListingHttpFetcher} et repassent toutes par
 * ici, sinon un hôte autorisé pourrait rediriger vers une adresse interne et
 * contourner tout le reste.
 */
public final class ListingUrlGuard {

    /** Seul HTTPS : ni {@code file://}, ni {@code ftp://}, ni {@code gopher://}, et pas de HTTP en clair. */
    private static final String REQUIRED_SCHEME = "https";

    private ListingUrlGuard() {
    }

    /** Pourquoi une URL a été refusée - jamais un simple booléen, le client doit pouvoir l'expliquer. */
    public enum Rejection {
        /** Ni une URL absolue, ni HTTPS, ni un hôte exploitable. */
        MALFORMED,
        /** Bien formée, mais l'hôte n'est déclaré par aucun provider. */
        HOST_NOT_ALLOWED,
        /** L'hôte résout vers une adresse que seul le serveur peut atteindre - refus catégorique. */
        PRIVATE_ADDRESS
    }

    /**
     * Rend l'URI normalisée si elle est joignable, ou la raison du refus.
     *
     * @param allowedHosts hôtes exacts (déjà en minuscules) déclarés par le provider concerné
     */
    public static Result check(String rawUrl, Set<String> allowedHosts) {
        URI uri;
        try {
            uri = new URI(rawUrl.trim());
        } catch (Exception e) {
            return Result.rejected(Rejection.MALFORMED);
        }
        if (!uri.isAbsolute() || uri.getScheme() == null
                || !REQUIRED_SCHEME.equalsIgnoreCase(uri.getScheme())
                || uri.getHost() == null || uri.getHost().isBlank()) {
            return Result.rejected(Rejection.MALFORMED);
        }

        String host = uri.getHost().toLowerCase(Locale.ROOT);
        if (!allowedHosts.contains(host)) {
            return Result.rejected(Rejection.HOST_NOT_ALLOWED);
        }
        // Un hôte peut figurer sur la liste blanche ET pointer vers une adresse
        // interne (DNS détourné, entrée /etc/hosts, rebinding). La liste blanche
        // dit « ce nom est légitime », la résolution dit « et il ne mène pas
        // chez nous » - il faut les deux.
        if (resolvesToPrivateAddress(host)) {
            return Result.rejected(Rejection.PRIVATE_ADDRESS);
        }
        return Result.allowed(uri);
    }

    /**
     * Vrai dès qu'une des adresses de cet hôte est locale, privée, de lien-local
     * (ce qui couvre 169.254.169.254, l'endpoint de métadonnées des principaux
     * hébergeurs cloud) ou multicast. Un hôte qui ne résout pas est traité comme
     * suspect plutôt que comme inoffensif.
     */
    private static boolean resolvesToPrivateAddress(String host) {
        try {
            for (InetAddress address : InetAddress.getAllByName(host)) {
                if (address.isAnyLocalAddress() || address.isLoopbackAddress() || address.isLinkLocalAddress()
                        || address.isSiteLocalAddress() || address.isMulticastAddress()) {
                    return true;
                }
            }
            return false;
        } catch (UnknownHostException e) {
            return true;
        }
    }

    /** URI validée, ou refus motivé. */
    public record Result(URI uri, Rejection rejection) {
        static Result allowed(URI uri) {
            return new Result(uri, null);
        }

        static Result rejected(Rejection rejection) {
            return new Result(null, rejection);
        }

        public boolean isAllowed() {
            return rejection == null;
        }

        public Optional<URI> uriIfAllowed() {
            return Optional.ofNullable(uri);
        }
    }
}
