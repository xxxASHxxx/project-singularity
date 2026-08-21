package com.singularity.api.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;
import lombok.Data;

@Data
@Configuration
@ConfigurationProperties(prefix = "app")
public class AppConfig {
    private boolean autoApprove = false;
    private int surgeThreshold = 4;
    private int lowStockThreshold = 20;
}
