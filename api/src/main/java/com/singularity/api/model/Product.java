package com.singularity.api.model;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.math.BigDecimal;

@Data
@NoArgsConstructor
@Entity
@Table(name = "products")
public class Product {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "sku", unique = true, nullable = false, length = 64)
    private String sku;

    @Column(name = "name", nullable = false)
    private String name;

    @Column(name = "current_price", nullable = false, precision = 10, scale = 2)
    private BigDecimal currentPrice;

    @Column(name = "stock_qty", nullable = false)
    private Integer stockQty;

    /**
     * Optimistic locking version column.
     * Hibernate increments this on every UPDATE. If two concurrent writes
     * race, the second one will see a stale version and throw
     * OptimisticLockException before any data corruption can occur.
     */
    @Version
    @Column(name = "version", nullable = false)
    private Integer version = 0;
}
