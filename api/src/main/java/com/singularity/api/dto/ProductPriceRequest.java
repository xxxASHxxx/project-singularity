package com.singularity.api.dto;

import jakarta.validation.constraints.*;
import lombok.Data;
import java.math.BigDecimal;

@Data
public class ProductPriceRequest {
    @NotNull
    @DecimalMin("0.01")
    private BigDecimal currentPrice;
    private Integer stockQty;
    private String rationale;
}
