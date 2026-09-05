-- PLAN_MD artifacts store inline markdown content, which easily exceeds
-- the original VARCHAR(512) limit. Widen the column to TEXT so agent plans
-- are not silently truncated.
ALTER TABLE mission_artifacts MODIFY COLUMN storage_path TEXT NOT NULL;
