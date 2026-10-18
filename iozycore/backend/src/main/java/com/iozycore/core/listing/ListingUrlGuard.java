package com.iozycore.core.listing;

import java.net.InetAddress;
import java.net.URI;
import java.net.UnknownHostException;
import java.util.Locale;
import java.util.Optional;
import java.util.Set;

/**
 * Decides whether a URL supplied by the user can be fetched by the
 * server, and refuses it when in doubt.
 * <p>
 * The sensitive point: it is the <b>backend</b> that fetches a URL <b>typed
 * by someone else</b>. Without a guard, it would be an open proxy to
 * everything the server can reach and the outside cannot:
 * {@code localhost}, the Docker network, the database, or the metadata
 * endpoint of a cloud host (169.254.169.254) that hands out
 * credentials. This is the SSRF hole, and it closes here, in a single
 * place, for all providers.
 * <p>
 * The rule is a <b>whitelist</b>, not a blacklist: only the hosts
 * that a provider explicitly declares are reachable. An unknown domain
 * is not "probably safe", it is refused - and the manual flow takes
 * over. Each provider brings its own hosts; none inherits
 * those of another.
 * <p>
 * The checks apply <b>at each hop</b>: the redirects are
 * followed by hand by {@link ListingHttpFetcher} and all go through
 * here again, otherwise an allowed host could redirect to an internal address and
 * bypass everything else.
 */
public final class ListingUrlGuard {

    /** HTTPS only: no {@code file://}, no {@code ftp://}, no {@code gopher://}, and no plain HTTP. */
    private static final String REQUIRED_SCHEME = "https";

    private ListingUrlGuard() {
    }

    /** Why a URL was refused - never a simple boolean, the client must be able to explain it. */
    public enum Rejection {
        /** Neither an absolute URL, nor HTTPS, nor a usable host. */
        MALFORMED,
        /** Well formed, but the host is not declared by any provider. */
        HOST_NOT_ALLOWED,
        /** The host resolves to an address that only the server can reach - categorical refusal. */
        PRIVATE_ADDRESS
    }

    /**
     * Returns the normalized URI if it is reachable, or the reason for the refusal.
     *
     * @param allowedHosts exact hosts (already in lower case) declared by the provider concerned
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
        // A host can be on the whitelist AND point to an internal
        // address (hijacked DNS, /etc/hosts entry, rebinding). The whitelist
        // says "this name is legitimate", the resolution says "and it does not lead
        // to our place" - both are needed.
        if (resolvesToPrivateAddress(host)) {
            return Result.rejected(Rejection.PRIVATE_ADDRESS);
        }
        return Result.allowed(uri);
    }

    /**
     * True as soon as one of the addresses of this host is local, private, link-local
     * (which covers 169.254.169.254, the metadata endpoint of the main
     * cloud hosts) or multicast. A host that does not resolve is treated as
     * suspect rather than harmless.
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

    /** Validated URI, or reasoned refusal. */
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
