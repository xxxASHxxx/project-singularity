package com.singularity.api.model;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@Entity
@Table(name = "telemetry_events",
       uniqueConstraints = @UniqueConstraint(columnNames = {"device_id", "recorded_at"}))
public class TelemetryEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "device_id", nullable = false, length = 64)
    private String deviceId;

    @Column(name = "recorded_at", nullable = false)
    private LocalDateTime recordedAt;

    @Column(name = "zone_occupancy_count", nullable = false)
    private Integer zoneOccupancyCount;

    @Column(name = "shelf_fill_ratio", nullable = false, precision = 5, scale = 2)
    private BigDecimal shelfFillRatio;

    @Column(name = "surge_flag", nullable = false)
    private Boolean surgeFlag;

    @Column(name = "low_stock_flag", nullable = false)
    private Boolean lowStockFlag;

    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }
}
