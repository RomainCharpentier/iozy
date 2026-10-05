package com.iozycore.core.application;

import com.iozycore.core.domain.catalog.Entity;
import com.iozycore.core.domain.catalog.EntityRepository;
import com.iozycore.core.domain.catalog.Variant;
import com.iozycore.core.domain.catalog.VariantLabels;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import com.iozycore.core.metadata.CoverImageCheck;
import java.util.List;

/**
 * Identify-or-create the VOLUME of a work, without any ownership.
 * <p>
 * Exact counterpart of {@link CatalogEntityResolver} one level down: that one
 * makes the page of the work exist, this one makes the volume exist. Same
 * reason to exist, and same story - the rule lived in
 * {@link QuickAddService}, so the only way to bring a volume into the
 * catalog was to acquire a copy of it.
 * <p>
 * What made it necessary: since the wish is about a volume
 * (migration V21), "I want volume 7" needs a volume to point to. But
 * on a detail page, most missing volumes are cataloged nowhere
 * - they are <em>deduced</em> from the total number of volumes of the edition (see
 * {@code buildTiles}, status {@code virtualMissing}). Without this entry point,
 * "I want it" would only have worked on the few volumes already cataloged,
 * that is almost never.
 * <p>
 * The deduplication is the one of QuickAdd, unchanged: the label
 * {@link VariantLabels#of} is the reference, so that buying afterwards a volume
 * that was put in wishes lands on the SAME Variant - and so really closes
 * the wish (see {@code QuickAddService.retirerDesEnvies}).
 */
@Service
public class TomeResolver {

    private final EntityRepository entityRepository;

    /** The universes that check a cover, those that keep editions - none is known from here (Batch 133). */
    private final List<CoverImageCheck> coverChecks;
    private final List<EditionLinker> editionLinkers;

    public TomeResolver(EntityRepository entityRepository, List<CoverImageCheck> coverChecks,
                        List<EditionLinker> editionLinkers) {
        this.entityRepository = entityRepository;
        this.coverChecks = coverChecks;
        this.editionLinkers = editionLinkers;
    }

    /** The canonical Volume of this work, and whether it already existed. */
    public record Resolution(Variant variant, boolean matchedExisting) {
    }

    /**
     * Returns volume {@code volumeNumber} of this work in this edition,
     * creating it if it is not yet cataloged, and linking it to its
     * catalog Edition when applicable.
     * <p>
     * <b>Mutates the received aggregate and does not save it</b>: the caller
     * often has other changes to make to it in the same transaction
     * (QuickAdd adds an ownership to it). See {@link #resoudreEtSauver} for
     * the caller that has only that to do.
     */
    public Resolution resoudre(Entity oeuvre, int volumeNumber, String edition, String jaquetteUrl) {
        String libelle = VariantLabels.of(volumeNumber, edition);
        Optional<Variant> existant = oeuvre.findVariantByLabel(libelle);
        Variant tome = existant.orElseGet(
                () -> oeuvre.addVariant(libelle, attributsDuTome(volumeNumber, edition, jaquetteUrl)));

        if (edition != null && !edition.isBlank()) {
            String nomEdition = edition.trim();
            editionLinkers.stream()
                    .map(linker -> linker.editionIdPour(oeuvre, nomEdition))
                    .flatMap(Optional::stream)
                    .findFirst()
                    .ifPresent(editionId -> oeuvre.linkVariantToEdition(tome.id(), editionId));
        }
        return new Resolution(tome, existant.isPresent());
    }

    /** Saved variant, for the caller whose only write this is. */
    @Transactional
    public Resolution resoudreEtSauver(Entity oeuvre, int volumeNumber, String edition) {
        Resolution resolution = resoudre(oeuvre, volumeNumber, edition, null);
        entityRepository.save(oeuvre);
        return resolution;
    }

    /**
     * Identify-or-create for the catalog Edition, symmetric to the
     * Series/Volume deduplication. Searches by entityId FIRST - entity.id() is
     * known for sure here, no need to go back through a
     * title match for ONE Entity that we already have in hand. The title
     * fallback now only serves for an edition not yet linked (e.g. created
     * from the Purchase Analysis before this series was in the collection) -
     * linked right here, opportunistically, as soon as it is found this way:
     * never the reverse, we never force an entityId on an edition that
     * already has a different one. Without this ID lookup first, a renaming of
     * the Series would have made an already linked edition impossible to find by
     * entity.title() (now different from the old MangaEdition.seriesTitle,
     * never updated in cascade) and would have created an empty duplicate at each
     * new add. A really new edition is created with the strict
     * minimum known (name + tier OTHER, everything else null) - to be enriched later,
     * never guessed at creation.
     */
    private Map<String, Object> attributsDuTome(int volumeNumber, String edition, String jaquetteUrl) {
        Map<String, Object> attributs = new HashMap<>();
        attributs.put("volumeNumber", volumeNumber);
        if (edition != null && !edition.isBlank()) {
            attributs.put("edition", edition.trim());
        }
        // Same key as COVER_IMAGE_ATTRIBUTE_KEY on the web/iOS side (see
        // lib/coverImage.ts) - shared convention so that a cover of a
        // Variant is read with exactly the same function as a cover
        // of an Entity, only the source (Entity.attributes vs Variant.attributes)
        // changes at the call.
        // A cover is checked HERE, when it is kept, and not at
        // display time (Batch 127): a dead address is not saved, the
        // volume stays without an image and the catch-up can try again. Who knows how to
        // check what is the business of the universes (CoverImageCheck).
        if (jaquetteUrl != null && !jaquetteUrl.isBlank() && coverChecks.stream().allMatch(c -> c.estUtilisable(jaquetteUrl))) {
            attributs.put("coverImageUrl", jaquetteUrl);
        }
        return attributs;
    }
}
