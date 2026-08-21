package com.singularity.api.dto;

import lombok.Data;
import java.util.List;

@Data
public class TelemetryResponse {
    private Long eventId;
    private boolean duplicate;
    private List<Long> missionIds;
}
