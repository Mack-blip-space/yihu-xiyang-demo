-- Generic Android push subscriptions. Message bodies and legal questions are never stored here.
CREATE TABLE IF NOT EXISTS yihu_push_subscription (
  kind TEXT NOT NULL CHECK(kind IN ('family','ticket','operator')),
  subject_hash TEXT NOT NULL,
  installation_id TEXT NOT NULL,
  fcm_token TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_ms INTEGER NOT NULL,
  updated_ms INTEGER NOT NULL,
  last_success_ms INTEGER,
  last_error TEXT,
  PRIMARY KEY(kind,subject_hash,installation_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS yihu_push_token_kind ON yihu_push_subscription(fcm_token,kind);
CREATE INDEX IF NOT EXISTS yihu_push_target ON yihu_push_subscription(kind,subject_hash,enabled);

CREATE TABLE IF NOT EXISTS yihu_push_event (
  event_key TEXT PRIMARY KEY,
  created_ms INTEGER NOT NULL
);
