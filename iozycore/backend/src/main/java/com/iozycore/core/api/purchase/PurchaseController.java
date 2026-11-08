package com.iozycore.core.api.purchase;

import com.iozycore.core.api.dto.PurchaseDtos.AcquireRequest;
import com.iozycore.core.api.dto.PurchaseDtos.AcquiredResponse;
import com.iozycore.core.api.dto.PurchaseDtos.BudgetRequest;
import com.iozycore.core.api.dto.PurchaseDtos.BudgetResponse;
import com.iozycore.core.api.dto.PurchaseDtos.MonthResponse;
import com.iozycore.core.api.dto.PurchaseDtos.ToBuyLineResponse;
import com.iozycore.core.application.purchase.PurchaseService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/purchases")
@Tag(name = "Purchases", description = "The to-buy page: what to buy, this month's spending, the budget")
@RequiredArgsConstructor
public class PurchaseController {

    private final PurchaseService purchases;

    @Operation(summary = "What to buy: upcoming releases, what completes an ongoing work, wishes")
    @GetMapping("/to-buy")
    public List<ToBuyLineResponse> toBuy() {
        return purchases.toBuy().stream().map(ToBuyLineResponse::from).toList();
    }

    @Operation(summary = "What was spent this month (by purchase date) and the monthly budget")
    @GetMapping("/month")
    public MonthResponse month() {
        return MonthResponse.from(purchases.thisMonth(), purchases.budget().orElse(null));
    }

    @Operation(summary = "The monthly budget, null when there is none")
    @GetMapping("/budget")
    public BudgetResponse budget() {
        return new BudgetResponse(purchases.budget().orElse(null));
    }

    @Operation(summary = "Set the monthly budget; null removes it")
    @PutMapping("/budget")
    public BudgetResponse setBudget(@RequestBody BudgetRequest request) {
        return new BudgetResponse(purchases.setBudget(request == null ? null : request.monthlyBudget()).orElse(null));
    }

    @Operation(summary = "Je l'ai: own one element of a work (new copy, bought today, no price)")
    @PostMapping("/acquire")
    @ResponseStatus(HttpStatus.CREATED)
    public AcquiredResponse acquire(@RequestBody AcquireRequest request) {
        if (request == null) {
            throw new IllegalArgumentException("Il faut dire quelle œuvre et quel élément tu as");
        }
        return AcquiredResponse.from(purchases.acquire(request.entityId(), request.elementKey()));
    }
}
