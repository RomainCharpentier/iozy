package com.iozycore.core.application;

import com.iozycore.core.domain.catalog.Entity;
import com.iozycore.core.domain.catalog.Variant;

import java.util.UUID;

/**
 * Point d'extension du cœur : ce qu'un univers fait APRÈS la suppression
 * d'un tome - le module manga y efface l'édition de référence devenue
 * orpheline, si aucun prix relevé ne la retient (Lot 133).
 */
public interface VariantDeletionHook {

    /** L'œuvre déjà sauvegardée sans le tome ; le tome tel qu'il était. */
    void apresSuppression(Entity oeuvre, Variant tomeSupprime, UUID tomeSupprimeId);
}
