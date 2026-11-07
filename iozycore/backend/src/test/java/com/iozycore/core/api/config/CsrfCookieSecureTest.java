package com.iozycore.core.api.config;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.web.csrf.CookieCsrfTokenRepository;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The XSRF-TOKEN cookie must be Secure whenever the session cookie is, even
 * when the request reached the server over plain HTTP behind a TLS proxy.
 */
class CsrfCookieSecureTest {

    @Test
    void the_token_cookie_is_secure_when_the_setting_is_on_even_over_http() {
        String cookie = writtenCookie(SecurityConfig.csrfTokenRepository(true), plainHttpRequest());

        assertThat(cookie).startsWith("XSRF-TOKEN=").contains("Secure");
    }

    @Test
    void without_the_setting_the_request_still_decides() {
        assertThat(writtenCookie(SecurityConfig.csrfTokenRepository(false), plainHttpRequest()))
                .doesNotContain("Secure");

        MockHttpServletRequest https = plainHttpRequest();
        https.setSecure(true);
        assertThat(writtenCookie(SecurityConfig.csrfTokenRepository(false), https)).contains("Secure");
    }

    @Test
    void the_token_cookie_stays_readable_by_the_client() {
        // The web client reads it to send it back as a header.
        assertThat(writtenCookie(SecurityConfig.csrfTokenRepository(true), plainHttpRequest()))
                .doesNotContain("HttpOnly");
    }

    private static MockHttpServletRequest plainHttpRequest() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setSecure(false);
        return request;
    }

    private static String writtenCookie(CookieCsrfTokenRepository repository, MockHttpServletRequest request) {
        MockHttpServletResponse response = new MockHttpServletResponse();
        repository.saveToken(repository.generateToken(request), request, response);
        return response.getHeader("Set-Cookie");
    }
}
