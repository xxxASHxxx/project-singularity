package com.singularity.api.repository;

import com.singularity.api.model.MissionArtifact;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface MissionArtifactRepository extends JpaRepository<MissionArtifact, Long> {
    List<MissionArtifact> findByMissionId(Long missionId);
}
