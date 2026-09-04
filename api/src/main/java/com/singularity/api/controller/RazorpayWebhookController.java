package com.singularity.api.controller;

import com.razorpay.Utils;
import com.razorpay.RazorpayException;
import com.singularity.api.dto.PaymentLinkResponse;
import com.singularity.api.model.AgentMission;
import com.singularity.api.model.AgentMission.MissionStatus;
import com.singularity.api.model.MissionArtifact;
import com.singularity.api.repository.AgentMissionRepository;
import com.singularity.api.repository.MissionArtifactRepository;
import com.singularity.api.service.RazorpayService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.json.JSONObject;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.Map;

/**
 * Razorpay integration endpoints.
 *
 * <h2>POST /api/v1/razorpay/payment-link</h2>
 * Called by the Restock Agent (or any caller) to generate a Razorpay Payment
 * Link for a given mission + current shelf fill ratio.
 *
 * <h2>POST /api/v1/webhooks/razorpay</h2>
 * Receives signed callbacks from Razorpay. The signature is verified
 * <em>before</em> any business logic executes — an invalid signature results
 * in an immediate 401. This is the cryptographic guarantee that the request
 * originates from Razorpay and has not been tampered with in transit.
 *
 * <p><strong>Raw body requirement:</strong> Spring must not deserialise the
 * body before signature verification. The webhook handler accepts
 * {@code String rawBody} so the original bytes are preserved for HMAC-SHA256
 * comparison. A {@code @RequestBody byte[]} variant would also work, but
 * String is cleaner given that Razorpay payloads are always valid UTF-8.
 */
@Slf4j
@RestController
@RequiredArgsConstructor
public class RazorpayWebhookController {

    @Value("${razorpay.webhook.secret}")
    private String webhookSecret;

    private final RazorpayService razorpayService;
    private final AgentMissionRepository missionRepo;
    private final MissionArtifactRepository artifactRepo;

    // -----------------------------------------------------------------------
    // Payment Link creation (called by Restock Agent)
    // -----------------------------------------------------------------------

    /**
     * Creates a Razorpay Payment Link for a RESTOCK mission.
     *
     * @param body must contain {@code missionId} (Long) and {@code shelfFillRatio} (double)
     */
    @PostMapping("/api/v1/razorpay/payment-link")
    public ResponseEntity<PaymentLinkResponse> createPaymentLink(
            @RequestBody Map<String, Object> body) {

        Long missionId = Long.valueOf(body.get("missionId").toString());
        double shelfFill = Double.parseDouble(body.get("shelfFillRatio").toString());

        log.info("Payment link requested: mission={} shelfFill={}", missionId, shelfFill);
        PaymentLinkResponse response = razorpayService.createRestockPaymentLink(missionId, shelfFill);
        return ResponseEntity.ok(response);
    }

    // -----------------------------------------------------------------------
    // Webhook handler
    // -----------------------------------------------------------------------

    /**
     * Receives Razorpay event callbacks.
     *
     * <p>Security contract:
     * <ol>
     *   <li>Verify HMAC-SHA256 signature using the shared webhook secret.</li>
     *   <li>Reject with 401 on any verification failure — do NOT log the
     *       raw payload before verification to avoid processing injected data.</li>
     *   <li>Parse {@code payload.payment.entity.notes.mission_id} to correlate
     *       the payment with an AgentMission.</li>
     *   <li>Transition the mission to COMPLETED only on {@code payment.captured}.</li>
     * </ol>
     *
     * @param rawBody   the unmodified request body (required for signature check)
     * @param signature the value of the {@code X-Razorpay-Signature} header
     */
    @PostMapping(
            value  = "/api/v1/webhooks/razorpay",
            consumes = MediaType.APPLICATION_JSON_VALUE
    )
    public ResponseEntity<Void> handleWebhook(
            @RequestBody String rawBody,
            @RequestHeader("X-Razorpay-Signature") String signature) {

        // ── Step 1: Cryptographic signature verification ──────────────────
        // Utils.verifyWebhookSignature computes HMAC-SHA256(rawBody, webhookSecret)
        // and compares it to the provided signature in constant time.
        try {
            boolean valid = Utils.verifyWebhookSignature(rawBody, signature, webhookSecret);
            if (!valid) {
                // SDK returned false rather than throwing (older SDK versions)
                log.warn("Razorpay webhook signature check returned false");
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
            }
        } catch (RazorpayException e) {
            // SDK throws when HMAC does not match — treat as a forgery attempt
            log.warn("Razorpay webhook signature invalid: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        // ── Step 2: Parse event type ──────────────────────────────────────
        JSONObject event = new JSONObject(rawBody);
        String eventType = event.optString("event", "");
        log.info("Razorpay webhook received: event={}", eventType);

        // Only act on payment.captured; acknowledge all others with 200
        if (!"payment.captured".equals(eventType)) {
            log.debug("Ignoring non-capture event: {}", eventType);
            return ResponseEntity.ok().build();
        }

        // ── Step 3: Extract mission ID from payment notes ─────────────────
        Long missionId;
        String paymentId;
        try {
            JSONObject paymentEntity = event
                    .getJSONObject("payload")
                    .getJSONObject("payment")
                    .getJSONObject("entity");

            paymentId = paymentEntity.getString("id");

            JSONObject notes = paymentEntity.optJSONObject("notes");
            if (notes == null || !notes.has("mission_id")) {
                log.warn("payment.captured event missing mission_id in notes: paymentId={}", paymentId);
                // Acknowledge to prevent Razorpay retrying; we simply can't correlate
                return ResponseEntity.ok().build();
            }
            missionId = Long.valueOf(notes.getString("mission_id"));
        } catch (Exception e) {
            log.error("Failed to parse Razorpay webhook payload: {}", e.getMessage());
            // Return 200 to prevent infinite retries for a malformed payload
            return ResponseEntity.ok().build();
        }

        // ── Step 4: Update mission status ─────────────────────────────────
        missionRepo.findById(missionId).ifPresentOrElse(mission -> {
            if (mission.getStatus() == MissionStatus.COMPLETED) {
                log.info("Mission {} already COMPLETED — skipping duplicate webhook", missionId);
                return;
            }

            mission.setStatus(MissionStatus.COMPLETED);
            mission.setCompletedAt(LocalDateTime.now());
            mission.setSummary(String.format(
                    "Payment captured: Razorpay payment_id=%s. Restock order fulfilled.", paymentId));
            missionRepo.save(mission);

            // Persist the payment ID as a LOG artifact for the audit trail
            MissionArtifact artifact = new MissionArtifact();
            artifact.setMissionId(missionId);
            artifact.setArtifactType(MissionArtifact.ArtifactType.LOG);
            artifact.setStoragePath(String.format(
                    "payment.captured | razorpay_payment_id=%s | mission_id=%d | ts=%s",
                    paymentId, missionId, LocalDateTime.now()));
            artifactRepo.save(artifact);

            log.info("Mission {} marked COMPLETED via Razorpay webhook (payment={})",
                    missionId, paymentId);

        }, () -> log.warn("Webhook references unknown mission_id={}", missionId));

        return ResponseEntity.ok().build();
    }
}
