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

    /** A question to Izy; a missing or blank question asks what deserves attention. */
    public record GuideRequest(String question) {
    }

    public record GuideResponse(String text, boolean ai, String note) {
    }

    @Operation(summary = "This week: the lead, also this week, the number, almost done, the shelves (each may be empty)")
    @GetMapping("/week")
    public HomeWeekResponse week() {
        return HomeWeekResponse.from(home.week());
    }

    @Operation(summary = "Izy answers a question about the collection (a language model when configured, a computed sentence otherwise)")
    @PostMapping("/guide")
    public GuideResponse guide(@RequestBody(required = false) GuideRequest request) {
        GuideService.GuideAnswer answer = guide.ask(request == null ? null : request.question());
        return new GuideResponse(answer.text(), answer.ai(), answer.note());
    }
}
