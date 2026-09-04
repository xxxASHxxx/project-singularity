package com.singularity.api.service;

import com.razorpay.PaymentLink;
import com.razorpay.RazorpayClient;
import com.razorpay.RazorpayException;
import com.singularity.api.dto.PaymentLinkResponse;
import com.singularity.api.model.AgentMission;
import com.singularity.api.model.Product;
import com.singularity.api.repository.AgentMissionRepository;
import com.singularity.api.repository.ProductRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.json.JSONObject;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.math.RoundingMode;

/**
 * Encapsulates all interactions with the Razorpay API.
 *
 * <p>Amounts are always transmitted in <strong>paise</strong> (the smallest
 * INR unit: 1 INR = 100 paise) as required by Razorpay's API contract.
 * Any floating-point price is rounded half-up to 2 decimal places before
 * conversion to avoid paise truncation errors.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class RazorpayService {

    private static final String CURRENCY = "INR";
    /**
     * Reorder base quantity used when no override is provided.
     * Matches the value in config/zones.json and agent_orchestration.py.
     */
    private static final int DEFAULT_REORDER_BASE_QTY = 50;

    private final RazorpayClient razorpayClient;
    private final AgentMissionRepository missionRepo;
    private final ProductRepository productRepo;

    /**
     * Creates a Razorpay Payment Link for a RESTOCK mission.
     *
     * <p>Amount computation:
     * <pre>
     *   reorderQty  = round((100 - shelfFillRatio) / 100 × reorderBaseQty)
     *   amountPaise = reorderQty × currentPrice × 100   (paise, no decimals)
     * </pre>
     *
     * @param missionId    the AgentMission to fulfil
     * @param shelfFill    current shelf fill ratio (0–100)
     * @return             the created payment link details
     * @throws ResponseStatusException 404 if mission or product not found
     * @throws ResponseStatusException 422 if Razorpay rejects the request
     */
    public PaymentLinkResponse createRestockPaymentLink(Long missionId, double shelfFill) {
        AgentMission mission = missionRepo.findById(missionId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Mission " + missionId + " not found"));

        if (mission.getMissionType() != AgentMission.MissionType.RESTOCK) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Mission " + missionId + " is not a RESTOCK mission");
        }

        // Pick the first product as the restock target (demo: one product per mission)
        Product product = productRepo.findAll().stream()
                .findFirst()
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "No products found in catalog"));

        // Compute reorder quantity
        int reorderQty = Math.max(1,
                (int) Math.round((100.0 - shelfFill) / 100.0 * DEFAULT_REORDER_BASE_QTY));

        // Convert to paise — scale to 2dp first to eliminate floating-point drift
        BigDecimal pricePerUnit = product.getCurrentPrice()
                .setScale(2, RoundingMode.HALF_UP);
        BigDecimal totalRupees  = pricePerUnit.multiply(BigDecimal.valueOf(reorderQty));
        long amountPaise        = totalRupees
                .multiply(BigDecimal.valueOf(100))
                .setScale(0, RoundingMode.HALF_UP)
                .longValueExact();

        log.info("Creating Razorpay Payment Link: mission={} sku={} qty={} total=₹{} ({}p)",
                missionId, product.getSku(), reorderQty, totalRupees, amountPaise);

        try {
            JSONObject request = new JSONObject();
            request.put("amount",      amountPaise);
            request.put("currency",    CURRENCY);
            request.put("description", String.format("Restock PO: %s × %d units",
                    product.getSku(), reorderQty));
            request.put("expire_by",   System.currentTimeMillis() / 1000 + 86400); // 24h TTL

            // Embed mission metadata in notes for webhook correlation
            JSONObject notes = new JSONObject();
            notes.put("mission_id",  missionId.toString());
            notes.put("sku",         product.getSku());
            notes.put("reorder_qty", String.valueOf(reorderQty));
            request.put("notes", notes);

            // Callback redirect after payment (demo: back to command center)
            JSONObject callback = new JSONObject();
            callback.put("url",    "http://localhost:5173");
            callback.put("method", "get");
            request.put("callback_url",    callback.getString("url"));
            request.put("callback_method", "get");

            PaymentLink link = razorpayClient.paymentLink.create(request);

            String linkId  = link.get("id");
            String linkUrl = link.get("short_url");

            log.info("Payment Link created: id={} url={}", linkId, linkUrl);

            return PaymentLinkResponse.builder()
                    .missionId(missionId)
                    .paymentLinkId(linkId)
                    .paymentLinkUrl(linkUrl)
                    .amountPaise(amountPaise)
                    .currency(CURRENCY)
                    .sku(product.getSku())
                    .reorderQty(reorderQty)
                    .build();

        } catch (RazorpayException e) {
            log.error("Razorpay API error for mission {}: {}", missionId, e.getMessage());
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY,
                    "Razorpay rejected the request: " + e.getMessage(), e);
        }
    }
}
