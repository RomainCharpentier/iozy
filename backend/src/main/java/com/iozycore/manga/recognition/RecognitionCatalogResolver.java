package com.iozycore.manga.recognition;

import com.iozycore.core.domain.catalog.EntityRepository;
import com.iozycore.core.domain.catalog.EntityTypeRepository;
import com.iozycore.manga.domain.MangaEdition;
import com.iozycore.manga.domain.MangaEditionRepository;
import com.iozycore.manga.deals.MangaSeries;
import com.iozycore.manga.deals.SeriesMatcher;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

/**
 * Links what was read on a photo to what IozyCore already knows.
 *
 * <h2>Read-only, absolutely</h2>
 * This service creates <b>no Entity, no Edition, no Volume, no Ownership, no
 * Wishlist</b>. It relies on {@link SeriesMatcher}, which is already read-only
 * and case-insensitive - and above all not on {@code
 * CatalogEntityResolver.resolveOrCreate}, whose name says that it creates. A
 * recognition that writes into the catalog would turn an approximate
 * reading into truth, which this project refuses.
 *
 * <h2>Case and duplicates</h2>
 * "Platinum end" read on a photo finds the series "Platinum End" of the
 * catalog: the matching is already done without regard to case
 * ({@code findByEntityTypeIdAndTitleIgnoreCase}). This is what prevents a
 * duplicate from being born from a difference in capital letters.
 *
 * <h2>Ambiguous edition: we ask, we do not choose</h2>
 * "Death Note tome 1" without an edition hint does not become Black Edition
 * because it would be the first one found. The item comes out as
 * {@link CatalogStatus#EDITION_TO_CONFIRM} with the list of known editions,
 * and it is the user who decides.
 */
@Service
public class RecognitionCatalogResolver {

    private final SeriesMatcher seriesMatcher;
    private final MangaEditionRepository editionRepository;

    /**
     * {@link SeriesMatcher} is not a bean: {@code PurchaseAnalysisService}
     * already builds its own from the two repositories. We follow the same
     * convention rather than making it a shared component - it would be a
     * change on a stabilised surface for no gain, the object being
     * stateless.
     * <p>
     * {@code @Autowired} is needed: two constructors coexist, and
     * Spring picks only one by itself when it is unique.
     */
    @Autowired
    public RecognitionCatalogResolver(EntityRepository entityRepository,
                                       EntityTypeRepository entityTypeRepository,
                                       MangaEditionRepository editionRepository) {
        this(new SeriesMatcher(entityRepository, entityTypeRepository), editionRepository);
    }

    /** For tests, which inject a stand-in matcher. */
    RecognitionCatalogResolver(SeriesMatcher seriesMatcher, MangaEditionRepository editionRepository) {
        this.seriesMatcher = seriesMatcher;
        this.editionRepository = editionRepository;
    }

    public List<ResolvedItem> resolve(List<RecognizedItem> items) {
        if (items == null || items.isEmpty()) {
            return List.of();
        }
        List<ResolvedItem> resolus = new ArrayList<>(items.size());
        for (RecognizedItem item : items) {
            resolus.add(resolveOne(item));
        }
        return List.copyOf(resolus);
    }

