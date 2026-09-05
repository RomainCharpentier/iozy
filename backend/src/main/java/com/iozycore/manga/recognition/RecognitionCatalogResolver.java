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
 * Relie ce qui a été lu sur une photo à ce qu'IozyCore connaît déjà.
 *
 * <h2>Lecture seule, absolument</h2>
 * Ce service ne crée <b>ni Entity, ni Édition, ni Tome, ni Ownership, ni
 * Wishlist</b>. Il s'appuie sur {@link SeriesMatcher}, qui est déjà read-only
 * et insensible à la casse - et surtout pas sur {@code
 * CatalogEntityResolver.resolveOrCreate}, dont le nom dit qu'il crée. Une
 * reconnaissance qui écrit dans le catalogue transformerait une lecture
 * approximative en vérité, ce que ce projet refuse.
 *
 * <h2>Casse et doublons</h2>
 * « Platinum end » lu sur une photo retrouve la Série « Platinum End » du
 * catalogue : le rapprochement se fait déjà sans tenir compte de la casse
 * ({@code findByEntityTypeIdAndTitleIgnoreCase}). C'est ce qui empêche un
 * doublon de naître d'une différence de majuscules.
 *
 * <h2>Édition ambiguë : on demande, on ne choisit pas</h2>
 * « Death Note tome 1 » sans indice d'édition ne devient pas Black Edition
 * parce qu'elle serait la première trouvée. L'élément ressort en
 * {@link CatalogStatus#EDITION_TO_CONFIRM} avec la liste des éditions connues,
 * et c'est l'utilisateur qui tranche.
 */
@Service
public class RecognitionCatalogResolver {

    private final SeriesMatcher seriesMatcher;
    private final MangaEditionRepository editionRepository;

    /**
     * {@link SeriesMatcher} n'est pas un bean : {@code PurchaseAnalysisService}
     * construit déjà le sien à partir des deux repositories. On suit la même
     * convention plutôt que d'en faire un composant partagé - ce serait un
     * changement sur une surface stabilisée pour un gain nul, l'objet étant sans
     * état.
     * <p>
     * {@code @Autowired} est nécessaire : deux constructeurs coexistent, et
     * Spring n'en choisit un seul d'office que lorsqu'il est unique.
     */
    @Autowired
    public RecognitionCatalogResolver(EntityRepository entityRepository,
                                       EntityTypeRepository entityTypeRepository,
                                       MangaEditionRepository editionRepository) {
        this(new SeriesMatcher(entityRepository, entityTypeRepository), editionRepository);
    }

    /** Pour les tests, qui injectent un matcher doublure. */
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
            // Reconnu, mais pas encore au catalogue. On le dit, on ne crée rien :
            // l'utilisateur a un parcours d'ajout, et c'est le sien.
            //
            // Le titre retenu reste celui que SeriesMatcher a normalisé, pas le
            // brut : « 🔥 Hell's Paradise » entrerait sinon tel quel dans le lot
            // puis dans l'analyse enregistrée. La décoration du vendeur n'a pas
            // à devenir le nom d'une œuvre - et le texte d'origine reste lisible
            // dans seriesTitleAsRead.
            return new ResolvedItem(item, CatalogStatus.NOT_IN_CATALOG, null, serie.title(), List.of(),
                    preselectable(item, CatalogStatus.NOT_IN_CATALOG));
        }

        List<MangaEdition> editions = editionRepository.findByEntityId(serie.knownEntityId());
        Optional<MangaEdition> exacte = editionLue(item, editions);

        CatalogStatus statut = exacte.isPresent() ? CatalogStatus.MATCHED : CatalogStatus.EDITION_TO_CONFIRM;

        // Une seule édition connue et rien de lu sur la photo : c'est tentant de
        // la choisir. On ne le fait pas - une série peut parfaitement avoir une
        // seconde édition que le catalogue ignore encore, et le lot en contenir.
        // La liste est proposée, le geste reste à l'utilisateur.
        List<ResolvedItem.EditionOption> options = statut == CatalogStatus.EDITION_TO_CONFIRM
                ? editions.stream()
                        .map(e -> new ResolvedItem.EditionOption(e.id(), e.editionName(), e.totalVolumes()))
                        .toList()
                : List.of();

        // Quand le catalogue a reconnu l'édition, c'est SON libellé qui fait foi.
        //
        // L'annonce écrit « édition Kana », le catalogue dit « Kana ». Garder ce
        // qui a été lu ferait entrer « Kana Edition » dans le lot, puis dans
        // l'analyse enregistrée, puis dans les prix relevés - un nom d'édition
        // que le catalogue ne porte pas, et qui ne se rapprocherait plus de rien.
        // Le texte d'origine reste lisible dans seriesTitleAsRead.
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
                        item.confidence(), item.sources(), item.evidence(), item.sourceImages());
    }

    /**
     * L'édition du catalogue qui correspond à ce qui a été lu. Comparaison
     * normalisée (casse, accents, ponctuation) : « perfect edition » retrouve
     * « Perfect Edition ». Sans indice lu, rien ne correspond - c'est voulu.
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

        // Repli : le mot « edition » lui-même n'est pas discriminant, et les deux
        // côtés ne le portent pas toujours. Le catalogue nomme une édition
        // « Kana » quand l'annonce écrit « édition Kana » ; il en nomme une
        // « Perfect Edition » quand l'annonce écrit « Naruto Perfect ». Comparer
        // les libellés bruts faisait échouer les deux, et un élément
        // parfaitement identifié repassait en « édition à confirmer ».
        String noyauLu = sansLeMotEdition(lue);
        if (noyauLu.isBlank()) {
            return Optional.empty();
        }
        List<MangaEdition> approchantes = editions.stream()
                .filter(e -> sansLeMotEdition(RecognitionConsolidator.normaliser(e.editionName()))
                        .equals(noyauLu))
                .toList();

        // Une seule, sinon rien : si le catalogue portait à la fois « Perfect »
        // et « Perfect Edition », choisir pour l'utilisateur serait deviner.
        return approchantes.size() == 1 ? Optional.of(approchantes.get(0)) : Optional.empty();
    }

    /** Le libellé privé du mot « edition », déjà normalisé (sans accents, minuscules). */
    private static String sansLeMotEdition(String normalise) {
        return normalise.replaceAll("\\bedition[s]?\\b", " ").replaceAll("\\s+", " ").trim();
    }

    /** Le titre du catalogue fait foi ; les éditions le portent aussi, on prend le premier connu. */
    private String catalogTitle(MangaSeries serie, List<MangaEdition> editions) {
        return editions.stream()
                .map(MangaEdition::seriesTitle)
                .filter(titre -> titre != null && !titre.isBlank())
                .findFirst()
                .orElse(serie.title());
    }

    /**
     * Pré-cocher n'est jamais un droit d'écriture, seulement un confort. On ne
     * pré-coche que ce dont on est sûr <b>et</b> que le catalogue reconnaît
     * entièrement : une confiance haute sur une série inconnue reste à regarder.
     */
    private boolean preselectable(RecognizedItem item, CatalogStatus statut) {
        return item.confidence().worthPreselecting()
                && statut == CatalogStatus.MATCHED
                && item.volumeNumber() != null;
    }
}
