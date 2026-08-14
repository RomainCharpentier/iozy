package com.iozycore.application;

import com.iozycore.domain.catalog.EntityRepository;
import com.iozycore.domain.catalog.MangaEditionRepository;
import com.iozycore.domain.experience.ExperienceRepository;
import com.iozycore.domain.ownership.OwnershipRepository;
import com.iozycore.domain.shared.EntityDeletionNotAllowedException;
import org.springframework.stereotype.Service;

import java.util.UUID;

/**
 * Traduit en couche application la règle validée à l'étape 7 : la
 * suppression d'une Entity est bloquée tant qu'il existe des Ownership
 * ou des Experience qui la référencent. Ce n'est pas au domaine de
 * connaître les repositories des autres agrégats (ils sont
 * indépendants), donc la règle est orchestrée ici plutôt que dans
 * l'agrégat Entity lui-même.
 * <p>
 * Modèle catalogue cible Série -> Édition -> Tome (étape 5) : bloquée aussi
 * tant qu'une Édition catalogue ({@code MangaEdition.entityId}) référence
 * encore cette Entity - sans cette garde, supprimer une Entity dont tous les
 * Tomes ont déjà été retirés un par un (voir VariantDeletionService) mais dont
 * une Édition survit encore (ex: des observations de marché existent pour
 * elle) rejetterait avec une erreur SQL brute plutôt qu'un message clair.
 */
@Service
public class EntityDeletionService {

    private final EntityRepository entityRepository;
    private final OwnershipRepository ownershipRepository;
    private final ExperienceRepository experienceRepository;
    private final MangaEditionRepository mangaEditionRepository;

    public EntityDeletionService(EntityRepository entityRepository,
                                  OwnershipRepository ownershipRepository,
                                  ExperienceRepository experienceRepository,
                                  MangaEditionRepository mangaEditionRepository) {
        this.entityRepository = entityRepository;
        this.ownershipRepository = ownershipRepository;
        this.experienceRepository = experienceRepository;
        this.mangaEditionRepository = mangaEditionRepository;
    }

    public void delete(UUID entityId) {
        long ownershipCount = ownershipRepository.findByEntityId(entityId).size();
        long experienceCount = experienceRepository.findByEntityId(entityId).size();
        long editionCount = mangaEditionRepository.findByEntityId(entityId).size();

        if (ownershipCount > 0 || experienceCount > 0 || editionCount > 0) {
            throw new EntityDeletionNotAllowedException(entityId, ownershipCount, experienceCount, editionCount);
        }

        entityRepository.deleteById(entityId);
    }
}
