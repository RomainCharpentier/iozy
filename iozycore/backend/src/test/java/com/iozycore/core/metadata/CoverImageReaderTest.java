package com.iozycore.core.metadata;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import static org.assertj.core.api.Assertions.assertThat;

/** A cover URL can be typed by hand: this list is what keeps the server from calling any address. */
class CoverImageReaderTest {

    @Test
    void a_known_cover_host_is_called_in_https() {
        assertThat(CoverImageReader.allowedCoverUri("http://cf.geekdo-images.com/a/b.jpg?x=1"))
                .hasValueSatisfying(uri -> assertThat(uri.toString()).isEqualTo("https://cf.geekdo-images.com/a/b.jpg?x=1"));
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "http://localhost:8080/api/admin",
            "http://169.254.169.254/latest/meta-data",
            "https://postgres:5432/",
            "https://cf.geekdo-images.com.evil.test/a.jpg",
            "https://cf.geekdo-images.com@evil.test/a.jpg",
            "https://evil.test@cf.geekdo-images.com/a.jpg",
            "https://cf.geekdo-images.com:8443/a.jpg",
            "file:///etc/passwd",
            "not a url"
    })
    void anything_else_is_refused(String url) {
        assertThat(CoverImageReader.allowedCoverUri(url)).isEmpty();
    }
}
