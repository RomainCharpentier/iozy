package com.iozycore.infrastructure.persistence.loan;

import com.iozycore.domain.loan.Loan;
import com.iozycore.domain.loan.LoanRepository;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

interface LoanJpaRepository extends JpaRepository<LoanJpaEntity, UUID> {
    List<LoanJpaEntity> findByOwnershipId(UUID ownershipId);
    List<LoanJpaEntity> findByReturnedAtIsNull();
}

@Repository
@Transactional
class JpaLoanRepositoryAdapter implements LoanRepository {

    private final LoanJpaRepository jpaRepository;

    JpaLoanRepositoryAdapter(LoanJpaRepository jpaRepository) {
        this.jpaRepository = jpaRepository;
    }

    @Override
    public Loan save(Loan loan) {
        LoanJpaEntity saved = jpaRepository.save(toJpa(loan));
        return toDomain(saved);
    }

    @Override
    public Optional<Loan> findById(UUID id) {
        return jpaRepository.findById(id).map(JpaLoanRepositoryAdapter::toDomain);
    }

    @Override
    public List<Loan> findByOwnershipId(UUID ownershipId) {
        return jpaRepository.findByOwnershipId(ownershipId).stream()
                .map(JpaLoanRepositoryAdapter::toDomain)
                .collect(Collectors.toList());
    }

    @Override
    public List<Loan> findAllActive() {
        return jpaRepository.findByReturnedAtIsNull().stream()
                .map(JpaLoanRepositoryAdapter::toDomain)
                .collect(Collectors.toList());
    }

    private static LoanJpaEntity toJpa(Loan loan) {
        return new LoanJpaEntity(loan.id(), loan.ownershipId(), loan.ownerId(), loan.borrowerName(), loan.lentAt(),
                loan.returnedAt().orElse(null), loan.note());
    }

    private static Loan toDomain(LoanJpaEntity jpa) {
        return Loan.reconstitute(jpa.getId(), jpa.getOwnershipId(), jpa.getOwnerId(), jpa.getBorrowerName(),
                jpa.getLentAt(), jpa.getReturnedAt(), jpa.getNote());
    }
}
