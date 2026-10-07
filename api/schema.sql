PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY,
  sku TEXT NOT NULL UNIQUE CHECK(length(trim(sku)) > 0),
  name TEXT NOT NULL CHECK(length(trim(name)) > 0),
  category TEXT NOT NULL CHECK(category IN ('bedding','living-space','decor')),
  fabric_type TEXT NOT NULL DEFAULT '',
  dimensions TEXT NOT NULL DEFAULT '',
  current_stock INTEGER NOT NULL DEFAULT 0 CHECK(current_stock >= 0),
  reorder_level INTEGER NOT NULL DEFAULT 5 CHECK(reorder_level >= 0),
  version INTEGER NOT NULL DEFAULT 0,
  deleted_at TEXT,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS products_category ON products(category);
CREATE TABLE IF NOT EXISTS stock_movements (
  id INTEGER PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id),
  delta INTEGER NOT NULL,
  stock_after INTEGER NOT NULL CHECK(stock_after >= 0),
  request_id TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
