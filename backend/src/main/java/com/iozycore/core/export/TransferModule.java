package com.iozycore.core.export;

import com.iozycore.core.domain.catalog.Entity;

import java.util.Map;
import java.util.UUID;

/**
 * Extension point of the core: what a universe exports and imports in addition to the
 * catalog and the collection - for manga, its reference editions,
 * its followed editions, its recorded prices and its analysis preferences
 * (Batch 133). The order of the passes is the one of the import: references
 * first (an edition must exist before a volume links to it), the rest
 * when the whole catalog is in place.
 */
public interface TransferModule {

    /** Its sections of the document, at export time. */
    ExportDocument.SectionsUnivers exporter(Map<UUID, Entity> entitiesById);

    /** Its references, once the works are in place and before the volume -> edition links. */
    void importerReferences(ImportContexte contexte);

    /** The rest, when the whole catalog and the collection are imported. */
    void importerComplements(ImportContexte contexte);
}
