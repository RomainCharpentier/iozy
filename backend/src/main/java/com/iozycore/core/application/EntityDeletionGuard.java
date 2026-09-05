package com.iozycore.core.application;

import java.util.UUID;

/**
 * Point d'extension du cœur : ce qui, dans un univers, retient encore une
 * œuvre qu'on veut supprimer.
 *
 * <p>Le cœur compte les possessions et les expériences ; les éditions de
 * référence d'un manga vivent dans leur module et se comptent ici (Lot 133).
 */
public interface EntityDeletionGuard {

    /** Combien de choses de cet univers référencent encore cette œuvre - zéro si rien ne la retient. */
    long referencesRestantes(UUID entityId);
}
