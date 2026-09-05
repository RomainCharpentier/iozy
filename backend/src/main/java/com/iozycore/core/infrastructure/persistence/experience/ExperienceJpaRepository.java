package com.iozycore.core.infrastructure.persistence.experience;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ExperienceJpaRepository extends JpaRepository<ExperienceJpaEntity, UUID> {

    /**
     * Charger par identifiant, mais PAR UNE REQUÊTE.
     *
     * <p>{@code findById} de JPA charge par clé primaire sans passer par une
     * requête : Hibernate n'y applique pas le cloisonnement par propriétaire
     * (voir ProprietaireCourant), et la ligne d'un AUTRE compte remonte -
     * constaté en écrivant le test d'isolation, qui passait sur les listes et
     * échouait sur les chargements par identifiant. Cette variante est une
     * requête dérivée, donc filtrée comme les autres.
     */
    Optional<ExperienceJpaEntity> findOneById(UUID id);
    List<ExperienceJpaEntity> findByEntityId(UUID entityId);
    boolean existsByEntityId(UUID entityId);
}
