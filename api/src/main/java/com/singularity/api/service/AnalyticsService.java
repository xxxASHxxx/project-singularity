package com.singularity.api.service;

import com.singularity.api.dto.AnalyticsDto;
import com.singularity.api.repository.AgentMissionRepository;
import com.singularity.api.repository.TelemetryEventRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Aggregates operational metrics across missions and telemetry events.
 *
 * <p>All queries are read-only ({@code @Transactional(readOnly = true)}) so
 * the connection pool can route them to a read replica in a scaled deployment
 * without any code changes.
 *
 * <p>Success rate formula:
 * <pre>
 *   successRate = completed / (completed + failed) × 100
 *   → null when no terminal missions exist (avoids division-by-zero)
 * </pre>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AnalyticsService {

    private final AgentMissionRepository missionRepo;
    private final TelemetryEventRepository telemetryRepo;

    @Transactional(readOnly = true)
    public AnalyticsDto getSnapshot() {
        return AnalyticsDto.builder()
                .missions(buildMissionStats())
                .telemetry(buildTelemetryStats())
                .build();
    }

    // ── Missions ─────────────────────────────────────────────────────────────

    private AnalyticsDto.MissionStats buildMissionStats() {
        long total = missionRepo.count();

        Map<String, Long> byStatus = toMap(missionRepo.countGroupedByStatus());
        Map<String, Long> byType   = toMap(missionRepo.countGroupedByType());

        Double avgApproval    = round(missionRepo.avgApprovalTimeSeconds());
        Double avgCompletion  = round(missionRepo.avgCompletionTimeSeconds());

        long completed = missionRepo.countCompleted();
        long failed    = missionRepo.countFailed();
        Double successRate = null;
        if (completed + failed > 0) {
            successRate = Math.round((completed * 100.0 / (completed + failed)) * 10.0) / 10.0;
        }

        return AnalyticsDto.MissionStats.builder()
                .total(total)
                .byStatus(byStatus)
                .byType(byType)
                .avgApprovalTimeSeconds(avgApproval)
                .avgCompletionTimeSeconds(avgCompletion)
                .successRate(successRate)
                .build();
    }

    // ── Telemetry ─────────────────────────────────────────────────────────────

    private AnalyticsDto.TelemetryStats buildTelemetryStats() {
        long totalEvents        = telemetryRepo.count();
        long surgeEvents24h     = telemetryRepo.countSurgeEventsLast24h();
        long lowStockEvents24h  = telemetryRepo.countLowStockEventsLast24h();
        Double avgOccupancy     = round(telemetryRepo.avgOccupancy());
        Double avgShelfFill     = round(telemetryRepo.avgShelfFill());

        return AnalyticsDto.TelemetryStats.builder()
                .totalEvents(totalEvents)
                .surgeEventsLast24h(surgeEvents24h)
                .lowStockEventsLast24h(lowStockEvents24h)
                .avgOccupancy(avgOccupancy)
                .avgShelfFill(avgShelfFill)
                .build();
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    /**
     * Converts GROUP BY result rows (Object[]{key, count}) to a LinkedHashMap.
     * Insertion order is preserved so JSON output is stable across calls.
     */
    private Map<String, Long> toMap(List<Object[]> rows) {
        Map<String, Long> map = new LinkedHashMap<>();
        for (Object[] row : rows) {
            String key   = row[0].toString();
            Long   count = ((Number) row[1]).longValue();
            map.put(key, count);
        }
        return map;
    }

    /** Rounds a nullable Double to 2 decimal places. Returns null if input is null. */
    private Double round(Double value) {
        if (value == null) return null;
        return Math.round(value * 100.0) / 100.0;
    }
}
