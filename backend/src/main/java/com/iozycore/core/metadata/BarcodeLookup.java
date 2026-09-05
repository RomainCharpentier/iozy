package com.iozycore.core.metadata;

import java.util.Optional;

/**
 * Ce qu'une recherche par code-barres a donné — <b>y compris quand elle n'a
 * rien donné</b>.
 *
 * <h2>Deux vides qui ne se ressemblent pas</h2>
 * Les providers rendaient {@code Optional.empty()} dans deux situations que
 * rien ne distinguait ensuite :
 * <ul>
 *   <li><b>ABSENT</b> — la base a répondu, et elle ne connaît pas ce code.
 *       C'est une <i>réponse</i>, et elle a de la valeur : la reposer dans la
 *       minute donnera la même chose ;</li>
 *   <li><b>UNAVAILABLE</b> — la base n'a pas pu répondre : réseau coupé,
 *       délai dépassé, quota épuisé, corps illisible. Ce n'est pas une réponse,
 *       c'est une absence de réponse, et le ré-essai est légitime.</li>
 * </ul>
 *
 * <h2>Pourquoi la distinction a fini par compter</h2>
 * Tant que les codes-barres arrivaient un par un, depuis une caméra, les
 * confondre ne coûtait rien : l'utilisateur rescanne. Depuis que les photos
 * d'un lot en livrent une douzaine d'un coup — et qu'une identification prend
 * de 1,4 à 5,5 secondes — mémoriser les absences est devenu précieux.
 *
 * <p>Mais mémoriser une <i>panne</i> serait un défaut grave : le ré-essai de
 * l'utilisateur rendrait l'échec en cache au lieu de retenter, et un incident
 * d'une seconde se figerait pour une demi-heure. C'est précisément ce que le
 * test {@code does_not_cache_a_failed_barcode_lookup_so_a_later_retry_can_still_succeed}
 * protège depuis longtemps, et il avait raison.
 *
 * @param candidate l'œuvre trouvée, ou {@code null}
 * @param conclusive vrai quand la base <b>a répondu</b> - qu'elle ait trouvé ou non
 */
public record BarcodeLookup(MetadataCandidate candidate, boolean conclusive) {

    /** La base connaît ce code. */
    public static BarcodeLookup found(MetadataCandidate candidate) {
        return new BarcodeLookup(candidate, true);
    }

    /** La base a répondu, et ne connaît pas ce code. */
    public static BarcodeLookup absent() {
        return new BarcodeLookup(null, true);
    }

    /** La base n'a pas pu répondre - le ré-essai reste légitime. */
    public static BarcodeLookup unavailable() {
        return new BarcodeLookup(null, false);
    }

    public Optional<MetadataCandidate> candidateIfAny() {
        return Optional.ofNullable(candidate);
    }

    /** Cherché, et introuvable : la seule situation qu'il vaille la peine de mémoriser. */
    public boolean knownAbsent() {
        return conclusive && candidate == null;
    }
}
