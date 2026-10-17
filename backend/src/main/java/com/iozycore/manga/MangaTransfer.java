package com.iozycore.manga;

import com.iozycore.core.domain.catalog.Entity;
import com.iozycore.core.export.ExportDocument;
import com.iozycore.core.export.ImportContexte;
import com.iozycore.core.export.TransferModule;
import com.iozycore.core.listing.ListingPlatform;
import com.iozycore.manga.domain.deals.CollectorPreferences;
import com.iozycore.manga.domain.deals.CollectorPreferencesRepository;
import com.iozycore.manga.domain.deals.Condition;
import com.iozycore.manga.domain.deals.MarketObservationOrigin;
import com.iozycore.manga.domain.deals.MarketPriceObservation;
import com.iozycore.manga.domain.deals.MarketPriceObservationRepository;
import com.iozycore.manga.domain.deals.VerdictFactor;
import com.iozycore.manga.domain.deals.VolumeRange;
import com.iozycore.manga.domain.deals.WeightLevel;
import com.iozycore.manga.domain.EditionTier;
import com.iozycore.manga.domain.MangaEdition;
import com.iozycore.manga.domain.MangaEditionRepository;
import com.iozycore.manga.domain.followededition.FollowedEdition;
import com.iozycore.manga.domain.followededition.FollowedEditionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * What manga exports and imports in addition to the catalog: its reference
 * editions, its recorded prices, its followed editions and its purchase
 * analysis preferences - code extracted from ExportService and ImportService in
 * Batch 133, rule by rule (an already declared edition is attached, an identical
 * record is ignored, the preferences of the file replace).
 */
@Component
@RequiredArgsConstructor
public class MangaTransfer implements TransferModule {

    private final MangaEditionRepository mangaEditionRepository;
    private final MarketPriceObservationRepository marketPriceObservationRepository;
    private final FollowedEditionRepository followedEditionRepository;
    private final CollectorPreferencesRepository collectorPreferencesRepository;

    // ----- export ------------------------------------------------------------------------

    @Override
    public ExportDocument.SectionsUnivers exporter(Map<UUID, Entity> entitiesById) {
        List<ExportDocument.MangaEditionExport> editionExports = mangaEditionRepository.findAll().stream()
                .map(e -> new ExportDocument.MangaEditionExport(e.id(), e.entityId(), e.seriesTitle(), e.editionName(),
                        e.tier() == null ? null : e.tier().name(), e.publisher(), e.totalVolumes(),
                        e.retailPriceNewPerVolume(), e.outOfPrint(), e.betterEditionAnnounced(), e.betterEditionNote(),
                        e.languageCode()))
                .toList();

        Map<UUID, MangaEdition> editionsById = mangaEditionRepository.findAll().stream()
                .collect(Collectors.toMap(MangaEdition::id, e -> e));
        List<ExportDocument.MarketObservationExport> observationExports = marketPriceObservationRepository.findAll()
                .stream()
                .map(o -> toObservationExport(o, editionsById))
                .toList();

        List<ExportDocument.FollowedEditionExport> followedExports = followedEditionRepository
                .findByEntityIdIn(List.copyOf(entitiesById.keySet())).stream()
                .map(f -> new ExportDocument.FollowedEditionExport(f.id(), f.entityId(),
                        titleOf(f.entityId(), entitiesById), f.editionName(), f.followedAt()))
                .toList();

        CollectorPreferences preferences = collectorPreferencesRepository.find();
        ExportDocument.CollectorPreferencesExport preferencesExport = new ExportDocument.CollectorPreferencesExport(
                preferences.editionTierRanking().stream().map(Enum::name).toList(),
                preferences.avoidOutdatedEditionWhenBetterExistsOrAnnounced(),
                preferences.conditionImportance().name(),
                preferences.minimumDiscountVsRetailPercent(),
                preferences.factorWeights().entrySet().stream()
                        .collect(Collectors.toMap(e -> e.getKey().name(), Map.Entry::getValue)));

        return new ExportDocument.SectionsUnivers(editionExports, observationExports, followedExports, preferencesExport);
    }

    private static String titleOf(UUID entityId, Map<UUID, Entity> entitiesById) {
        Entity entity = entitiesById.get(entityId);
        return entity == null ? null : entity.title();
    }

