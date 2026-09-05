package com.iozycore.application;

import com.iozycore.manga.metadata.bnf.BnfCouverture;
import com.iozycore.manga.domain.EditionTier;
import com.iozycore.domain.catalog.Entity;
import com.iozycore.domain.catalog.EntityRepository;
import com.iozycore.manga.domain.MangaEdition;
import com.iozycore.manga.domain.MangaEditionRepository;
import com.iozycore.domain.catalog.Variant;
import com.iozycore.domain.catalog.VariantLabels;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/**
 * Identifier-ou-créer le TOME d'une œuvre, sans aucune possession.
 * <p>
 * Pendant exact de {@link CatalogEntityResolver} un cran plus bas : celui-ci
 * fait exister la fiche de l'œuvre, celui-là fait exister le tome. Même
 * raison d'être, et même histoire - la règle vivait dans
 * {@link QuickAddService}, donc le seul moyen de faire entrer un tome au
 * catalogue était d'en acquérir un exemplaire.
 * <p>
 * Ce qui l'a rendue nécessaire : depuis que l'envie porte sur un tome
 * (migration V21), « je veux le tome 7 » a besoin d'un tome à désigner. Or
 * sur une fiche, la plupart des tomes manquants ne sont catalogués nulle
 * part - ils sont <em>déduits</em> du nombre total de tomes de l'édition (voir
 * {@code buildTiles}, statut {@code virtualMissing}). Sans ce point d'entrée,
 * « Je le veux » n'aurait fonctionné que sur les rares tomes déjà catalogués,
 * c'est-à-dire presque jamais.
 * <p>
 * La déduplication est celle de QuickAdd, inchangée : le libellé
 * {@link VariantLabels#of} fait foi, si bien qu'acheter ensuite un tome
 * qu'on avait mis en envies retombe sur le MÊME Variant - et referme donc
 * bien l'envie (voir {@code QuickAddService.retirerDesEnvies}).
 */
@Service
public class TomeResolver {

    private final EntityRepository entityRepository;
    private final MangaEditionRepository mangaEditionRepository;

    public TomeResolver(EntityRepository entityRepository, MangaEditionRepository mangaEditionRepository) {
        this.entityRepository = entityRepository;
        this.mangaEditionRepository = mangaEditionRepository;
    }

    /** Le Tome canonique de cette œuvre, et s'il existait déjà. */
    public record Resolution(Variant variant, boolean matchedExisting) {
    }

    /**
     * Rend le tome {@code volumeNumber} de cette œuvre dans cette édition, en
     * le créant s'il n'est pas encore catalogué, et en le reliant à son
     * Édition catalogue le cas échéant.
     * <p>
     * <b>Mute l'agrégat reçu et ne le sauvegarde pas</b> : l'appelant a
     * souvent d'autres modifications à y apporter dans la même transaction
     * (QuickAdd y ajoute une possession). Voir {@link #resoudreEtSauver} pour
     * l'appelant qui n'a que ça à faire.
     */
    public Resolution resoudre(Entity oeuvre, int volumeNumber, String edition, String jaquetteUrl) {
        String libelle = VariantLabels.of(volumeNumber, edition);
        Optional<Variant> existant = oeuvre.findVariantByLabel(libelle);
        Variant tome = existant.orElseGet(
                () -> oeuvre.addVariant(libelle, attributsDuTome(volumeNumber, edition, jaquetteUrl)));

        if (edition != null && !edition.isBlank()) {
            oeuvre.linkVariantToEdition(tome.id(), resoudreOuCreerEdition(oeuvre, edition.trim()));
        }
        return new Resolution(tome, existant.isPresent());
    }

    /** Variante sauvegardée, pour l'appelant dont c'est la seule écriture. */
    @Transactional
    public Resolution resoudreEtSauver(Entity oeuvre, int volumeNumber, String edition) {
        Resolution resolution = resoudre(oeuvre, volumeNumber, edition, null);
        entityRepository.save(oeuvre);
        return resolution;
    }

    /**
     * Identifier-ou-créer pour l'Édition catalogue, symétrique de la
     * déduplication Série/Tome. Cherche par entityId D'ABORD - entity.id() est
     * connu avec certitude ici, jamais besoin de repasser par une
     * correspondance de titre pour UNE Entity qu'on a déjà en main. Le repli
     * par titre ne sert plus que pour une édition pas encore reliée (ex: créée
     * depuis l'Analyse d'achat avant que cette série soit en collection) -
     * reliée ici même, opportunistement, dès qu'elle est retrouvée ainsi :
     * jamais l'inverse, on ne force jamais un entityId sur une édition qui en
     * a déjà un différent. Sans ce repli par ID en premier, un renommage de
     * Série aurait rendu une édition déjà reliée introuvable par
     * entity.title() (désormais différent de l'ancien MangaEdition.seriesTitle,
     * jamais mis à jour en cascade) et en aurait créé un doublon vide à chaque
     * nouvel ajout. Une édition réellement nouvelle est créée avec le strict
     * minimum connu (nom + tier OTHER, tout le reste null) - à enrichir plus
     * tard, jamais deviné à la création.
     */
    private UUID resoudreOuCreerEdition(Entity oeuvre, String nomEdition) {
        Optional<MangaEdition> parId = mangaEditionRepository.findByEntityIdAndEditionName(oeuvre.id(), nomEdition);
        if (parId.isPresent()) {
            return parId.get().id();
        }
        Optional<MangaEdition> parTitre = mangaEditionRepository.findBySeriesAndEdition(oeuvre.title(), nomEdition);
        if (parTitre.isPresent()) {
            MangaEdition edition = parTitre.get();
            if (edition.entityId() == null) {
                edition = mangaEditionRepository.save(edition.withEntityId(oeuvre.id()));
            }
            return edition.id();
        }
        MangaEdition creee = MangaEdition.create(oeuvre.id(), oeuvre.title(), nomEdition, EditionTier.OTHER,
                null, null, null, false, false, null);
        return mangaEditionRepository.save(creee).id();
    }

    private Map<String, Object> attributsDuTome(int volumeNumber, String edition, String jaquetteUrl) {
        Map<String, Object> attributs = new HashMap<>();
        attributs.put("volumeNumber", volumeNumber);
        if (edition != null && !edition.isBlank()) {
            attributs.put("edition", edition.trim());
        }
        // Même clé que COVER_IMAGE_ATTRIBUTE_KEY côté web/iOS (voir
        // lib/coverImage.ts) - convention partagée pour qu'une jaquette de
        // Variant se lise avec exactement la même fonction qu'une jaquette
        // d'Entity, seule la source (Entity.attributes vs Variant.attributes)
        // change à l'appel.
        // Une couverture BnF est verifiee ICI, au moment de la garder, et
        // non a l'affichage (voir BnfCouverture, Lot 127) : une adresse morte
        // n'est pas enregistree, le tome reste sans image et le rattrapage
        // pourra retenter.
        if (jaquetteUrl != null && !jaquetteUrl.isBlank() && BnfCouverture.estVivante(jaquetteUrl)) {
            attributs.put("coverImageUrl", jaquetteUrl);
        }
        return attributs;
    }
}
