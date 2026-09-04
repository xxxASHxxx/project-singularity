package com.singularity.api.repository;

import com.singularity.api.model.TelemetryEvent;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface TelemetryEventRepository extends JpaRepository<TelemetryEvent, Long> {

    Optional<TelemetryEvent> findByDeviceIdAndRecordedAt(String deviceId, LocalDateTime recordedAt);
    List<TelemetryEvent> findAllByOrderByRecordedAtDesc(Pageable pageable);

    // ── Analytics queries ────────────────────────────────────────────────────

    /** Count of surge events recorded in the last 24 hours. */
    @Query(value = "SELECT COUNT(*) FROM telemetry_events " +
                   "WHERE surge_flag = TRUE AND recorded_at >= NOW() - INTERVAL 24 HOUR",
           nativeQuery = true)
    long countSurgeEventsLast24h();

    /** Count of low-stock events recorded in the last 24 hours. */
    @Query(value = "SELECT COUNT(*) FROM telemetry_events " +
                   "WHERE low_stock_flag = TRUE AND recorded_at >= NOW() - INTERVAL 24 HOUR",
           nativeQuery = true)
    long countLowStockEventsLast24h();

    /** Rolling average zone occupancy count across all telemetry events. */
    @Query(value = "SELECT AVG(zone_occupancy_count) FROM telemetry_events",
           nativeQuery = true)
    Double avgOccupancy();

    /** Rolling average shelf fill ratio across all telemetry events. */
    @Query(value = "SELECT AVG(shelf_fill_ratio) FROM telemetry_events",
           nativeQuery = true)
    Double avgShelfFill();
}