    private static ExportDocument.MarketObservationExport toObservationExport(
            MarketPriceObservation o, Map<UUID, MangaEdition> editionsById) {
        MangaEdition edition = editionsById.get(o.mangaEditionId());
        return new ExportDocument.MarketObservationExport(o.id(), o.mangaEditionId(),
                edition != null ? edition.seriesTitle() : null, edition != null ? edition.editionName() : null,
                o.scope() == null ? null : o.scope().from(), o.scope() == null ? null : o.scope().to(),
                o.volumeCount(), o.observedPrice(),
                o.platform() == null ? null : o.platform().name(),
                o.observedCondition() == null ? null : o.observedCondition().name(),
                o.observedAt(), o.origin() == null ? null : o.origin().name(), o.sourceUrl(), o.note());
    }

    // ----- import ------------------------------------------------------------------------

    @Override
    public void importerReferences(ImportContexte ctx) {
        ctx.cumul.section("editions", "Editions de reference");
        for (ExportDocument.MangaEditionExport ed : ImportContexte.liste(ctx.doc.editions())) {
            String sujet = ImportContexte.nonVide(ed.seriesTitle(), "?") + " · " + ImportContexte.nonVide(ed.editionName(), "?");
            if (ed.seriesTitle() == null || ed.seriesTitle().isBlank()
                    || ed.editionName() == null || ed.editionName().isBlank()) {
                ctx.cumul.ignore("editions", sujet, "serie ou edition sans nom");
                continue;
            }
            Optional<MangaEdition> existante = mangaEditionRepository.findBySeriesAndEdition(ed.seriesTitle(),
                    ed.editionName());
            if (existante.isPresent()) {
                ctx.editions.put(ed.id(), existante.get().id());
                ctx.cumul.rattache("editions", sujet, "edition deja declaree");
                continue;
            }
            EditionTier tier = ImportContexte.enumOuNull(EditionTier.class, ed.tier());
            UUID entityId = ed.entityId() == null ? null
                    : Optional.ofNullable(ctx.oeuvres.get(ed.entityId())).map(Entity::id).orElse(null);
            Instant maintenant = Instant.now();
            MangaEdition creee = new MangaEdition(UUID.randomUUID(), entityId, ed.seriesTitle(), ed.editionName(),
                    tier, ed.publisher(), ed.totalVolumes(), ed.retailPriceNewPerVolume(), ed.outOfPrint(),
                    ed.betterEditionAnnounced(), ed.betterEditionNote(), ed.languageCode(), maintenant, maintenant);
            if (ctx.ecrire) {
                creee = mangaEditionRepository.save(creee);
            }
            ctx.editions.put(ed.id(), creee.id());
            ctx.cumul.cree("editions");
        }
    }

    @Override
    public void importerComplements(ImportContexte ctx) {
        editionsSuivies(ctx);
        prixReleves(ctx);
        preferences(ctx);
    }

    private void editionsSuivies(ImportContexte ctx) {
        ctx.cumul.section("followedEditions", "Editions suivies");
        for (ExportDocument.FollowedEditionExport f : ImportContexte.liste(ctx.doc.followedEditions())) {
            String sujet = ImportContexte.nonVide(f.entityTitle(), "?") + " · " + ImportContexte.nonVide(f.editionName(), "?");
            UUID entityId = ctx.oeuvreId(f.entityId());
            if (entityId == null || f.editionName() == null || f.editionName().isBlank()) {
                ctx.cumul.ignore("followedEditions", sujet, entityId == null ? "oeuvre non importee" : "edition sans nom");
                continue;
            }
            if (!ctx.oeuvresACreer.contains(f.entityId()) && followedEditionRepository.findByEntityId(entityId).isPresent()) {
                ctx.cumul.rattache("followedEditions", sujet, "une edition est deja suivie pour cette serie");
                continue;
            }
            if (ctx.ecrire) {
                followedEditionRepository.save(FollowedEdition.create(entityId, f.editionName()));
            }
            ctx.cumul.cree("followedEditions");
        }
    }

