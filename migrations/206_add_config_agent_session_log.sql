-- Migration 206: Configuration Agent session log
-- Records each turn of the Agents workspace (/settings/automation) for review during
-- user testing: what the operator typed, the request sent to the model, the raw
-- completion it returned, and what the UI parsed out of it.

CREATE TABLE IF NOT EXISTS config_agent_session_events (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Per-browser session, so a tester's turns can be read in order
  session_id       TEXT NOT NULL,
  turn_index       INTEGER NOT NULL DEFAULT 0,
  -- build | preview | backtest — what the turn was for
  action           TEXT NOT NULL DEFAULT 'build',
  model            TEXT,
  agent_name       TEXT,
  user_message     TEXT NOT NULL,
  -- The transcript posted to the model, and the configuration being edited
  request_json     JSONB NOT NULL,
  current_config   JSONB,
  -- The completion exactly as returned, before any parsing
  raw_response     TEXT,
  -- What the UI made of it: prose, config block, question, email, back-test
  parsed_json      JSONB,
  error            TEXT,
  duration_ms      INTEGER,
  user_agent       TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_config_agent_session_events_created_at
  ON config_agent_session_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_config_agent_session_events_session
  ON config_agent_session_events(session_id, turn_index);

COMMENT ON TABLE config_agent_session_events IS 'Per-turn log of the Configuration Agent workspace, for review at /settings/automation/log';
COMMENT ON COLUMN config_agent_session_events.session_id IS 'Per-browser id generated client-side; not tied to a user account';
COMMENT ON COLUMN config_agent_session_events.raw_response IS 'The model completion before parsing — includes any reasoning it wrote in prose and the configuration block';
COMMENT ON COLUMN config_agent_session_events.parsed_json IS 'What the UI extracted: prose, configuration block, question, email preview, back-test rows';
