CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT DEFAULT 'admin' CHECK(role IN ('admin','viewer')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE refresh_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  expires_at DATETIME NOT NULL,
  revoked INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_refresh_hash ON refresh_tokens(token_hash);

CREATE TABLE devices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uuid TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  ip TEXT NOT NULL,
  port INTEGER DEFAULT 80,
  protocol TEXT DEFAULT 'http' CHECK(protocol IN ('http','https')),
  type TEXT,
  vendor TEXT,
  location TEXT,
  group_tag TEXT,
  notes TEXT,
  status TEXT DEFAULT 'unknown' CHECK(status IN ('online','offline','unknown')),
  last_seen DATETIME,
  latency_ms INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX idx_devices_ip_port ON devices(ip, port);

CREATE TABLE check_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  device_id INTEGER NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  latency_ms INTEGER,
  checked_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_check_history_device ON check_history(device_id, checked_at DESC);

CREATE TABLE audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id),
  device_id INTEGER,
  action TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  metadata TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_audit_created ON audit_logs(created_at DESC);
CREATE INDEX idx_audit_device ON audit_logs(device_id, created_at DESC);
