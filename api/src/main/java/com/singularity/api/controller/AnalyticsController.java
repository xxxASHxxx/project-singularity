package com.singularity.api.controller;

import com.singularity.api.dto.AnalyticsDto;
import com.singularity.api.service.AnalyticsService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.concurrent.TimeUnit;

/**
 * REST endpoint for operational analytics.
 *
 * <h2>GET /api/v1/analytics</h2>
 * Returns an {@link AnalyticsDto} snapshot aggregated live from the database.
 *
 * <p>The response carries a {@code Cache-Control: max-age=10, must-revalidate}
 * header so:
 * <ul>
 *   <li>The React dashboard (polling every 4 seconds) shares the same cached
 *       response rather than hammering the DB on every poll cycle.</li>
 *   <li>After 10 seconds the CDN/proxy or browser re-fetches a fresh snapshot.</li>
 * </ul>
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/analytics")
@RequiredArgsConstructor
public class AnalyticsController {

    private final AnalyticsService analyticsService;

    @GetMapping
    public ResponseEntity<AnalyticsDto> getAnalytics() {
        log.debug("Analytics snapshot requested");
        AnalyticsDto snapshot = analyticsService.getSnapshot();
        return ResponseEntity.ok()
                .cacheControl(CacheControl.maxAge(10, TimeUnit.SECONDS).mustRevalidate())
                .body(snapshot);
    }
}
