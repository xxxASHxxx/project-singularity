package com.singularity.api.controller;

import com.singularity.api.dto.ProductPriceRequest;
import com.singularity.api.model.Product;
import com.singularity.api.repository.ProductRepository;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;

import java.util.List;

@RestController
@RequestMapping("/api/v1/products")
@RequiredArgsConstructor
public class ProductController {

    private final ProductRepository productRepo;

    @GetMapping
    public ResponseEntity<List<Product>> list() {
        return ResponseEntity.ok(productRepo.findAll());
    }

    @PatchMapping("/{id}")
    public ResponseEntity<Product> updatePrice(
            @PathVariable Long id,
            @Valid @RequestBody ProductPriceRequest req) {
        Product product = productRepo.findById(id).orElseThrow(
            () -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Product " + id + " not found"));
        product.setCurrentPrice(req.getCurrentPrice());
        if (req.getStockQty() != null) {
            product.setStockQty(req.getStockQty());
        }
        return ResponseEntity.ok(productRepo.save(product));
    }
}
