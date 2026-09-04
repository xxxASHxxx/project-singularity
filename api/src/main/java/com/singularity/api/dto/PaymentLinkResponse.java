package com.singularity.api.dto;

import lombok.Builder;
import lombok.Data;

/**
 * Response returned when a Razorpay Payment Link is successfully created.
 */
@Data
@Builder
public class PaymentLinkResponse {
    private Long missionId;
    private String paymentLinkId;
    private String paymentLinkUrl;
    private long amountPaise;      // amount in smallest currency unit (paise)
    private String currency;
    private String sku;
    private int reorderQty;
}
