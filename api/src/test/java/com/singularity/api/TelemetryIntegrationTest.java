package com.singularity.api;

import com.singularity.api.model.AgentMission;
import com.singularity.api.repository.AgentMissionRepository;
import com.singularity.api.repository.TelemetryEventRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.containers.MySQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@Testcontainers
public class TelemetryIntegrationTest {

    @Container
    @ServiceConnection
    static MySQLContainer<?> mysql = new MySQLContainer<>("mysql:8")
            .withDatabaseName("singularity")
            .withUsername("singularity")
            .withPassword("singularity_pass");

    @Autowired MockMvc mvc;
    @Autowired TelemetryEventRepository telemetryRepo;
    @Autowired AgentMissionRepository missionRepo;

    @BeforeEach
    void setUp() {
        missionRepo.deleteAll();
        telemetryRepo.deleteAll();
    }

    private static final String SURGE_PAYLOAD = """
        {
            "deviceId": "test-node",
            "timestamp": "2026-08-21T10:00:00Z",
            "zoneOccupancyCount": 6,
            "shelfFillRatio": 50.0,
            "surgeFlag": true,
            "lowStockFlag": false
        }""";

    private static final String LOW_STOCK_PAYLOAD = """
        {
            "deviceId": "test-node",
            "timestamp": "2026-08-21T10:00:05Z",
            "zoneOccupancyCount": 2,
            "shelfFillRatio": 10.0,
            "surgeFlag": false,
            "lowStockFlag": true
        }""";

    @Test
    void surgeFlag_createsMission() throws Exception {
        mvc.perform(post("/api/v1/telemetry")
                .contentType(MediaType.APPLICATION_JSON)
                .content(SURGE_PAYLOAD))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.duplicate").value(false))
                .andExpect(jsonPath("$.missionIds").isArray());

        assertThat(missionRepo.findAll()).hasSize(1);
        assertThat(missionRepo.findAll().get(0).getMissionType()).isEqualTo(AgentMission.MissionType.RESTOCK);
    }

    @Test
    void lowStockFlag_createsMission() throws Exception {
        mvc.perform(post("/api/v1/telemetry")
                .contentType(MediaType.APPLICATION_JSON)
                .content(LOW_STOCK_PAYLOAD))
                .andExpect(status().isOk());

        assertThat(missionRepo.findAll().stream()
            .anyMatch(m -> m.getMissionType() == AgentMission.MissionType.REPRICE)).isTrue();
    }

    @Test
    void duplicate_telemetry_doesNotCreateSecondMission() throws Exception {
        // Post same payload twice
        mvc.perform(post("/api/v1/telemetry")
                .contentType(MediaType.APPLICATION_JSON)
                .content(SURGE_PAYLOAD))
                .andExpect(status().isOk());

        mvc.perform(post("/api/v1/telemetry")
                .contentType(MediaType.APPLICATION_JSON)
                .content(SURGE_PAYLOAD))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.duplicate").value(true));

        // Only one mission should exist
        assertThat(missionRepo.findAll()).hasSize(1);
    }

    @Test
    void approvalGate_transitionsPendingToApproved() throws Exception {
        // Create a mission
        mvc.perform(post("/api/v1/telemetry")
                .contentType(MediaType.APPLICATION_JSON)
                .content(SURGE_PAYLOAD))
                .andExpect(status().isOk());

        AgentMission mission = missionRepo.findAll().get(0);
        assertThat(mission.getStatus()).isEqualTo(AgentMission.MissionStatus.PENDING_APPROVAL);

        // Approve it
        mvc.perform(patch("/api/v1/missions/" + mission.getId() + "/approve"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("APPROVED"));

        AgentMission approved = missionRepo.findById(mission.getId()).orElseThrow();
        assertThat(approved.getStatus()).isEqualTo(AgentMission.MissionStatus.APPROVED);
    }

    @Test
    void invalidPayload_returns400() throws Exception {
        mvc.perform(post("/api/v1/telemetry")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"deviceId\": \"\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors").exists());
    }
}
