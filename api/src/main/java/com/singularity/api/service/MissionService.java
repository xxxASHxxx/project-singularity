package com.singularity.api.service;

import com.singularity.api.dto.ArtifactRequest;
import com.singularity.api.dto.MissionStatusRequest;
import com.singularity.api.model.AgentMission;
import com.singularity.api.model.AgentMission.MissionStatus;
import com.singularity.api.model.MissionArtifact;
import com.singularity.api.repository.AgentMissionRepository;
import com.singularity.api.repository.MissionArtifactRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Set;

@Slf4j
@Service
@RequiredArgsConstructor
public class MissionService {

    private final AgentMissionRepository missionRepo;
    private final MissionArtifactRepository artifactRepo;

    // Allowed forward transitions
    private static final Set<MissionStatus> APPROVABLE = Set.of(MissionStatus.PENDING_APPROVAL);

    public List<AgentMission> listMissions(String type, String status) {
        if (type != null && status != null) {
            return missionRepo.findByMissionTypeAndStatus(
                AgentMission.MissionType.valueOf(type.toUpperCase()),
                MissionStatus.valueOf(status.toUpperCase()));
        }
        if (status != null) {
            return missionRepo.findByStatus(MissionStatus.valueOf(status.toUpperCase()));
        }
        return missionRepo.findAllByOrderByCreatedAtDesc();
    }

    @Transactional
    public AgentMission approve(Long id) {
        AgentMission mission = getOrThrow(id);
        if (!APPROVABLE.contains(mission.getStatus())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                "Mission " + id + " cannot be approved from status " + mission.getStatus());
        }
        mission.setStatus(MissionStatus.APPROVED);
        mission.setStartedAt(LocalDateTime.now());
        log.info("Mission #{} approved", id);
        return missionRepo.save(mission);
    }

    @Transactional
    public MissionArtifact addArtifact(Long missionId, ArtifactRequest req) {
        getOrThrow(missionId);  // validate mission exists
        MissionArtifact artifact = new MissionArtifact();
        artifact.setMissionId(missionId);
        artifact.setArtifactType(MissionArtifact.ArtifactType.valueOf(req.getArtifactType()));
        artifact.setStoragePath(req.getStoragePath());
        return artifactRepo.save(artifact);
    }

    @Transactional
    public AgentMission updateStatus(Long id, MissionStatusRequest req) {
        AgentMission mission = getOrThrow(id);
        MissionStatus newStatus = MissionStatus.valueOf(req.getStatus().toUpperCase());

        // Validate transition
        if (!isValidTransition(mission.getStatus(), newStatus)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                "Invalid transition: " + mission.getStatus() + " → " + newStatus);
        }

        mission.setStatus(newStatus);
        if (newStatus == MissionStatus.RUNNING && mission.getStartedAt() == null) {
            mission.setStartedAt(LocalDateTime.now());
        }
        if (newStatus == MissionStatus.COMPLETED || newStatus == MissionStatus.FAILED) {
            mission.setCompletedAt(LocalDateTime.now());
        }
        if (req.getSummary() != null) {
            mission.setSummary(req.getSummary());
        }
        return missionRepo.save(mission);
    }

    public List<MissionArtifact> getArtifacts(Long missionId) {
        getOrThrow(missionId);
        return artifactRepo.findByMissionId(missionId);
    }

    private AgentMission getOrThrow(Long id) {
        return missionRepo.findById(id).orElseThrow(
            () -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Mission " + id + " not found"));
    }

    private boolean isValidTransition(MissionStatus from, MissionStatus to) {
        return switch (from) {
            case PENDING_APPROVAL -> to == MissionStatus.APPROVED || to == MissionStatus.FAILED;
            case APPROVED -> to == MissionStatus.RUNNING || to == MissionStatus.FAILED;
            case RUNNING -> to == MissionStatus.COMPLETED || to == MissionStatus.FAILED;
            default -> false;
        };
    }
}
