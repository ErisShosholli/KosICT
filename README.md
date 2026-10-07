# E-Depo · Team Avengers

A complete local inventory demo for Nuka Selection, built for KosICT 2026's Future Developer Corner. React dashboard + Express REST API + SQLite + a Python/Pandas/FastAPI Excel ingestion service. Team: Eren, Inara, Ari.

## Windows setup (Command Prompt)

Install Node.js 24+ and Python 3.12+ first. Download the latest main-branch ZIP and extract it completely. Open Command Prompt in the folder containing `package.json`, `package-lock.json`, and `README.md` (an extraction tool may create a nested `KosICT-main` folder). Confirm with `dir package.json`. If it is missing, locate the project with `dir /s /b package.json` and change to that folder; do not run npm in the outer extraction folder.

```bat
node --version
py --version
npm ci
py -m venv .venv
.venv\Scripts\python.exe -m pip install -r ingestion\requirements.lock.txt
npm run demo
```

Open http://localhost:5173 in your browser. If `py` is unavailable, install Python from python.org, enable its PATH option, reopen Command Prompt, and use `python` instead of `py`. The launcher selects the correct virtual-environment Python for Windows or Linux/macOS.

## Install and run (Linux/macOS)

Requires Node.js 24+, Python 3.12+, and npm.

```sh
cd /workspace/KosICT
npm ci
python3 -m venv .venv
.venv/bin/pip install -r ingestion/requirements.lock.txt
npm run demo
```

`npm run demo` starts all three services and stops them together on Ctrl+C. The dashboard uses port 5173, the inventory API 3001, and Excel service 8000, all bound to loopback by default. The dashboard proxies API and upload requests. Fonts are bundled locally.

SQLite persists in `data/edepo.sqlite` (ignored by Git). `npm run demo` enables six fictional demo products on first startup; seeding is idempotent and never resets quantities. For a real inventory database, use `DEMO_SEED=0 npm run demo`. Do not mix sample inventory with business data. `DB_PATH` changes the database location. API-only configuration supports `PORT` and `HOST`; update Vite's proxy if those change.

Individual services:

```sh
DEMO_SEED=1 npm run dev
npm run web
.venv/bin/python -m uvicorn service:app --app-dir ingestion --host 127.0.0.1 --port 8000
```

## Live pitch flow

1. Explain Fisnik's challenge: spreadsheets fragment stock across sizes, fabrics and categories.
2. Show the inventory overview, total units and low-stock alerts.
3. Select Bedding and search for the Complete Sheet Set by name or SKU.
4. Click **Sell one**. The quantity and summary update immediately; the API records the action atomically. Reload to show persistence. **+1** records a returned or received unit.
5. Import `examples/sample-inventory.xlsx` with **Import Excel**. Two new fictional product variants appear. Reimporting safely rejects duplicate SKUs rather than overwriting stock.
6. Close with the benefit: less time reconciling spreadsheets, more time serving customers.

Use a separate demo database for rehearsals (`DB_PATH=/tmp/edepo-rehearsal.sqlite npm run demo`) so real data stays separate. Stop the current demo before starting another on the same ports. For a fresh rehearsal, choose a new database filename.

## Inventory workspace

A focused dark interface with product search, category tabs, stock filters, sorting and quantity controls. Create products with **New product**; click a name or its pencil button to edit all variant fields. Delete requires confirmation and removes the product from inventory while retaining its stock history. Archived SKUs remain reserved. Team credits, owner labels, event banners and promotional copy are removed from the application.

Product creation and editing validate SKU uniqueness, category and nonnegative integer quantities. Updates and deletes require the latest version to prevent overwriting another change. Editing stock records the adjustment in the movement history. Existing databases migrate automatically without resetting inventory.

## Schema

`api/schema.sql` defines products and stock movements. Each product represents a sellable variant with a unique SKU, name, category (`bedding`, `living-space`, `decor`), fabric, display dimensions, current stock, reorder threshold and version. Distinct sizes or fabrics use distinct SKUs. Dimensions support custom measurements and set descriptions; quantities count units of a SKU, not meters. Reorder alerts are derived when stock is at or below the threshold. SQLite transactions protect adjustments and imports.

## REST API

- `GET /api/health`: confirms database connectivity.
- `GET /api/products?category=bedding&q=sheet`: category filter and case-insensitive name/SKU lookup.
- `PATCH /api/products/:id/stock`: atomic adjustment, returning the updated product.
- `POST /api/products`: create a product.
- `GET /api/products/:id`: read an active product.
- `PUT /api/products/:id`: update product fields and stock with `expectedVersion`.
- `DELETE /api/products/:id`: archive a product with `expectedVersion`; preserves movement history.
- `POST /api/products/import`: validates and inserts a complete batch of 1–5000 products. Duplicate SKUs or any invalid row reject the whole batch.

```sh
curl -s http://127.0.0.1:3001/api/products
curl -s -X PATCH http://127.0.0.1:3001/api/products/1/stock \
  -H 'Content-Type: application/json' \
  -d '{"delta":-1,"expectedVersion":0,"requestId":"pitch-sale-001"}'
```

Send the latest product `version` as `expectedVersion`. Generate a UUID per user action and reuse it for network retries. A stale version returns 409 with current product data. Retrying the same request ID does not apply the adjustment twice. Responses: 200 success/replay, 400 invalid input, 404 missing product, 409 conflict/insufficient stock/reused request ID. Optimistic UI feels immediate; zero network latency is not guaranteed.

## Excel ingestion

Required columns: `sku`, `name`, `category`, `current_stock`. Optional: `fabric_type`, `dimensions`, `reorder_level` (defaults to 5). Header spaces/case are normalized. Aliases include Product Name, Fabric, Stock, Quantity and Reorder. SKU cells should be Excel text to preserve leading zeros. Category labels may use Bedding & Comfort, Living Space, or Home Decor & Utilities. Blank rows are ignored; missing fields, invalid/noninteger/negative quantities and duplicate SKUs reject the sheet. Uploads accept `.xlsx`, first sheet, up to 5 MB. Inspect Fisnik's actual workbook before adapting aliases; the included data is fictional.

CLI supports named sheets and previewing validated JSON:

```sh
.venv/bin/python ingestion/import_excel.py examples/sample-inventory.xlsx --dry-run
.venv/bin/python ingestion/import_excel.py inventory.xlsx --sheet Inventory
```

FastAPI: `POST /import` accepts a multipart `file`; `GET /health` checks the service. `EDEPO_API_URL` overrides its Express destination. `ingestion/create_sample.py` regenerates the example workbook.

## Validation

```sh
npm test
.venv/bin/python -m unittest discover -s ingestion -p 'test_*.py'
npm run build
npm run test:browser
```

Browser tests require Chromium at `/usr/bin/chromium`, or set `CHROMIUM_PATH`. Stop `npm run demo` before browser tests; the test runner starts its own services and temporary SQLite database. It exercises filters/search, stock changes, reload persistence, real workbook upload, duplicate rejection and the mobile layout. It does not alter the main demo database.

This is a local stage-demo application. Authentication and authorization are needed before deploying it for real multi-user business use. The production React build is generated in `web/dist`; this project currently serves the demo through Vite.

Requested `npx ui-skills` CLI was executed, but its remote guidance fetch was blocked by network access to ui-skills.com. No unavailable guidance is claimed as applied.
