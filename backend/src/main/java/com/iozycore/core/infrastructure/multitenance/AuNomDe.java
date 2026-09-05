package com.iozycore.core.infrastructure.multitenance;

import java.util.Optional;
import java.util.UUID;
import java.util.function.Supplier;

/**
 * Travailler au nom d'un autre propriétaire, le temps d'un bloc, en le disant.
 *
 * <h2>Le seul cas légitime</h2>
 * Un lien de partage : son destinataire n'a pas de compte, et ce qu'il doit
 * voir appartient à quelqu'un d'autre. Le cloisonnement ne peut donc pas venir
 * de la session - il vient du <b>jeton</b>, qui nomme son propriétaire.
 *
 * <h2>Pourquoi ça se lit à l'endroit où ça se produit</h2>
 * La lecture au nom d'autrui est exactement ce qu'un cloisonnement est censé
 * empêcher. Elle ne doit donc jamais être une conséquence indirecte de
 * l'endroit d'où l'on vient : elle s'écrit, en toutes lettres, autour des
 * lignes concernées.
 *
 * <pre>{@code
 * return AuNomDe.executer(settings.ownerId(), () -> collectionPartagee());
 * }</pre>
 *
 * <p>Le rétablissement est garanti (bloc {@code finally}), y compris si le
 * corps lève : une exception ne doit pas laisser un thread du serveur en train
 * de lire au nom de quelqu'un pour toutes les requêtes suivantes.
 */
public final class AuNomDe {

    private static final ThreadLocal<UUID> COURANT = new ThreadLocal<>();

    private AuNomDe() {
    }

    /** Le propriétaire imposé pour ce fil d'exécution, s'il y en a un. */
    static Optional<UUID> actuel() {
        return Optional.ofNullable(COURANT.get());
    }

    public static <T> T executer(UUID proprietaire, Supplier<T> travail) {
        UUID precedent = COURANT.get();
        COURANT.set(proprietaire);
        try {
            return travail.get();
        } finally {
            // `set(precedent)` plutôt que `remove()` : les blocs peuvent
            // s'imbriquer, et sortir du plus interne ne doit pas annuler le
            // plus externe.
            if (precedent == null) {
                COURANT.remove();
            } else {
                COURANT.set(precedent);
            }
        }
    }
}
