package com.iozycore.core.application;

import com.iozycore.core.domain.catalog.EntityRepository;
import com.iozycore.core.domain.experience.ExperienceRepository;
import com.iozycore.core.domain.ownership.OwnershipRepository;
import com.iozycore.core.domain.shared.EntityDeletionNotAllowedException;
import org.springframework.stereotype.Service;

import java.util.UUID;
import java.util.List;

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
    /** Ce que chaque univers peut encore retenir - les éditions de référence d'un manga (Lot 133). */
    private final List<EntityDeletionGuard> guards;

    public EntityDeletionService(EntityRepository entityRepository,
                                  OwnershipRepository ownershipRepository,
                                  ExperienceRepository experienceRepository,
                                  List<EntityDeletionGuard> guards) {
        this.entityRepository = entityRepository;
        this.ownershipRepository = ownershipRepository;
        this.experienceRepository = experienceRepository;
        this.guards = guards;
    }

    public void delete(UUID entityId) {
        long ownershipCount = ownershipRepository.findByEntityId(entityId).size();
        long experienceCount = experienceRepository.findByEntityId(entityId).size();
        long editionCount = guards.stream().mapToLong(guard -> guard.referencesRestantes(entityId)).sum();

        if (ownershipCount > 0 || experienceCount > 0 || editionCount > 0) {
            throw new EntityDeletionNotAllowedException(entityId, ownershipCount, experienceCount, editionCount);
        }

        entityRepository.deleteById(entityId);
    }
}
