package com.marketmind.config;

import com.marketmind.websocket.ClientCampaignWebSocketHandler;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Bean;
import org.springframework.lang.NonNull;
import org.springframework.scheduling.concurrent.ThreadPoolTaskScheduler;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;

@Configuration
@EnableWebSocket
@RequiredArgsConstructor
public class WebSocketConfig implements WebSocketConfigurer {

    @Bean
    public static ThreadPoolTaskScheduler clientCampaignSocketScheduler() {
        ThreadPoolTaskScheduler scheduler = new ThreadPoolTaskScheduler();
        scheduler.setPoolSize(1);
        scheduler.setThreadNamePrefix("client-socket-expiry-");
        scheduler.setRemoveOnCancelPolicy(true);
        return scheduler;
    }

    @NonNull
    private final ClientCampaignWebSocketHandler clientCampaignWebSocketHandler;

    @Value(CorsOrigins.PROPERTY)
    private String[] allowedOrigins;

    @Override
    public void registerWebSocketHandlers(@NonNull WebSocketHandlerRegistry registry) {
        registry.addHandler(clientCampaignWebSocketHandler, "/ws/client-campaigns")
                .setAllowedOrigins(allowedOrigins);
    }
}