    private ResolvedItem resolveOne(RecognizedItem item) {
        MangaSeries serie = seriesMatcher.match(item.seriesTitleRaw());

        if (serie.knownEntityId() == null) {
            // Recognised, but not yet in the catalog. We say so, we create nothing:
            // the user has an add flow, and it is theirs.
            //
            // The title kept is the one that SeriesMatcher normalised, not the
            // raw one: "🔥 Hell's Paradise" would otherwise enter the batch as is
            // then the saved analysis. The seller's decoration must not
            // become the name of a work - and the original text stays readable
            // in seriesTitleAsRead.
            return new ResolvedItem(item, CatalogStatus.NOT_IN_CATALOG, null, serie.title(), List.of(),
                    preselectable(item, CatalogStatus.NOT_IN_CATALOG));
        }

        List<MangaEdition> editions = editionRepository.findByEntityId(serie.knownEntityId());
        Optional<MangaEdition> exacte = editionLue(item, editions);

        CatalogStatus statut = exacte.isPresent() ? CatalogStatus.MATCHED : CatalogStatus.EDITION_TO_CONFIRM;

        // A single known edition and nothing read on the photo: it is tempting to
        // choose it. We do not do it - a series may very well have a
        // second edition that the catalog does not know yet, and the batch contain it.
        // The list is proposed, the action stays with the user.
        List<ResolvedItem.EditionOption> options = statut == CatalogStatus.EDITION_TO_CONFIRM
                ? editions.stream()
                        .map(e -> new ResolvedItem.EditionOption(e.id(), e.editionName(), e.totalVolumes()))
                        .toList()
                : List.of();

        // When the catalog has recognised the edition, ITS label is authoritative.
        //
        // The listing writes "édition Kana", the catalog says "Kana". Keeping what
        // was read would bring "Kana Edition" into the batch, then into the saved
        // analysis, then into the recorded prices - an edition name
        // that the catalog does not carry, and that would no longer match anything.
        // The original text stays readable in seriesTitleAsRead.
        RecognizedItem retenu = exacte
                .map(edition -> avecEdition(item, edition.editionName()))
                .orElse(item);

        return new ResolvedItem(retenu, statut, serie.knownEntityId(), catalogTitle(serie, editions),
                options, preselectable(retenu, statut));
    }

    private static RecognizedItem avecEdition(RecognizedItem item, String editionName) {
        return editionName == null || editionName.equals(item.editionHint())
                ? item
                : new RecognizedItem(item.seriesTitleRaw(), item.volumeNumber(), editionName, item.ean(),
                        item.confidence(), item.sources(), item.evidence(), item.sourceImages(), item.boxes());
    }

    /**
     * The catalog edition that matches what was read. Normalised comparison
     * (case, accents, punctuation): "perfect edition" finds
     * "Perfect Edition". With no hint read, nothing matches - this is intended.
     */
    private Optional<MangaEdition> editionLue(RecognizedItem item, List<MangaEdition> editions) {
        if (item.editionIsUnknown()) {
            return Optional.empty();
        }
        String lue = RecognitionConsolidator.normaliser(item.editionHint());

        Optional<MangaEdition> exacte = editions.stream()
                .filter(e -> RecognitionConsolidator.normaliser(e.editionName()).equals(lue))
                .findFirst();
        if (exacte.isPresent()) {
            return exacte;
        }

        // Fallback: the word "edition" itself is not discriminating, and the two
        // sides do not always carry it. The catalog names an edition
        // "Kana" when the listing writes "édition Kana"; it names one
        // "Perfect Edition" when the listing writes "Naruto Perfect". Comparing
        // the raw labels made both fail, and a perfectly identified
        // item went back to "édition à confirmer".
        String noyauLu = sansLeMotEdition(lue);
        if (noyauLu.isBlank()) {
            return Optional.empty();
        }
        List<MangaEdition> approchantes = editions.stream()
                .filter(e -> sansLeMotEdition(RecognitionConsolidator.normaliser(e.editionName()))
                        .equals(noyauLu))
                .toList();

        // Only one, otherwise nothing: if the catalog carried both "Perfect"
        // and "Perfect Edition", choosing for the user would be guessing.
        return approchantes.size() == 1 ? Optional.of(approchantes.get(0)) : Optional.empty();
    }

    /** The label without the word "edition", already normalised (no accents, lowercase). */
    private static String sansLeMotEdition(String normalise) {
        return normalise.replaceAll("\\bedition[s]?\\b", " ").replaceAll("\\s+", " ").trim();
    }

    /** The catalog title is authoritative; editions carry it too, we take the first known one. */
    private String catalogTitle(MangaSeries serie, List<MangaEdition> editions) {
        return editions.stream()
                .map(MangaEdition::seriesTitle)
                .filter(titre -> titre != null && !titre.isBlank())
                .findFirst()
                .orElse(serie.title());
    }

    /**
     * Pre-ticking is never a right to write, only a comfort. We only
     * pre-tick what we are sure of <b>and</b> that the catalog recognises
     * entirely: a high confidence on an unknown series still needs a look.
     */
    private boolean preselectable(RecognizedItem item, CatalogStatus statut) {
        return item.confidence().worthPreselecting()
                && statut == CatalogStatus.MATCHED
                && item.volumeNumber() != null;
    }
}
