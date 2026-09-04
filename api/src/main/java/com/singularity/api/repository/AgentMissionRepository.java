package com.singularity.api.repository;

import com.singularity.api.model.AgentMission;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import java.util.List;

public interface AgentMissionRepository extends JpaRepository<AgentMission, Long> {

    List<AgentMission> findByMissionTypeAndStatus(
        AgentMission.MissionType type,
        AgentMission.MissionStatus status
    );
    List<AgentMission> findByStatus(AgentMission.MissionStatus status);
    List<AgentMission> findAllByOrderByCreatedAtDesc();

    // ── Analytics queries ────────────────────────────────────────────────────

    /** Returns rows of [status_string, count] for all statuses present. */
    @Query(value = "SELECT status, COUNT(*) FROM agent_missions GROUP BY status",
           nativeQuery = true)
    List<Object[]> countGroupedByStatus();

    /** Returns rows of [mission_type_string, count] for all types present. */
    @Query(value = "SELECT mission_type, COUNT(*) FROM agent_missions GROUP BY mission_type",
           nativeQuery = true)
    List<Object[]> countGroupedByType();

    /**
     * Average seconds from mission creation to when it was first set RUNNING
     * (i.e. how long humans took to approve it).
     * Only counts missions that have actually been started.
     */
    @Query(value = "SELECT AVG(TIMESTAMPDIFF(SECOND, created_at, started_at)) " +
                   "FROM agent_missions WHERE started_at IS NOT NULL",
           nativeQuery = true)
    Double avgApprovalTimeSeconds();

    /**
     * Average seconds from agent start to mission completion.
     * Only counts missions that have both timestamps.
     */
    @Query(value = "SELECT AVG(TIMESTAMPDIFF(SECOND, started_at, completed_at)) " +
                   "FROM agent_missions WHERE completed_at IS NOT NULL AND started_at IS NOT NULL",
           nativeQuery = true)
    Double avgCompletionTimeSeconds();

    /** Count of COMPLETED missions (used for success rate numerator). */
    @Query(value = "SELECT COUNT(*) FROM agent_missions WHERE status = 'COMPLETED'",
           nativeQuery = true)
    long countCompleted();

    /** Count of FAILED missions (used for success rate denominator). */
    @Query(value = "SELECT COUNT(*) FROM agent_missions WHERE status = 'FAILED'",
           nativeQuery = true)
    long countFailed();
}