    private void prixReleves(ImportContexte ctx) {
        ctx.cumul.section("marketObservations", "Prix releves");
        Map<UUID, List<MarketPriceObservation>> existantesParEdition = new HashMap<>();
        for (ExportDocument.MarketObservationExport o : ImportContexte.liste(ctx.doc.marketObservations())) {
            String sujet = ImportContexte.nonVide(o.seriesTitle(), "?") + " · " + ImportContexte.nonVide(o.editionName(), "?")
                    + (o.observedPrice() == null ? "" : " · " + o.observedPrice() + " €");
            UUID editionId = o.mangaEditionId() == null ? null : ctx.editions.get(o.mangaEditionId());
            if (editionId == null) {
                ctx.cumul.ignore("marketObservations", sujet, "edition non importee");
                continue;
            }
            try {
                VolumeRange plage = o.volumeRangeStart() == null || o.volumeRangeEnd() == null ? null
                        : new VolumeRange(o.volumeRangeStart(), o.volumeRangeEnd());
                ListingPlatform plateforme = ImportContexte.enumOuNull(ListingPlatform.class, o.platform());
                Condition etat = ImportContexte.enumOuNull(Condition.class, o.observedCondition());
                List<MarketPriceObservation> existantes = existantesParEdition.computeIfAbsent(editionId,
                        marketPriceObservationRepository::findByEditionId);
                boolean doublon = existantes.stream().anyMatch(x -> Objects.equals(x.scope(), plage)
                        && x.observedPrice() != null && o.observedPrice() != null
                        && x.observedPrice().compareTo(o.observedPrice()) == 0
                        && Objects.equals(x.observedAt(), o.observedAt()) && x.platform() == plateforme);
                if (doublon) {
                    ctx.cumul.rattache("marketObservations", sujet, "releve identique deja present");
                    continue;
                }
                MarketPriceObservation creee;
                if (ImportContexte.enumOuNull(MarketObservationOrigin.class, o.origin()) == MarketObservationOrigin.LISTING_ANALYSIS) {
                    int nbTomes = o.volumeCount() != null ? o.volumeCount() : plage == null ? 1 : plage.expand().size();
                    creee = MarketPriceObservation.fromAnalyzedListing(editionId, plage, nbTomes, o.observedPrice(),
                            plateforme, etat, o.observedAt(), null, o.sourceUrl());
                } else {
                    creee = MarketPriceObservation.record_(editionId, plage, o.observedPrice(), plateforme, etat,
                            o.observedAt(), o.note());
                }
                if (ctx.ecrire) {
                    marketPriceObservationRepository.save(creee);
                }
                ctx.cumul.cree("marketObservations");
            } catch (IllegalArgumentException ex) {
                ctx.cumul.ignore("marketObservations", sujet, ex.getMessage());
            }
        }
    }

    private void preferences(ImportContexte ctx) {
        ctx.cumul.section("collectorPreferences", "Preferences d'analyse d'achat");
        ExportDocument.CollectorPreferencesExport p = ctx.doc.collectorPreferences();
        if (p == null) {
            return;
        }
        try {
            List<EditionTier> hierarchie = ImportContexte.liste(p.editionTierRanking()).stream()
                    .map(t -> ImportContexte.enumOuNull(EditionTier.class, t)).filter(Objects::nonNull).toList();
            WeightLevel importance = Optional.ofNullable(ImportContexte.enumOuNull(WeightLevel.class, p.conditionImportance()))
                    .orElse(WeightLevel.HIGH);
            Map<VerdictFactor, Integer> poids = new HashMap<>();
            if (p.factorWeights() != null) {
                p.factorWeights().forEach((k, v) -> {
                    VerdictFactor facteur = ImportContexte.enumOuNull(VerdictFactor.class, k);
                    if (facteur != null && v != null) {
                        poids.put(facteur, v);
                    }
                });
            }
            CollectorPreferences nouvelles = new CollectorPreferences(hierarchie,
                    p.avoidOutdatedEditionWhenBetterExistsOrAnnounced(), importance,
                    p.minimumDiscountVsRetailPercent(), poids);
            if (ctx.ecrire) {
                collectorPreferencesRepository.save(nouvelles);
            }
            // The only place where the import REPLACES: a preference has
            // no possible duplicate, and the one in the file is the one
            // to restore. Said as is in the report.
            ctx.cumul.remplace("collectorPreferences", "Profil de collectionneur",
                    "les preferences actuelles seront remplacees par celles du fichier");
        } catch (IllegalArgumentException ex) {
            ctx.cumul.ignore("collectorPreferences", "Profil de collectionneur", ex.getMessage());
        }
    }
}
