-- Track artifact file size in bytes for attachments and logs
ALTER TABLE mission_artifacts ADD COLUMN file_size_bytes BIGINT NULL;
