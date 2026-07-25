-- Projection table for gradual migration away from the single app_state JSON document.
-- Existing app_state remains the source of truth until dual-read verification is complete.
CREATE TABLE IF NOT EXISTS kasirkita_entities_v1 (
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  shop_id TEXT,
  owner_id TEXT,
  admin_id TEXT,
  payload JSONB NOT NULL,
  projected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (entity_type, entity_id)
);

CREATE INDEX IF NOT EXISTS kasirkita_entities_v1_shop_idx ON kasirkita_entities_v1 (shop_id, entity_type);
CREATE INDEX IF NOT EXISTS kasirkita_entities_v1_owner_idx ON kasirkita_entities_v1 (owner_id, entity_type);
CREATE INDEX IF NOT EXISTS kasirkita_entities_v1_admin_idx ON kasirkita_entities_v1 (admin_id, entity_type);
CREATE INDEX IF NOT EXISTS kasirkita_entities_v1_payload_gin_idx ON kasirkita_entities_v1 USING GIN (payload);

CREATE TABLE IF NOT EXISTS kasirkita_normalization_runs (
  id TEXT PRIMARY KEY,
  state_key TEXT NOT NULL,
  source_version BIGINT NOT NULL,
  row_count INTEGER NOT NULL,
  checksum TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS kasirkita_normalization_runs_created_idx
  ON kasirkita_normalization_runs (created_at DESC);
