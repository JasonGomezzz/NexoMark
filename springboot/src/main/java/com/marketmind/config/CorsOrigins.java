package com.marketmind.config;

/**
 * Orígenes del navegador que pueden llamar a la API y abrir el WebSocket.
 * En producción se define CORS_ALLOWED_ORIGINS (separados por comas) con el dominio de la web.
 */
public final class CorsOrigins {

    public static final String DEFAULTS = "http://localhost:5173,http://localhost:5174,http://localhost:5175,"
            + "http://127.0.0.1:5173,http://127.0.0.1:5174,http://127.0.0.1:5175";

    public static final String PROPERTY = "${CORS_ALLOWED_ORIGINS:" + DEFAULTS + "}";

    private CorsOrigins() {
    }
}
