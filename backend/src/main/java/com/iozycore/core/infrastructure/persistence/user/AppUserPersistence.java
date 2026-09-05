package com.iozycore.core.infrastructure.persistence.user;

import com.iozycore.core.domain.user.AppUser;
import com.iozycore.core.domain.user.AppUserRepository;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

interface AppUserJpaRepository extends JpaRepository<AppUserJpaEntity, UUID> {
    Optional<AppUserJpaEntity> findByEmail(String email);

    /** `IgnoreCase` et non une égalité : l'unicité en base est posée sur `lower(pseudo)`. */
    Optional<AppUserJpaEntity> findByPseudoIgnoreCase(String pseudo);
}

@Repository
@Transactional
class JpaAppUserRepositoryAdapter implements AppUserRepository {

    private final AppUserJpaRepository jpaRepository;

    JpaAppUserRepositoryAdapter(AppUserJpaRepository jpaRepository) {
        this.jpaRepository = jpaRepository;
    }

    @Override
    public AppUser save(AppUser user) {
        return toDomain(jpaRepository.save(toJpa(user)));
    }

    @Override
    public Optional<AppUser> findByEmail(String email) {
        return jpaRepository.findByEmail(AppUser.normaliserEmail(email)).map(JpaAppUserRepositoryAdapter::toDomain);
    }

    @Override
    public Optional<AppUser> findByPseudo(String pseudo) {
        return jpaRepository.findByPseudoIgnoreCase(AppUser.normaliserPseudo(pseudo))
                .map(JpaAppUserRepositoryAdapter::toDomain);
    }

    @Override
    public Optional<AppUser> findById(UUID id) {
        return jpaRepository.findById(id).map(JpaAppUserRepositoryAdapter::toDomain);
    }

    @Override
    public List<AppUser> lister() {
        return jpaRepository.findAll().stream()
                .map(JpaAppUserRepositoryAdapter::toDomain)
                .sorted(Comparator.comparing(AppUser::createdAt).thenComparing(AppUser::id))
                .toList();
    }

    @Override
    public void supprimer(UUID id) {
        jpaRepository.deleteById(id);
    }

    @Override
    public boolean isEmpty() {
        // `count() == 0` plutôt qu'un `findAll().isEmpty()` : la question posée
        // est « y a-t-il déjà quelqu'un », pas « qui ».
        return jpaRepository.count() == 0;
    }

    private static AppUserJpaEntity toJpa(AppUser user) {
        return new AppUserJpaEntity(user.id(), user.email(), user.passwordHash(), user.pseudo(), user.admin(),
                user.createdAt());
    }

    private static AppUser toDomain(AppUserJpaEntity jpa) {
        return new AppUser(jpa.getId(), jpa.getEmail(), jpa.getPasswordHash(), jpa.getPseudo(), jpa.isAdmin(),
                jpa.getCreatedAt());
    }
}
