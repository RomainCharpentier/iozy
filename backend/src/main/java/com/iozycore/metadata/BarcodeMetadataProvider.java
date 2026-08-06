package com.iozycore.metadata;

import com.iozycore.domain.catalog.EntityType;

import java.util.Optional;

/**
 * Complète MetadataProvider pour le cas "je viens de scanner un
 * code-barres" (parcours 1) : contrairement à search(query), on part
 * d'un identifiant exact (ISBN/EAN) et on attend au plus un résultat.
 * Un MetadataProvider peut implémenter les deux interfaces si sa source
 * le permet (ce n'est pas le cas de Jikan/BGG, qui n'indexent pas par
 * code-barres).
 */
public interface BarcodeMetadataProvider {

    boolean supports(EntityType entityType);

    /** Ne doit jamais lever d'exception pour une panne réseau, voir implémentations. */
    Optional<MetadataCandidate> lookup(String barcode);
}
