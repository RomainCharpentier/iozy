package com.iozycore.core.api.catalog;

import com.iozycore.core.metadata.CoverImageReader;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.net.URI;
import java.util.Optional;
import java.util.concurrent.TimeUnit;

/** A cover from a known host, served from this origin (see {@link CoverImageReader}). */
@RestController
@RequestMapping("/api/covers")
@Tag(name = "Covers")
@RequiredArgsConstructor
public class CoverImageController {

    private final CoverImageReader coverImageReader;

    @Operation(summary = "A cover from a known cover host, served from this origin to read its colors")
    @GetMapping("/image")
    public ResponseEntity<byte[]> image(@RequestParam String url) {
        Optional<URI> uri = CoverImageReader.allowedCoverUri(url);
        if (uri.isEmpty()) {
            return ResponseEntity.badRequest().build();
        }
        return coverImageReader.read(uri.get())
                .map(image -> ResponseEntity.ok()
                        .contentType(MediaType.parseMediaType(image.contentType()))
                        .cacheControl(CacheControl.maxAge(7, TimeUnit.DAYS).cachePrivate())
                        .body(image.bytes()))
                .orElseGet(() -> ResponseEntity.status(HttpStatus.BAD_GATEWAY).build());
    }
}
