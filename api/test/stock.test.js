import test from "node:test";
import assert from "node:assert/strict";
import { openDatabase, seedDemo } from "../src/db.js";
import { createApp } from "../src/app.js";
test("stock workflow: lookup, adjustment, retry, conflict, underflow and audit", async () => {
  const db = openDatabase(":memory:");
  seedDemo(db);
  const server = createApp(db).listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const patch = (body) =>
    fetch(`${base}/api/products/1/stock`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  try {
    const list = await (
      await fetch(`${base}/api/products?category=bedding&q=sheet`)
    ).json();
    assert.equal(list.products.length, 1);
    assert.equal(list.products[0].current_stock, 24);
    const action = { delta: -1, expectedVersion: 0, requestId: "sale-1" };
    const first = await patch(action);
    assert.equal(first.status, 200);
    const result = await first.json();
    assert.equal(result.product.current_stock, 23);
    assert.equal(result.product.version, 1);
    const replay = await (await patch(action)).json();
    assert.equal(replay.replayed, true);
    assert.equal(replay.product.current_stock, 23);
    assert.equal((await patch({ ...action, delta: 1 })).status, 409);
    assert.equal((await patch({ ...action, requestId: "sale-2" })).status, 409);
    assert.equal((await patch({ delta: -24, expectedVersion: 1 })).status, 409);
    assert.equal((await patch({ delta: 0, expectedVersion: 1 })).status, 400);
    const concurrent = await Promise.all([
      patch({ delta: -1, expectedVersion: 1, requestId: "parallel-1" }),
      patch({ delta: -1, expectedVersion: 1, requestId: "parallel-2" }),
    ]);
    assert.deepEqual(concurrent.map((r) => r.status).sort(), [200, 409]);
    assert.equal(
      db.prepare("SELECT count(*) AS count FROM stock_movements").get().count,
      2,
    );
    assert.equal((await fetch(`${base}/api/health`)).status, 200);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    db.close();
  }
});
test("SQLite persistence and constraints", () => {
  const db = openDatabase(":memory:");
  seedDemo(db);
  assert.throws(() =>
    db.prepare("UPDATE products SET current_stock=-1 WHERE id=1").run(),
  );
  assert.throws(() =>
    db.prepare("UPDATE products SET category='invalid' WHERE id=1").run(),
  );
  assert.equal(
    db.prepare("SELECT count(*) AS count FROM products").get().count,
    6,
  );
  seedDemo(db);
  assert.equal(
    db.prepare("SELECT count(*) AS count FROM products").get().count,
    6,
  );
  db.close();
});
test("imports are atomic and reject duplicates without replacing live stock", async () => {
  const db = openDatabase(":memory:");
  const server = createApp(db).listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  const url = `http://127.0.0.1:${server.address().port}/api/products/import`;
  const product = {
    sku: "IMPORT-1",
    name: "Imported Sheet",
    category: "bedding",
    fabric_type: "Cotton",
    dimensions: "200 cm",
    current_stock: 8,
    reorder_level: 3,
  };
  const post = (products) =>
    fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ products }),
    });
  try {
    assert.equal(
      (
        await post([
          product,
          { ...product, sku: "IMPORT-2", current_stock: -1 },
        ])
      ).status,
      400,
    );
    assert.equal(db.prepare("SELECT count(*) AS n FROM products").get().n, 0);
    assert.equal((await post([product])).status, 201);
    assert.equal(
      (await post([{ ...product, sku: "IMPORT-2" }, product])).status,
      409,
    );
    assert.equal(db.prepare("SELECT count(*) AS n FROM products").get().n, 1);
    assert.equal(
      db.prepare("SELECT current_stock FROM products").get().current_stock,
      8,
    );
  } finally {
    await new Promise((r) => server.close(r));
    db.close();
  }
});
test("product CRUD preserves history and rejects stale changes and duplicate SKUs", async () => {
  const db = openDatabase(":memory:");
  const server = createApp(db).listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  const base = `http://127.0.0.1:${server.address().port}/api/products`;
  const send = (url, method, body) =>
    fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  const p = {
    sku: "CRUD-1",
    name: "Curtain",
    category: "living-space",
    fabric_type: "Linen",
    dimensions: "200 cm",
    current_stock: 8,
    reorder_level: 3,
  };
  try {
    assert.equal(
      (await send(base, "POST", { ...p, current_stock: -1 })).status,
      400,
    );
    const created = await send(base, "POST", p);
    assert.equal(created.status, 201);
    const { product } = await created.json();
    assert.equal((await send(base, "POST", p)).status, 409);
    assert.equal((await fetch(`${base}/${product.id}`)).status, 200);
    const updated = await send(`${base}/${product.id}`, "PUT", {
      ...p,
      name: "Custom Curtain",
      current_stock: 10,
      expectedVersion: 0,
    });
    assert.equal(updated.status, 200);
    assert.equal((await updated.json()).product.version, 1);
    assert.equal(
      (await send(`${base}/${product.id}`, "PUT", { ...p, expectedVersion: 0 }))
        .status,
      409,
    );
    assert.equal(
      (await send(`${base}/${product.id}`, "DELETE", { expectedVersion: 0 }))
        .status,
      409,
    );
    assert.equal(
      (await send(`${base}/${product.id}`, "DELETE", { expectedVersion: 1 }))
        .status,
      204,
    );
    assert.equal((await fetch(`${base}/${product.id}`)).status, 404);
    assert.equal((await (await fetch(base)).json()).products.length, 0);
    assert.equal(
      db.prepare("SELECT delta FROM stock_movements").get().delta,
      2,
    );
    assert.equal((await send(base, "POST", p)).status, 409);
  } finally {
    await new Promise((r) => server.close(r));
    db.close();
  }
});
