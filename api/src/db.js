import { DatabaseSync } from "node:sqlite";
import { readFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
export function openDatabase(
  path = process.env.DB_PATH || resolve("data/edepo.sqlite"),
) {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec("PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;");
  db.exec(readFileSync(new URL("../schema.sql", import.meta.url), "utf8"));
  if (
    !db
      .prepare("PRAGMA table_info(products)")
      .all()
      .some((column) => column.name === "deleted_at")
  )
    db.exec("ALTER TABLE products ADD COLUMN deleted_at TEXT");
  return db;
}
export function seedDemo(db) {
  const insert = db.prepare(
    "INSERT OR IGNORE INTO products (sku,name,category,fabric_type,dimensions,current_stock,reorder_level) VALUES (?,?,?,?,?,?,?)",
  );
  for (const row of [
    [
      "NUKA-SHEET-200",
      "Complete Sheet Set",
      "bedding",
      "Cotton",
      "200 × 220 cm",
      24,
      5,
    ],
    [
      "NUKA-DUVET-200",
      "Winter Duvet",
      "bedding",
      "Microfiber",
      "200 × 220 cm",
      8,
      5,
    ],
    [
      "NUKA-PILLOW-50",
      "Orthopedic Pillow",
      "bedding",
      "Memory foam",
      "50 × 70 cm",
      4,
      5,
    ],
    [
      "NUKA-CURTAIN-140",
      "Custom Curtain",
      "living-space",
      "Linen",
      "140 × 260 cm",
      12,
      3,
    ],
    ["NUKA-RUG-160", "Area Rug", "living-space", "Wool", "160 × 230 cm", 3, 3],
    ["NUKA-BATH-SET", "Bathroom Set", "decor", "Cotton", "3-piece set", 18, 5],
  ])
    insert.run(...row);
}
