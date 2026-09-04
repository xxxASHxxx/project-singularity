-- Analytics performance indexes
-- These make the GROUP BY and WHERE queries in AnalyticsService sub-millisecond
-- even with millions of telemetry rows.
CREATE INDEX IF NOT EXISTS idx_missions_status   ON agent_missions (status);
CREATE INDEX IF NOT EXISTS idx_missions_type     ON agent_missions (mission_type);
CREATE INDEX IF NOT EXISTS idx_missions_created  ON agent_missions (created_at);
CREATE INDEX IF NOT EXISTS idx_telemetry_surge   ON telemetry_events (surge_flag, recorded_at);
CREATE INDEX IF NOT EXISTS idx_telemetry_stock   ON telemetry_events (low_stock_flag, recorded_at);
