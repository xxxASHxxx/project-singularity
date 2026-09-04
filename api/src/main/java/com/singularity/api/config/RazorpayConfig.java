package com.singularity.api.config;

import com.razorpay.RazorpayClient;
import com.razorpay.RazorpayException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Initialises the Razorpay SDK client as a singleton Spring bean.
 *
 * The client is thread-safe; a single instance shared across all service
 * calls is the correct pattern per Razorpay's own documentation.
 */
@Slf4j
@Configuration
public class RazorpayConfig {

    @Value("${razorpay.key.id}")
    private String keyId;

    @Value("${razorpay.key.secret}")
    private String keySecret;

    @Bean
    public RazorpayClient razorpayClient() throws RazorpayException {
        log.info("Initialising Razorpay client for key_id={}", keyId);
        return new RazorpayClient(keyId, keySecret);
    }
}
