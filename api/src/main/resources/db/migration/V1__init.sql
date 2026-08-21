CREATE TABLE IF NOT EXISTS telemetry_events (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    device_id VARCHAR(64) NOT NULL,
    recorded_at DATETIME NOT NULL,
    zone_occupancy_count INT NOT NULL,
    shelf_fill_ratio DECIMAL(5,2) NOT NULL,
    surge_flag BOOLEAN NOT NULL DEFAULT FALSE,
    low_stock_flag BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_device_recorded (device_id, recorded_at)
);

CREATE TABLE IF NOT EXISTS agent_missions (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    triggered_by_event_id BIGINT NOT NULL,
    mission_type ENUM('RESTOCK','REPRICE') NOT NULL,
    status ENUM('PENDING_APPROVAL','APPROVED','RUNNING','COMPLETED','FAILED') NOT NULL DEFAULT 'PENDING_APPROVAL',
    started_at DATETIME,
    completed_at DATETIME,
    summary TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_mission_event FOREIGN KEY (triggered_by_event_id) REFERENCES telemetry_events(id)
);

CREATE TABLE IF NOT EXISTS mission_artifacts (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    mission_id BIGINT NOT NULL,
    artifact_type ENUM('SCREENSHOT','RECORDING_URL','PLAN_MD','LOG') NOT NULL,
    storage_path VARCHAR(512) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_artifact_mission FOREIGN KEY (mission_id) REFERENCES agent_missions(id)
);

CREATE TABLE IF NOT EXISTS products (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    sku VARCHAR(64) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    current_price DECIMAL(10,2) NOT NULL,
    stock_qty INT NOT NULL
);
