ALTER TABLE mimic_documents
ADD COLUMN IF NOT EXISTS migration_version INTEGER;
