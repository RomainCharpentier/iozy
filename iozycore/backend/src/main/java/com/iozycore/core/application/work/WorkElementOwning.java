package com.iozycore.core.application.work;

import com.iozycore.core.application.NotFoundException;
import com.iozycore.core.domain.catalog.Entity;
import com.iozycore.core.domain.catalog.EntityRepository;
import com.iozycore.core.domain.catalog.EntityType;
import com.iozycore.core.domain.catalog.EntityTypeRepository;
import com.iozycore.core.domain.work.DefaultWorkElements;
import com.iozycore.core.domain.work.WorkElement;
import com.iozycore.core.domain.work.WorkView;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.UUID;

/**
 * "Je l'ai" on one element of a work, for every type: a click on a missing
 * volume, expansion or game of the licence makes it owned.
 *
 * <p>The element is found by its key in the work as the page shows it, so only
 * an element the page can show can be owned. The universe that covers the type
 * adds what only it knows ({@link WorkElementsSource#own}); otherwise the core
 * owns the work itself or the variant behind the element - what a custom type
 * gets with nothing to write.
 *
 * <p>Idempotent: an element already owned is left as it is. Tenant-safe: the
 * copy is created for the signed-in account only, through
 * {@link ElementAcquisition}.
 */
@Service
public class WorkElementOwning {

    private final WorkReadModel works;
    private final EntityRepository entityRepository;
    private final EntityTypeRepository entityTypeRepository;
    private final ElementAcquisition acquisition;
    private final List<WorkElementsSource> sources;

    public WorkElementOwning(WorkReadModel works, EntityRepository entityRepository,
                             EntityTypeRepository entityTypeRepository, ElementAcquisition acquisition,
                             List<WorkElementsSource> sources) {
        this.works = works;
        this.entityRepository = entityRepository;
        this.entityTypeRepository = entityTypeRepository;
        this.acquisition = acquisition;
        this.sources = List.copyOf(sources);
    }

    /**
     * @return the work as it now stands
     * @throws NotFoundException     the work, or this element of it, does not exist
     * @throws IllegalStateException the element cannot be added from the page (a gap in a series with no volume
     *                               in the catalog yet: the add field knows its edition, the page does not)
     */
    public WorkView own(UUID entityId, String elementKey) {
        WorkView view = works.work(entityId);
        WorkElement element = view.elements().stream()
                .map(WorkView.CountedElement::element)
                .filter(candidate -> candidate.key().equals(elementKey))
                .findFirst()
                .orElseThrow(() -> new NotFoundException("Élément introuvable dans cette œuvre : " + elementKey));
        if (element.state() == WorkElement.State.OWNED) {
            return view;
        }
        Entity work = entityRepository.findById(entityId)
                .orElseThrow(() -> new NotFoundException("Œuvre introuvable : " + entityId));
        EntityType type = entityTypeRepository.findById(work.entityTypeId())
                .orElseThrow(() -> new NotFoundException("Type introuvable pour l'œuvre : " + entityId));
        boolean added = sources.stream()
                .filter(source -> source.supports(type))
                .findFirst()
                .map(source -> source.own(type, work, element))
                .orElse(false);
        if (!added) {
            ownByDefault(work, element);
        }
        return works.work(entityId);
    }

    private void ownByDefault(Entity work, WorkElement element) {
        if (element.variantId() != null) {
            acquisition.own(work.id(), element.variantId(), null);
        } else if (DefaultWorkElements.WHOLE_WORK_KEY.equals(element.key())) {
            acquisition.own(work.id(), null, null);
        } else {
            throw new IllegalStateException("Cet élément s'ajoute depuis le champ « Chercher ou ajouter »");
        }
    }
}
