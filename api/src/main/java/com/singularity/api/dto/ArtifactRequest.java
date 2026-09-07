package com.singularity.api.dto;

import jakarta.validation.constraints.*;
import lombok.Data;

@Data
public class ArtifactRequest {
    @NotBlank(message = "Artifact type is required")
    @Size(max = 64, message = "Artifact type is too long")
    private String artifactType;  // SCREENSHOT, RECORDING_URL, PLAN_MD, LOG

    @NotBlank
    @Size(max = 16384)
    private String storagePath;
}
