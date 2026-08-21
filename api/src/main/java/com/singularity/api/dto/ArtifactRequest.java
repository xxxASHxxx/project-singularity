package com.singularity.api.dto;

import jakarta.validation.constraints.*;
import lombok.Data;

@Data
public class ArtifactRequest {
    @NotBlank
    private String artifactType;  // SCREENSHOT, RECORDING_URL, PLAN_MD, LOG

    @NotBlank
    @Size(max = 512)
    private String storagePath;
}
