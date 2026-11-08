package com.marketmind.config;

import com.marketmind.repository.UserRepository;
import com.marketmind.security.CurrentUserSnapshot;
import com.marketmind.security.CurrentUserVerifier;
import com.marketmind.security.JwtAuthenticationFilter;
import com.marketmind.security.JwtTokenValidator;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import jakarta.servlet.Filter;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Import;
import org.springframework.core.env.MapPropertySource;
import org.springframework.mock.web.MockServletContext;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.context.support.AnnotationConfigWebApplicationContext;
import org.springframework.web.servlet.config.annotation.EnableWebMvc;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;
import java.util.Map;
import java.util.Optional;
import java.util.Objects;

import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class SecurityConfigTest {
    private static final String SECRET = "security-test-key-with-at-least-thirty-two-bytes";
    private AnnotationConfigWebApplicationContext context;
    private MockMvc mvc;

    @BeforeEach
    void setUp() {
        start(Map.of());
    }

    private void start(Map<String, Object> properties) {
        if (context != null) {
            context.close();
        }
        context = new AnnotationConfigWebApplicationContext();
        context.setServletContext(new MockServletContext());
        context.getEnvironment().getPropertySources().addFirst(new MapPropertySource("test", properties));
        context.register(TestConfiguration.class);
        context.refresh();
        mvc = MockMvcBuilders.webAppContextSetup(Objects.requireNonNull(context))
                .addFilters(context.getBean("springSecurityFilterChain", Filter.class)).build();
    }

    @AfterEach
    void tearDown() { context.close(); }

    @Test
    void anonymousAndExpiredCredentialsReturn401SoClientsCanRefresh() throws Exception {
        mvc.perform(get("/api/v1/test")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/v1/test").header("Authorization", "Bearer " + token("cliente", -60)))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void validClientTokenCanUseAuthenticatedFallbackApi() throws Exception {
        mvc.perform(get("/api/v1/test").header("Authorization", "Bearer " + token("cliente", 300)))
                .andExpect(status().isOk());
    }

    @Test
    void authenticatedUserWithoutRoleStillGets403() throws Exception {
        mvc.perform(get("/api/v1/test").header("Authorization", "Bearer " + token("marketero", 300)))
                .andExpect(status().isForbidden());
    }

    @Test
    void localViteOriginIsAllowedByDefaultAndUnknownOriginIsRejected() throws Exception {
        mvc.perform(preflight("http://localhost:5173")).andExpect(status().isOk())
                .andExpect(header().string("Access-Control-Allow-Origin", "http://localhost:5173"));
        mvc.perform(preflight("https://otro-sitio.example")).andExpect(status().isForbidden());
    }

    @Test
    void productionOriginComesFromEnvironment() throws Exception {
        start(Map.of("CORS_ALLOWED_ORIGINS", "https://nexomark.vercel.app"));
        mvc.perform(preflight("https://nexomark.vercel.app")).andExpect(status().isOk())
                .andExpect(header().string("Access-Control-Allow-Origin", "https://nexomark.vercel.app"));
        mvc.perform(preflight("http://localhost:5173")).andExpect(status().isForbidden());
    }

    private org.springframework.test.web.servlet.RequestBuilder preflight(String origin) {
        return options("/api/v1/test").header("Origin", origin)
                .header("Access-Control-Request-Method", "GET")
                .header("Access-Control-Request-Headers", "authorization");
    }

    private String token(String role, int seconds) {
        long id = "cliente".equals(role) ? 1L : 2L;
        return Jwts.builder().claim("user_id", id).claim("role", role).claim("token_version", 0)
                .claim("token_type", "access").expiration(Date.from(Instant.now().plusSeconds(seconds)))
                .signWith(Keys.hmacShaKeyFor(SECRET.getBytes(StandardCharsets.UTF_8))).compact();
    }

    @Configuration
    @EnableWebMvc
    @Import(SecurityConfig.class)
    static class TestConfiguration {
        @Bean JwtTokenValidator validator() { return new JwtTokenValidator(SECRET); }
        @Bean UserRepository users() {
            UserRepository repository = mock(UserRepository.class);
            when(repository.findCurrentSnapshotById(1L)).thenReturn(Optional.of(new CurrentUserSnapshot("alice@example.com", "cliente", true, 0)));
            when(repository.findCurrentSnapshotById(2L)).thenReturn(Optional.of(new CurrentUserSnapshot("marketer@example.com", "marketero", true, 0)));
            return repository;
        }
        @Bean CurrentUserVerifier verifier(UserRepository repository) { return new CurrentUserVerifier(repository); }
        @Bean JwtAuthenticationFilter authentication(JwtTokenValidator validator, CurrentUserVerifier verifier) {
            return new JwtAuthenticationFilter(validator, verifier);
        }
        @Bean TestController controller() { return new TestController(); }
    }

    @RestController
    static class TestController {
        @GetMapping("/api/v1/test")
        @PreAuthorize("hasRole('CLIENTE')")
        public String clientOnly() { return "ok"; }
    }
}
