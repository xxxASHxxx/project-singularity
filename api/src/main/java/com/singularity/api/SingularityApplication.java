package com.singularity.api;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;

@SpringBootApplication
@ConfigurationPropertiesScan
public class SingularityApplication {
    public static void main(String[] args) {
        SpringApplication.run(SingularityApplication.class, args);
    }
}
