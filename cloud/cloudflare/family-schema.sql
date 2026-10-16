-- Pilot family pairing: no names, phone numbers, evidence or message bodies.
CREATE TABLE IF NOT EXISTS yihu_family (
 id TEXT PRIMARY KEY,
 owner_hash TEXT NOT NULL UNIQUE,
 guardian_hash TEXT UNIQUE,
 invite_hash TEXT UNIQUE,
 invite_until INTEGER,
 created_ms INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS yihu_family_alert (
 id TEXT PRIMARY KEY,
 circle_id TEXT NOT NULL,
 created_ms INTEGER NOT NULL,
 ack_ms INTEGER
);
CREATE INDEX IF NOT EXISTS yihu_family_alert_circle ON yihu_family_alert(circle_id,created_ms);
CREATE UNIQUE INDEX IF NOT EXISTS yihu_family_one_open ON yihu_family_alert(circle_id) WHERE ack_ms IS NULL;
