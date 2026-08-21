package com.singularity.api.controller;

import com.singularity.api.dto.ArtifactRequest;
import com.singularity.api.dto.MissionStatusRequest;
import com.singularity.api.model.AgentMission;
import com.singularity.api.model.MissionArtifact;
import com.singularity.api.service.MissionService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/missions")
@RequiredArgsConstructor
public class MissionController {

    private final MissionService missionService;

    @GetMapping
    public ResponseEntity<List<AgentMission>> list(
            @RequestParam(required = false) String type,
            @RequestParam(required = false) String status) {
        return ResponseEntity.ok(missionService.listMissions(type, status));
    }

    @PatchMapping("/{id}/approve")
    public ResponseEntity<AgentMission> approve(@PathVariable Long id) {
        return ResponseEntity.ok(missionService.approve(id));
    }

    @PostMapping("/{id}/artifacts")
    public ResponseEntity<MissionArtifact> addArtifact(
            @PathVariable Long id,
            @Valid @RequestBody ArtifactRequest req) {
        return ResponseEntity.ok(missionService.addArtifact(id, req));
    }

    @PatchMapping("/{id}/status")
    public ResponseEntity<AgentMission> updateStatus(
            @PathVariable Long id,
            @Valid @RequestBody MissionStatusRequest req) {
        return ResponseEntity.ok(missionService.updateStatus(id, req));
    }

    @GetMapping("/{id}/artifacts")
    public ResponseEntity<List<MissionArtifact>> getArtifacts(@PathVariable Long id) {
        return ResponseEntity.ok(missionService.getArtifacts(id));
    }
}
