-- Statistical anomaly detection metrics and indexing for telemetry_events
ALTER TABLE telemetry_events
    ADD COLUMN anomaly_flag BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN anomaly_confidence DOUBLE NULL,
    ADD COLUMN anomaly_occupancy_z DOUBLE NULL,
    ADD COLUMN anomaly_fill_z DOUBLE NULL;

CREATE INDEX idx_telemetry_anomaly ON telemetry_events (anomaly_flag, recorded_at);
