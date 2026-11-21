-- Kuy: visa run requests from the website. Safe to run many times.
CREATE TABLE IF NOT EXISTS kuy_visa_requests (
  id               BIGSERIAL PRIMARY KEY,
  code             TEXT NOT NULL UNIQUE,                 -- QN-261121-AB12, shown to the client
  idempotency_key  TEXT NOT NULL UNIQUE,                 -- protects against double submits
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  source           TEXT NOT NULL DEFAULT 'site',
  lang             TEXT NOT NULL DEFAULT 'en' CHECK (lang IN ('en','ru','vi')),
  destination      TEXT NOT NULL CHECK (destination IN ('laos','cambodia')),
  request_mode     TEXT NOT NULL CHECK (request_mode IN ('scheduled','date_request')),
  quy_trip_id      INTEGER,                              -- departure id in QUY Travel, if chosen
  travel_date      DATE NOT NULL,
  departure_time   TEXT,
  pax_count        INTEGER NOT NULL CHECK (pax_count BETWEEN 1 AND 20),
  passengers       JSONB NOT NULL,                       -- [{name, nationality, nationality_code, visa}]
  contact_name     TEXT NOT NULL,
  contact_channel  TEXT NOT NULL CHECK (contact_channel IN ('telegram','whatsapp')),
  contact_value    TEXT NOT NULL,                        -- @username or +phone
  pickup           TEXT NOT NULL,
  note             TEXT NOT NULL DEFAULT '',
  club_code        TEXT,                                 -- QUY Club invite code
  ref_code         TEXT,                                 -- referral code from a ?ref= link
  est_price_per_person BIGINT,                           -- transport price shown to the client (VND)
  est_visa_total   BIGINT NOT NULL DEFAULT 0,            -- visa fees (VND)
  status           TEXT NOT NULL DEFAULT 'new'
                   CHECK (status IN ('new','contacted','confirmed','completed','cancelled')),
  admin_note       TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS kuy_visa_requests_trip_idx   ON kuy_visa_requests (travel_date, destination);
CREATE INDEX IF NOT EXISTS kuy_visa_requests_status_idx ON kuy_visa_requests (status, created_at DESC);

CREATE TABLE IF NOT EXISTS kuy_audit_log (
  id          BIGSERIAL PRIMARY KEY,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  request_id  BIGINT REFERENCES kuy_visa_requests(id) ON DELETE CASCADE,
  actor       TEXT NOT NULL,                             -- 'site' or admin login
  action      TEXT NOT NULL,
  details     JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS kuy_audit_log_request_idx ON kuy_audit_log (request_id, created_at);
