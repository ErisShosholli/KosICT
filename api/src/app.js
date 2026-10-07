import express from 'express';
import { randomUUID } from 'node:crypto';
const categories = ['bedding', 'living-space', 'decor'];
const productView = row => ({ ...row, reorder_alert: row.current_stock <= row.reorder_level });
export function createApp(db) {
  const app = express();
  app.use(express.json({ limit: '2mb' }));
  app.get('/api/health', (_req, res) => { db.prepare('SELECT 1').get(); res.json({ status: 'ok' }); });
  app.get('/api/products', (req, res) => {
    const { category, q = '' } = req.query;
    if ((category && !categories.includes(category)) || typeof q !== 'string' || q.length > 200) return res.status(400).json({ error: 'Invalid category or search' });
    const rows = db.prepare(`SELECT * FROM products WHERE (? IS NULL OR category = ?) AND (instr(lower(name), lower(?)) > 0 OR instr(lower(sku), lower(?)) > 0) ORDER BY name`).all(category || null, category || null, q, q);
    res.json({ products: rows.map(productView) });
  });
  app.post('/api/products/import', (req, res) => {
    const rows = req.body?.products;
    if (!Array.isArray(rows) || rows.length === 0 || rows.length > 5000) return res.status(400).json({ error: 'Supply 1–5000 products' });
    const seen = new Set();
    for (const p of rows) {
      if (!p || typeof p.sku !== 'string' || !p.sku.trim() || p.sku.length > 100 || typeof p.name !== 'string' || !p.name.trim() || p.name.length > 200 || !categories.includes(p.category) || typeof p.fabric_type !== 'string' || p.fabric_type.length > 200 || typeof p.dimensions !== 'string' || p.dimensions.length > 200 || !Number.isSafeInteger(p.current_stock) || p.current_stock < 0 || p.current_stock > 1000000 || !Number.isSafeInteger(p.reorder_level) || p.reorder_level < 0 || p.reorder_level > 1000000 || seen.has(p.sku.trim())) return res.status(400).json({ error: 'Invalid row or duplicate SKU; nothing imported' });
      seen.add(p.sku.trim());
    }
    db.exec('BEGIN IMMEDIATE');
    try {
      const exists = db.prepare('SELECT id FROM products WHERE sku=?');
      for (const p of rows) if (exists.get(p.sku.trim())) { db.exec('ROLLBACK'); return res.status(409).json({error:`SKU already exists: ${p.sku}; nothing imported`}); }
      const insert = db.prepare('INSERT INTO products (sku,name,category,fabric_type,dimensions,current_stock,reorder_level) VALUES (?,?,?,?,?,?,?)');
      for (const p of rows) insert.run(p.sku.trim(),p.name.trim(),p.category,p.fabric_type,p.dimensions,p.current_stock,p.reorder_level);
      db.exec('COMMIT'); res.status(201).json({ imported: rows.length });
    } catch(error) { db.exec('ROLLBACK'); throw error; }
  });
  app.patch('/api/products/:id/stock', (req, res) => {
    const id = Number(req.params.id);
    const { delta, expectedVersion, requestId = randomUUID() } = req.body || {};
    if (!Number.isSafeInteger(id) || id <= 0 || !Number.isSafeInteger(delta) || delta === 0 || Math.abs(delta) > 1000000 || !Number.isSafeInteger(expectedVersion) || expectedVersion < 0 || typeof requestId !== 'string' || !requestId.length || requestId.length > 128) return res.status(400).json({ error: 'Supply delta, expectedVersion and an optional requestId' });
    db.exec('BEGIN IMMEDIATE');
    try {
      const prior = db.prepare('SELECT * FROM stock_movements WHERE request_id = ?').get(requestId);
      const row = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
      if (prior) {
        db.exec('ROLLBACK');
        if (prior.product_id !== id || prior.delta !== delta) return res.status(409).json({ error: 'requestId already used for a different action' });
        return res.json({ product: productView(row), replayed: true });
      }
      if (!row) { db.exec('ROLLBACK'); return res.status(404).json({ error: 'Product not found' }); }
      if (row.version !== expectedVersion) { db.exec('ROLLBACK'); return res.status(409).json({ error: 'Stock changed; refresh and retry', product: productView(row) }); }
      if (row.current_stock + delta < 0) { db.exec('ROLLBACK'); return res.status(409).json({ error: 'Insufficient stock', product: productView(row) }); }
      const updated = db.prepare("UPDATE products SET current_stock=current_stock+?, version=version+1, updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=? RETURNING *").get(delta, id);
      db.prepare('INSERT INTO stock_movements (product_id,delta,stock_after,request_id) VALUES (?,?,?,?)').run(id, delta, updated.current_stock, requestId);
      db.exec('COMMIT');
      return res.json({ product: productView(updated), replayed: false });
    } catch (error) { db.exec('ROLLBACK'); throw error; }
  });
  app.use((error, _req, res, _next) => { if (error.status === 400) return res.status(400).json({ error: 'Invalid JSON' }); console.error(error.message); res.status(500).json({ error: 'Internal server error' }); });
  return app;
}
