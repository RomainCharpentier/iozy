package com.iozycore.listing;

import com.iozycore.purchaseanalysis.ListingPlatform;

import java.util.Optional;

/**
 * L'issue d'une tentative de lecture d'annonce.
 * <p>
 * Il y a bien plus que « ça a marché » et « ça a raté » : la moitié de
 * l'intérêt de ce module est de distinguer des situations auxquelles
 * l'utilisateur ne réagit pas de la même façon - une plateforme non encore
 * prise en charge n'est pas une annonce supprimée, qui n'est pas un blocage
 * temporaire. Un seul code d'erreur produirait le même message inutile dans
 * les trois cas.
 * <p>
 * <b>Un résultat partiel est un succès.</b> Titre et prix lus mais photos
 * illisibles : {@link Status#PARTIAL}, avec le snapshot bien rempli de ce qui a
 * été trouvé. Ce n'est pas une erreur, c'est du travail en moins pour
 * l'utilisateur.
 */
public record ListingResolution(Status status, ListingPlatform source, String url, ListingSnapshot snapshot) {

    public enum Status {
        /** Tout ce que le provider sait lire a été lu. */
        SUCCESS,
        /** Une partie seulement a été lue - le reste reste à saisir à la main. */
        PARTIAL,
        /** URL inexploitable : ni absolue, ni HTTPS, ou hôte refusé par la liste blanche. */
        INVALID_URL,
        /** URL valide mais aucune source connue ne la couvre - le parcours manuel continue, l'URL est conservée. */
        UNSUPPORTED_SOURCE,
        /**
         * Source <b>reconnue</b>, mais qui refuse la lecture automatique.
         *
         * <p>À distinguer de {@link #UNSUPPORTED_SOURCE} (« personne ne couvre
         * cette URL », donc un support viendra peut-être) et de
         * {@link #UNAVAILABLE} (« ça n'a pas marché cette fois », donc
         * réessayer a du sens). Ici, ni l'un ni l'autre : la plateforme se
         * protège contre les robots, et aucune quantité de code ne changera
         * cela sans franchir une ligne que ce projet ne franchit pas - pas de
         * cookie utilisateur, pas d'API privée, pas de contournement anti-bot.
         *
         * <p>Le dire explicitement évite de laisser croire à une
         * fonctionnalité « pas encore » livrée : la saisie manuelle n'est pas
         * un repli temporaire, c'est le parcours pour cette source.
         */
        SOURCE_BLOCKS_AUTOMATION,
        /** L'annonce n'existe plus, ou n'a jamais existé. */
        LISTING_NOT_FOUND,
        /** La source n'a rien livré d'exploitable : blocage, panne, page illisible. Réessayer plus tard peut marcher. */
        UNAVAILABLE
    }

    public static ListingResolution success(ListingSnapshot snapshot) {
        return new ListingResolution(Status.SUCCESS, snapshot.source(), snapshot.sourceUrl(), snapshot);
    }

    public static ListingResolution partial(ListingSnapshot snapshot) {
        return new ListingResolution(Status.PARTIAL, snapshot.source(), snapshot.sourceUrl(), snapshot);
    }

    public static ListingResolution failed(Status status, ListingPlatform source, String url) {
        return new ListingResolution(status, source, url, null);
    }

    public Optional<ListingSnapshot> snapshotIfAny() {
        return Optional.ofNullable(snapshot);
    }

    /** Vrai quand quelque chose d'utilisable a été récupéré, complet ou non. */
    public boolean hasData() {
        return snapshot != null && !snapshot.isEmpty();
    }
}
