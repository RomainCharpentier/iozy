package com.iozycore.core.application.purchase;

import com.iozycore.core.application.NotFoundException;
import com.iozycore.core.application.TomeResolver;
import com.iozycore.core.application.work.WorkReadModel;
import com.iozycore.core.domain.catalog.Entity;
import com.iozycore.core.domain.catalog.EntityRepository;
import com.iozycore.core.domain.catalog.Variant;
import com.iozycore.core.domain.ownership.Ownership;
import com.iozycore.core.domain.ownership.OwnershipCondition;
import com.iozycore.core.domain.ownership.OwnershipRepository;
import com.iozycore.core.domain.purchase.MonthSpending;
import com.iozycore.core.domain.purchase.MonthlyBudget;
import com.iozycore.core.domain.purchase.MonthlyBudgetRepository;
import com.iozycore.core.domain.purchase.ToBuyLine;
import com.iozycore.core.domain.purchase.ToBuyList;
import com.iozycore.core.domain.wishlist.WishlistEntry;
import com.iozycore.core.domain.wishlist.WishlistEntryRepository;
import com.iozycore.core.domain.work.DefaultWorkElements;
import com.iozycore.core.domain.work.WorkElement;
import com.iozycore.core.domain.work.WorkView;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.ZoneId;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * The "to buy" page (lot 216): what to buy, what was spent this month, the
 * optional budget, and "Je l'ai" on one element of a work, for every type.
 *
 * <h2>"Je l'ai" goes through the elements of the work</h2>
 * The line names a work and the key of one of its elements (lot 209). The
 * element says what to own: its catalog variant when it has one (a volume, a
 * game on a console, a variant of a custom type), the work as a whole (key
 * {@code work}), or a numbered gap nobody catalogued yet - that volume is
 * made to exist first, in the edition of its nearest catalogued neighbour,
 * as quick add does. The wish on that same object closes, like after any
 * acquisition.
 *
 * <h2>The collector's calendar</h2>
 * "This month" and "today" are read in the collector's time zone, as the
 * works read model does.
 */
@Service
@Transactional(readOnly = true)
public class PurchaseService {

    /** What one "Je l'ai" did - enough for the client to undo it. */
    public record Acquired(UUID ownershipId, UUID entityId, UUID variantId, boolean wishRemoved) {
    }

    private final WorkReadModel works;
    private final EntityRepository entityRepository;
    private final OwnershipRepository ownershipRepository;
    private final WishlistEntryRepository wishlistEntryRepository;
    private final MonthlyBudgetRepository budgetRepository;
    private final TomeResolver tomeResolver;
    private final ApplicationEventPublisher eventPublisher;
    private final Clock clock;

    @Autowired
    public PurchaseService(WorkReadModel works, EntityRepository entityRepository,
                           OwnershipRepository ownershipRepository, WishlistEntryRepository wishlistEntryRepository,
                           MonthlyBudgetRepository budgetRepository, TomeResolver tomeResolver,
                           ApplicationEventPublisher eventPublisher,
                           @Value("${iozycore.collector-time-zone:Europe/Paris}") String collectorTimeZone) {
        this(works, entityRepository, ownershipRepository, wishlistEntryRepository, budgetRepository, tomeResolver,
                eventPublisher, Clock.system(ZoneId.of(collectorTimeZone)));
    }

    PurchaseService(WorkReadModel works, EntityRepository entityRepository, OwnershipRepository ownershipRepository,
                    WishlistEntryRepository wishlistEntryRepository, MonthlyBudgetRepository budgetRepository,
                    TomeResolver tomeResolver, ApplicationEventPublisher eventPublisher, Clock clock) {
        this.works = works;
        this.entityRepository = entityRepository;
        this.ownershipRepository = ownershipRepository;
        this.wishlistEntryRepository = wishlistEntryRepository;
        this.budgetRepository = budgetRepository;
        this.tomeResolver = tomeResolver;
        this.eventPublisher = eventPublisher;
        this.clock = clock;
    }

    /** See {@link ToBuyList}. */
    public List<ToBuyLine> toBuy() {
        return ToBuyList.of(works.works(), LocalDate.now(clock));
    }

