-- Team pilot ticketing. No names, phone numbers, attachments or case files.
CREATE TABLE IF NOT EXISTS yihu_ticket (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  owner_hash TEXT NOT NULL,
  category TEXT NOT NULL,
  question TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('pending','in_progress','replied','closed')),
  operator_hash TEXT,
  created_ms INTEGER NOT NULL,
  updated_ms INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS yihu_ticket_owner ON yihu_ticket(owner_hash,updated_ms);
CREATE INDEX IF NOT EXISTS yihu_ticket_queue ON yihu_ticket(status,updated_ms);

CREATE TABLE IF NOT EXISTS yihu_ticket_message (
  id TEXT PRIMARY KEY,
  ticket_id TEXT NOT NULL,
  sender TEXT NOT NULL CHECK(sender IN ('user','operator')),
  body TEXT NOT NULL,
  created_ms INTEGER NOT NULL,
  FOREIGN KEY(ticket_id) REFERENCES yihu_ticket(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS yihu_ticket_message_ticket ON yihu_ticket_message(ticket_id,created_ms);
