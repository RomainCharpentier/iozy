package com.iozycore.manga.api;

import com.iozycore.manga.insights.ReadingList;
import com.iozycore.manga.insights.ReadingListService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Les lectures d'un manga : ce qu'il reste à lire. Même route qu'avant le
 * Lot 133 (/api/insights/reading-list), dans le paquet de son univers.
 */
@RestController
@RequestMapping("/api/insights")
@Tag(name = "Insights - mangas", description = "Ce qu'il reste à lire, série par série")
public class MangaInsightsController {

    private final ReadingListService readingListService;

    public MangaInsightsController(ReadingListService readingListService) {
        this.readingListService = readingListService;
    }

    @Operation(summary = "Ce qu'il reste a lire : par serie, le prochain tome possede sans experience. "
            + "Entierement calcule a partir des possessions et des experiences, aucune liste a tenir a jour")
    @GetMapping("/reading-list")
    public ReadingList readingList() {
        return readingListService.compute();
    }
}
