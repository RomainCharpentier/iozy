package com.iozycore.core.domain.share;


import java.util.UUID;

/**
 * The sharing of a personal space: <b>one link, several sections</b>.
 * <p>
 * There used to be two parallel systems - {@code CollectionShareSettings}
 * and {@code WishlistShareSettings} - each with its own table, its token, its
 * public controller, its page and its settings section. Two links to
 * hand out, the same rules written twice, and for the person who
 * receives: two URLs to look at the same space. But my collection and my
 * wishes are two <b>views</b> of this space, not two spaces.
 * <p>
 * The token acts as a password (capability URL): having it is enough,
 * there is nothing else to present. {@code token} null = no active link, and
 * revoking sets the field back to null rather than keeping a "disabled"
 * row - a token that exists nowhere anymore cannot leak.
 * Regenerating therefore invalidates the old one in the same move.
 * <p>
 * <b>At least one visible section.</b> A link that exposes nothing is not a
 * more discreet share, it is an active URL to an empty page: the invariant
 * is refused here, in the domain, not only in a form.
 * <p>
 * {@code includeTierLists} stays a sub-option of the collection, and
 * is false by default on purpose, including when a link is created: a
 * personal ranking is a judgment, not an inventory, it never leaves
 * with the rest without being asked for separately.
 */
public record ShareSettings(UUID ownerId, String token, boolean shareCollection, boolean shareWishlist,
                             boolean includeTierLists) {

    public ShareSettings {
        if (token != null && !shareCollection && !shareWishlist) {
            throw new IllegalArgumentException(
                    "Un lien actif doit exposer au moins une section - sinon il faut le supprimer");
        }
    }

    /** No link. The sections stay at their most open value for the next link created. */
    public static ShareSettings noLink(UUID proprietaire) {
        return new ShareSettings(proprietaire, null, true, true, false);
    }

    /**
     * A brand new link, both sections visible and the Tier Lists excluded.
     * <p>
     * The token is a UUID v4, drawn from a cryptographic generator: neither
     * sequential, nor derived from the owner id, and out of reach
     * of an enumeration ({@code /share/1}, {@code /share/2}...). This is the
     * mechanism already in place in the project, kept as it is.
     */
    public static ShareSettings withNewToken(UUID proprietaire) {
        return new ShareSettings(proprietaire, UUID.randomUUID().toString(), true, true, false);
    }

    /**
     * Changes the visible sections <b>without touching the token</b>: the link already
     * sent keeps working, it just shows something else.
     *
     * @throws IllegalArgumentException if both sections are unchecked while a link is active
     */
    public ShareSettings withSections(boolean shareCollection, boolean shareWishlist) {
        return new ShareSettings(ownerId, token, shareCollection, shareWishlist, includeTierLists);
    }

    /** Switches the Tier Lists without breaking the link already handed out. */
    public ShareSettings withTierLists(boolean includeTierLists) {
        return new ShareSettings(ownerId, token, shareCollection, shareWishlist, includeTierLists);
    }



    public boolean hasLink() {
        return token != null;
    }

    /**
     * The three accessors below answer the only question that matters
     * on the public side: "is this visitor allowed to see this?". They
     * all require an active link, so that a flag left true on a row
     * without a token never exposes anything.
     */
    public boolean sharesCollection() {
        return hasLink() && shareCollection;
    }

    public boolean sharesWishlist() {
        return hasLink() && shareWishlist;
    }

    /** The rankings go with the collection: without it, they do not come out. */
    public boolean sharesTierLists() {
        return sharesCollection() && includeTierLists;
    }
}
