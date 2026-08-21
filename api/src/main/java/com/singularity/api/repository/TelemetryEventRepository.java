package com.singularity.api.repository;

import com.singularity.api.model.TelemetryEvent;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface TelemetryEventRepository extends JpaRepository<TelemetryEvent, Long> {
    Optional<TelemetryEvent> findByDeviceIdAndRecordedAt(String deviceId, LocalDateTime recordedAt);
    List<TelemetryEvent> findAllByOrderByRecordedAtDesc(Pageable pageable);
}
