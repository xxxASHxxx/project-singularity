package com.singularity.api.service;

import com.singularity.api.config.AppConfig;
import com.singularity.api.dto.TelemetryRequest;
import com.singularity.api.dto.TelemetryResponse;
import com.singularity.api.model.AgentMission;
import com.singularity.api.model.TelemetryEvent;
import com.singularity.api.repository.AgentMissionRepository;
import com.singularity.api.repository.TelemetryEventRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

@Slf4j
@Service
@RequiredArgsConstructor
public class TelemetryService {

    private final TelemetryEventRepository telemetryRepo;
    private final AgentMissionRepository missionRepo;
    private final AppConfig appConfig;

    @Transactional
    public TelemetryResponse ingest(TelemetryRequest req) {
        // Parse ISO-8601 timestamp
        LocalDateTime recordedAt = ZonedDateTime.parse(req.getTimestamp(),
                DateTimeFormatter.ISO_DATE_TIME).toLocalDateTime();

        // Idempotency check
        Optional<TelemetryEvent> existing = telemetryRepo.findByDeviceIdAndRecordedAt(
                req.getDeviceId(), recordedAt);

        TelemetryResponse response = new TelemetryResponse();

        if (existing.isPresent()) {
            log.info("Duplicate telemetry for device={} at={} — returning existing event",
                    req.getDeviceId(), recordedAt);
            response.setDuplicate(true);
            response.setEventId(existing.get().getId());
            // Return existing mission IDs
            response.setMissionIds(List.of());
            return response;
        }

        // Persist event
        TelemetryEvent event = new TelemetryEvent();
        event.setDeviceId(req.getDeviceId());
        event.setRecordedAt(recordedAt);
        event.setZoneOccupancyCount(req.getZoneOccupancyCount());
        event.setShelfFillRatio(req.getShelfFillRatio());
        event.setSurgeFlag(req.getSurgeFlag());
        event.setLowStockFlag(req.getLowStockFlag());
        event = telemetryRepo.save(event);

        List<Long> missionIds = new ArrayList<>();

        // Create missions based on flags
        if (Boolean.TRUE.equals(req.getSurgeFlag())) {
            AgentMission mission = createMission(event.getId(), AgentMission.MissionType.RESTOCK);
            missionIds.add(mission.getId());
            log.info("Created RESTOCK mission #{} for event #{}", mission.getId(), event.getId());
        }

        if (Boolean.TRUE.equals(req.getLowStockFlag())) {
            AgentMission mission = createMission(event.getId(), AgentMission.MissionType.REPRICE);
            missionIds.add(mission.getId());
            log.info("Created REPRICE mission #{} for event #{}", mission.getId(), event.getId());
        }

        response.setEventId(event.getId());
        response.setDuplicate(false);
        response.setMissionIds(missionIds);
        return response;
    }

    private AgentMission createMission(Long eventId, AgentMission.MissionType type) {
        AgentMission mission = new AgentMission();
        mission.setTriggeredByEventId(eventId);
        mission.setMissionType(type);
        AgentMission.MissionStatus initialStatus = appConfig.isAutoApprove()
                ? AgentMission.MissionStatus.APPROVED
                : AgentMission.MissionStatus.PENDING_APPROVAL;
        mission.setStatus(initialStatus);
        return missionRepo.save(mission);
    }

    public List<TelemetryEvent> getLatest(int n) {
        return telemetryRepo.findAllByOrderByRecordedAtDesc(PageRequest.of(0, n));
    }
}