    /** See {@link MonthSpending} for which date and which copies. */
    public MonthSpending thisMonth() {
        return MonthSpending.of(ownershipRepository.findAll(), YearMonth.now(clock));
    }

    public Optional<BigDecimal> budget() {
        return budgetRepository.find().map(MonthlyBudget::amount);
    }

    /**
     * Sets the monthly budget; {@code null} removes it (no budget shown).
     *
     * @throws IllegalArgumentException the amount is not strictly positive, or absurdly high
     */
    @Transactional
    public Optional<BigDecimal> setBudget(BigDecimal amount) {
        if (amount == null) {
            budgetRepository.delete();
            return Optional.empty();
        }
        MonthlyBudget saved = budgetRepository.find()
                .map(existing -> existing.changeTo(amount, clock.instant()))
                .orElseGet(() -> MonthlyBudget.create(amount, clock.instant()));
        return Optional.of(budgetRepository.save(saved).amount());
    }

    /**
     * "Je l'ai" on one element of a work: one copy, new, bought today, no price.
     *
     * @throws NotFoundException        the work or the element does not exist
     * @throws IllegalArgumentException no work or element named
     * @throws IllegalStateException    the element is already owned
     */
    @Transactional
    public Acquired acquire(UUID entityId, String elementKey) {
        if (entityId == null || elementKey == null || elementKey.isBlank()) {
            throw new IllegalArgumentException("Il faut dire quelle œuvre et quel élément tu as");
        }
        WorkView view = works.work(entityId);
        WorkElement element = view.elements().stream()
                .map(WorkView.CountedElement::element)
                .filter(e -> e.key().equals(elementKey))
                .findFirst()
                .orElseThrow(() -> new NotFoundException("Élément introuvable dans cette œuvre : " + elementKey));
        if (element.state() == WorkElement.State.OWNED) {
            throw new IllegalStateException("Tu as déjà « " + element.label() + " »");
        }
        Entity entity = entityRepository.findById(entityId)
                .orElseThrow(() -> new NotFoundException("Œuvre introuvable : " + entityId));

        UUID variantId = element.variantId();
        boolean wholeWork = DefaultWorkElements.WHOLE_WORK_KEY.equals(element.key());
        if (variantId == null && !wholeWork && element.number() != null) {
            String edition = editionNear(entity, view, element.number());
            variantId = tomeResolver.resoudreEtSauver(entity, element.number(), edition).variant().id();
        }

        Ownership ownership = Ownership.acquire(entityId, variantId, OwnershipCondition.NEW,
                LocalDate.now(clock), null);
        Ownership saved = ownershipRepository.save(ownership);
        Optional<WishlistEntry> wish = variantId != null
                ? wishlistEntryRepository.findByVariantId(variantId)
                : wishlistEntryRepository.findAllByEntityId(entityId).stream()
                        .filter(entry -> entry.variantId().isEmpty())
                        .findFirst();
        wish.ifPresent(entry -> wishlistEntryRepository.deleteById(entry.id()));
        ownership.pullDomainEvents().forEach(eventPublisher::publishEvent);
        return new Acquired(saved.id(), entityId, variantId, wish.isPresent());
    }

    /**
     * The edition of the catalogued volume closest in number: the elements of a
     * series all come from one edition, so a gap belongs to the same one.
     * {@code null} when no neighbour is catalogued (quick add does the same).
     */
    private static String editionNear(Entity entity, WorkView view, int number) {
        return view.elements().stream()
                .map(WorkView.CountedElement::element)
                .filter(e -> e.variantId() != null && e.number() != null)
                .min(Comparator.comparingInt(e -> Math.abs(e.number() - number)))
                .flatMap(e -> entity.variants().stream().filter(v -> v.id().equals(e.variantId())).findFirst())
                .map(Variant::attributes)
                .map(attributes -> attributes.get("edition"))
                .filter(String.class::isInstance)
                .map(String.class::cast)
                .filter(edition -> !edition.isBlank())
                .orElse(null);
    }
}
