package com.iozycore.core.api.home;

import com.iozycore.core.api.dto.HomeDtos.HomeWeekResponse;
import com.iozycore.core.application.home.GuideService;
import com.iozycore.core.application.home.HomeWeekService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/home")
@Tag(name = "Home", description = "The home page: this week for the collection")
@RequiredArgsConstructor
public class HomeController {

    private final HomeWeekService home;
    private final GuideService guide;

    @Operation(summary = "This week: the lead, also this week, the number, almost done, the shelves (each may be empty)")
    @GetMapping("/week")
    public HomeWeekResponse week() {
        return HomeWeekResponse.from(home.week());
    }

    @Operation(summary = "Works the account does not own and may like: proposed by a language model, each one confirmed by a catalog source")
    @GetMapping("/recommendations")
    public GuideService.Recommendations recommendations() {
        return guide.recommend();
    }
}
