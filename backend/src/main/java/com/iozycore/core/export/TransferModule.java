package com.iozycore.core.export;

import com.iozycore.core.domain.catalog.Entity;

import java.util.Map;
import java.util.UUID;

/**
 * Point d'extension du cœur : ce qu'un univers exporte et importe en plus du
 * catalogue et de la collection - pour le manga, ses éditions de référence,
 * ses éditions suivies, ses prix relevés et ses préférences d'analyse
 * (Lot 133). L'ordre des passes est celui de l'import : les références
 * d'abord (une édition doit exister avant qu'un tome ne s'y relie), le reste
 * quand tout le catalogue est en place.
 */
public interface TransferModule {

    /** Ses sections du document, à l'export. */
    ExportDocument.SectionsUnivers exporter(Map<UUID, Entity> entitiesById);

    /** Ses références, une fois les œuvres en place et avant les liens tome → édition. */
    void importerReferences(ImportContexte contexte);

    /** Le reste, quand tout le catalogue et la collection sont importés. */
    void importerComplements(ImportContexte contexte);
}
