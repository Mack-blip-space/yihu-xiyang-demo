-- Only request accounting. Never store questions, answers, contacts or API keys.
CREATE TABLE IF NOT EXISTS yihu_ai_usage (
  request_id TEXT PRIMARY KEY,
  subject TEXT NOT NULL,
  day TEXT NOT NULL,
  at_ms INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS yihu_ai_day_subject ON yihu_ai_usage(day,subject);
CREATE INDEX IF NOT EXISTS yihu_ai_subject_time ON yihu_ai_usage(subject,at_ms);
