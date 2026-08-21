package com.singularity.api.dto;

import jakarta.validation.constraints.*;
import lombok.Data;
import java.math.BigDecimal;

@Data
public class TelemetryRequest {
    @NotBlank(message = "deviceId is required")
    @Size(max = 64)
    private String deviceId;

    @NotBlank(message = "timestamp is required")
    private String timestamp;  // ISO-8601 string, parsed in service

    @NotNull
    @Min(0)
    private Integer zoneOccupancyCount;

    @NotNull
    @DecimalMin("0.00")
    @DecimalMax("100.00")
    private BigDecimal shelfFillRatio;

    @NotNull
    private Boolean surgeFlag;

    @NotNull
    private Boolean lowStockFlag;
}
