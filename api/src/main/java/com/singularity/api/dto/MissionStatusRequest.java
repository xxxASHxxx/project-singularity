package com.singularity.api.dto;

import jakarta.validation.constraints.*;
import lombok.Data;

@Data
public class MissionStatusRequest {
    @NotBlank
    private String status;  // RUNNING, COMPLETED, FAILED
    private String summary;
}
