package com.singularity.api.dto;

import lombok.Builder;
import lombok.Data;

import java.util.Map;

/**
 * Aggregated analytics snapshot returned by GET /api/v1/analytics.
 *
 * All durations are in seconds. Nullable fields indicate no data yet
 * (e.g. avgApprovalTimeSeconds is null when no mission has been approved).
 */
@Data
@Builder
public class AnalyticsDto {

    private MissionStats   missions;
    private TelemetryStats telemetry;

    @Data
    @Builder
    public static class MissionStats {
        /** Total missions ever created. */
        private long total;

        /** Count per status key (PENDING_APPROVAL, APPROVED, RUNNING, COMPLETED, FAILED). */
        private Map<String, Long> byStatus;

        /** Count per mission type (RESTOCK, REPRICE). */
        private Map<String, Long> byType;

        /**
         * Average seconds between mission creation and first approval.
         * Measures human response time on the approval gate.
         * Null if no mission has been approved yet.
         */
        private Double avgApprovalTimeSeconds;

        /**
         * Average seconds between agent start and mission completion.
         * Measures agent execution speed.
         * Null if no mission has completed yet.
         */
        private Double avgCompletionTimeSeconds;

        /**
         * Percentage of non-pending missions that reached COMPLETED.
         * Formula: COMPLETED / (COMPLETED + FAILED) * 100.
         * Null if no terminal mission exists yet.
         */
        private Double successRate;
    }

    @Data
    @Builder
    public static class TelemetryStats {
        /** Total telemetry events ever recorded. */
        private long totalEvents;

        /** Distinct surge events in the past 24 hours. */
        private long surgeEventsLast24h;

        /** Distinct low-stock events in the past 24 hours. */
        private long lowStockEventsLast24h;

        /** Rolling average zone occupancy across all recorded events. */
        private Double avgOccupancy;

        /** Rolling average shelf fill ratio across all recorded events. */
        private Double avgShelfFill;
    }
}
