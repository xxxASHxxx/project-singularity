package com.singularity.api.repository;

import com.singularity.api.model.AgentMission;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface AgentMissionRepository extends JpaRepository<AgentMission, Long> {
    List<AgentMission> findByMissionTypeAndStatus(
        AgentMission.MissionType type,
        AgentMission.MissionStatus status
    );
    List<AgentMission> findByStatus(AgentMission.MissionStatus status);
    List<AgentMission> findAllByOrderByCreatedAtDesc();
}
