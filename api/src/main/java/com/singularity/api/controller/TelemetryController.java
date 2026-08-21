package com.singularity.api.controller;

import com.singularity.api.dto.TelemetryRequest;
import com.singularity.api.dto.TelemetryResponse;
import com.singularity.api.model.TelemetryEvent;
import com.singularity.api.service.TelemetryService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/telemetry")
@RequiredArgsConstructor
public class TelemetryController {

    private final TelemetryService telemetryService;

    @PostMapping
    public ResponseEntity<TelemetryResponse> ingest(@Valid @RequestBody TelemetryRequest req) {
        TelemetryResponse response = telemetryService.ingest(req);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/latest")
    public ResponseEntity<List<TelemetryEvent>> getLatest(
            @RequestParam(defaultValue = "50") int n) {
        return ResponseEntity.ok(telemetryService.getLatest(n));
    }
}
