import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource-variable/dm-sans";
import {
  Package,
  Search,
  Plus,
  Upload,
  RotateCw,
  Pencil,
  Trash2,
  X,
  Minus,
  ArrowDown,
  SlidersHorizontal,
  AlertTriangle,
} from "lucide-react";
import "./style.css";
const categories = [
  ["all", "All products"],
  ["bedding", "Bedding"],
  ["living-space", "Living space"],
  ["decor", "Decor"],
];
const categoryName = (key) => categories.find((c) => c[0] === key)?.[1] || key;
const blank = {
  sku: "",
  name: "",
  category: "bedding",
  fabric_type: "",
  dimensions: "",
  current_stock: 0,
  reorder_level: 5,
};
async function request(url, options) {
  const response = await fetch(url, options);
  const data = response.status === 204 ? null : await response.json();
  if (!response.ok)
    throw Object.assign(
      Error(data?.error || data?.detail || "Request failed"),
      { product: data?.product },
    );
  return data;
}
const jsonOptions = (method, body) => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});
function Modal({ title, children, onClose }) {
  const ref = useRef();
  useEffect(() => {
    ref.current.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      <div className="modal-heading">
        <h2>{title}</h2>
        <button
          className="icon-button"
          aria-label="Close dialog"
          onClick={onClose}
        >
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
function ProductForm({ product, busy, error, onSave, onClose }) {
  const [form, setForm] = useState(product || blank);
  function field(key, label, type = "text", max = 200) {
    return (
      <label>
        {label}
        <input
          autoFocus={key === "name"}
          name={key}
          type={type}
          required={["name", "sku", "current_stock", "reorder_level"].includes(
            key,
          )}
          min={type === "number" ? 0 : undefined}
          max={type === "number" ? 1000000 : undefined}
          step={type === "number" ? 1 : undefined}
          maxLength={max}
          value={form[key]}
          onChange={(e) => setForm({ ...form, [key]: e.target.value })}
        />
      </label>
    );
  }
  return (
    <Modal
      title={product ? "Edit product" : "New product"}
      onClose={() => !busy && onClose()}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSave({
            ...form,
            current_stock: Number(form.current_stock),
            reorder_level: Number(form.reorder_level),
          });
        }}
      >
        <p className="form-description">
          One SKU per size and fabric combination.
        </p>
        <div className="form-grid">
          <div className="wide">{field("name", "Product name")}</div>
          {field("sku", "SKU", "text", 100)}
          <label>
            Category
            <select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            >
              {categories.slice(1).map(([key, name]) => (
                <option key={key} value={key}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          {field("fabric_type", "Fabric")}
          {field("dimensions", "Dimensions")}
          {field("current_stock", "Stock quantity", "number")}
          {field("reorder_level", "Reorder threshold", "number")}
        </div>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="modal-footer">
          <button type="button" disabled={busy} onClick={onClose}>
            Cancel
          </button>
          <button className="primary" disabled={busy}>
            {busy ? "Saving…" : product ? "Save changes" : "Create product"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
function App() {
  const [products, setProducts] = useState([]),
    [loading, setLoading] = useState(true),
    [category, setCategory] = useState("all"),
    [search, setSearch] = useState(""),
    [status, setStatus] = useState("all"),
    [sort, setSort] = useState("name"),
    [pending, setPending] = useState(null),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [editor, setEditor] = useState(null),
    [deleting, setDeleting] = useState(null),
    [formError, setFormError] = useState("");
  async function load() {
    setLoading(true);
    try {
      const data = await request("/api/products");
      setProducts(data.products);
      setError("");
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, []);
  function begin() {
    setError("");
    setNotice("");
    setFormError("");
  }
  async function adjust(product, delta) {
    if (pending) return;
    begin();
    setPending(product.id);
    setProducts((items) =>
      items.map((p) =>
        p.id === product.id
          ? {
              ...p,
              current_stock: p.current_stock + delta,
              reorder_alert: p.current_stock + delta <= p.reorder_level,
            }
          : p,
      ),
    );
    try {
      const data = await request(
        `/api/products/${product.id}/stock`,
        jsonOptions("PATCH", {
          delta,
          expectedVersion: product.version,
          requestId: crypto.randomUUID(),
        }),
      );
      setProducts((items) =>
        items.map((p) => (p.id === product.id ? data.product : p)),
      );
      setNotice(
        `${product.name}: ${data.product.current_stock} units in stock.`,
      );
    } catch (e) {
      setProducts((items) =>
        items.map((p) => (p.id === product.id ? e.product || product : p)),
      );
      setError(e.message + " Refresh before retrying.");
    } finally {
      setPending(null);
    }
  }
  async function save(form) {
    setPending("save");
    setFormError("");
    const existing = editor?.product;
    try {
      const data = await request(
        existing ? `/api/products/${existing.id}` : "/api/products",
        jsonOptions(existing ? "PUT" : "POST", {
          ...form,
          ...(existing ? { expectedVersion: existing.version } : {}),
        }),
      );
      setProducts((items) =>
        existing
          ? items.map((p) => (p.id === existing.id ? data.product : p))
          : [...items, data.product],
      );
      setNotice(existing ? "Product updated." : "Product created.");
      setEditor(null);
    } catch (e) {
      setFormError(e.message);
      if (e.product)
        setProducts((items) =>
          items.map((p) => (p.id === e.product.id ? e.product : p)),
        );
    } finally {
      setPending(null);
    }
  }
  async function remove() {
    setPending("delete");
    setFormError("");
    try {
      await request(
        `/api/products/${deleting.id}`,
        jsonOptions("DELETE", { expectedVersion: deleting.version }),
      );
      setProducts((items) => items.filter((p) => p.id !== deleting.id));
      setNotice("Product deleted.");
      setDeleting(null);
    } catch (e) {
      setFormError(e.message);
    } finally {
      setPending(null);
    }
  }
  async function importFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    begin();
    setPending("import");
    const form = new FormData();
    form.append("file", file);
    try {
      const data = await request("/excel/import", {
        method: "POST",
        body: form,
      });
      await load();
      setNotice(`Imported ${data.imported} product variants.`);
    } catch (e) {
      setError(e.message);
    } finally {
      setPending(null);
      event.target.value = "";
    }
  }
  const low = products.filter((p) => p.reorder_alert).length;
  const visible = products
    .filter(
      (p) =>
        (category === "all" || p.category === category) &&
        (status === "all" ||
          (status === "low" ? p.reorder_alert : p.current_stock === 0)) &&
        `${p.name} ${p.sku} ${p.fabric_type} ${p.dimensions}`
          .toLowerCase()
          .includes(search.toLowerCase()),
    )
    .sort((a, b) =>
      sort === "stock"
        ? a.current_stock - b.current_stock
        : a.name.localeCompare(b.name),
    );
  return (
    <div className="app">
      <aside className="sidebar">
        <a href="#" className="logo">
          <Package size={24} />
          <span>E-Depo</span>
        </a>
        <div className="store-label">Nuka Selection</div>
        <nav aria-label="Inventory views">
          <button
            className={status === "all" ? "nav-item selected" : "nav-item"}
            onClick={() => setStatus("all")}
          >
            <Package size={17} />
            Inventory<span>{products.length}</span>
          </button>
          <button
            className={status === "low" ? "nav-item selected" : "nav-item"}
            onClick={() => setStatus("low")}
          >
            <AlertTriangle size={17} />
            Low stock<span>{low}</span>
          </button>
        </nav>
        <div className="sidebar-bottom">Inventory management</div>
      </aside>
      <main>
        <header className="topbar">
          <span>Inventory / Products</span>
          <button
            className="icon-button"
            aria-label="Refresh inventory"
            disabled={!!pending || loading}
            onClick={load}
          >
            <RotateCw size={17} />
          </button>
        </header>
        <div className="page">
          <section className="page-heading">
            <div>
              <h1>Inventory</h1>
              <p>Manage products, variants and stock levels.</p>
            </div>
            <div className="heading-actions">
              <label className="button import">
                <Upload size={16} />{" "}
                {pending === "import" ? "Importing…" : "Import Excel"}
                <input
                  aria-label="Import Excel inventory"
                  disabled={!!pending}
                  type="file"
                  accept=".xlsx"
                  onChange={importFile}
                />
              </label>
              <button
                className="primary"
                disabled={!!pending}
                onClick={() => {
                  begin();
                  setEditor({ product: null });
                }}
              >
                <Plus size={17} />
                New product
              </button>
            </div>
          </section>
          <section className="summary" aria-label="Inventory summary">
            <div>
              <span>Total products</span>
              <strong>{products.length}</strong>
            </div>
            <div>
              <span>Units in stock</span>
              <strong>
                {products
                  .reduce((n, p) => n + p.current_stock, 0)
                  .toLocaleString()}
              </strong>
            </div>
            <button onClick={() => setStatus(status === "low" ? "all" : "low")}>
              <span>
                Low stock <AlertTriangle size={14} />
              </span>
              <strong className="amber">{low}</strong>
            </button>
            <div>
              <span>Out of stock</span>
              <strong>
                {products.filter((p) => p.current_stock === 0).length}
              </strong>
            </div>
          </section>
          {error && (
            <div className="message error" role="alert">
              {error}
            </div>
          )}
          <div className={notice ? "message success" : "sr-only"} role="status">
            {notice}
          </div>
          <section className="inventory">
            <nav className="tabs" aria-label="Category filters">
              {categories.map(([key, label]) => (
                <button
                  key={key}
                  aria-label={label}
                  aria-pressed={category === key}
                  className={category === key ? "active" : ""}
                  onClick={() => setCategory(key)}
                >
                  {label}
                  <span>
                    {
                      products.filter(
                        (p) => key === "all" || p.category === key,
                      ).length
                    }
                  </span>
                </button>
              ))}
            </nav>
            <div className="toolbar">
              <label className="search">
                <Search size={17} />
                <input
                  aria-label="Search inventory"
                  placeholder="Search by name, SKU, fabric…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                {search && (
                  <button
                    aria-label="Clear search"
                    onClick={() => setSearch("")}
                  >
                    <X size={15} />
                  </button>
                )}
              </label>
              <div className="filters">
                <label>
                  <SlidersHorizontal size={15} />
                  <select
                    aria-label="Stock filter"
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                  >
                    <option value="all">All stock levels</option>
                    <option value="low">Low stock</option>
                    <option value="out">Out of stock</option>
                  </select>
                </label>
                <label>
                  <ArrowDown size={15} />
                  <select
                    aria-label="Sort products"
                    value={sort}
                    onChange={(e) => setSort(e.target.value)}
                  >
                    <option value="name">Name A–Z</option>
                    <option value="stock">Lowest stock</option>
                  </select>
                </label>
              </div>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Category</th>
                    <th>Variant</th>
                    <th>Stock</th>
                    <th>Status</th>
                    <th className="right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <button
                          className="product-name"
                          disabled={!!pending}
                          onClick={() => {
                            begin();
                            setEditor({ product: p });
                          }}
                        >
                          {p.name}
                        </button>
                        <small className="sku">{p.sku}</small>
                      </td>
                      <td className="category-cell">
                        {categoryName(p.category)}
                      </td>
                      <td className="variant">
                        <span>{p.fabric_type || "—"}</span>
                        <small>{p.dimensions || "—"}</small>
                      </td>
                      <td>
                        <div className="stock-control">
                          <button
                            aria-label={`Sell one ${p.name}`}
                            disabled={!!pending || p.current_stock === 0}
                            onClick={() => adjust(p, -1)}
                          >
                            <Minus size={13} />
                          </button>
                          <strong>{p.current_stock}</strong>
                          <button
                            aria-label={`Add one ${p.name}`}
                            disabled={!!pending}
                            onClick={() => adjust(p, 1)}
                          >
                            <Plus size={13} />
                          </button>
                        </div>
                      </td>
                      <td>
                        <span
                          className={
                            "badge " +
                            (p.current_stock === 0
                              ? "out"
                              : p.reorder_alert
                                ? "low"
                                : "ok")
                          }
                        >
                          <i />
                          {p.current_stock === 0
                            ? "Out of stock"
                            : p.reorder_alert
                              ? "Low stock"
                              : "In stock"}
                        </span>
                      </td>
                      <td>
                        <div className="row-actions">
                          <button
                            className="icon-button"
                            aria-label={`Edit ${p.name}`}
                            disabled={!!pending}
                            onClick={() => {
                              begin();
                              setEditor({ product: p });
                            }}
                          >
                            <Pencil size={16} />
                          </button>
                          <button
                            className="icon-button delete"
                            aria-label={`Delete ${p.name}`}
                            disabled={!!pending}
                            onClick={() => {
                              begin();
                              setDeleting(p);
                            }}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {loading && <div className="empty">Loading inventory…</div>}
            {!loading && !visible.length && (
              <div className="empty">
                <Package size={28} />
                <h2>
                  {products.length
                    ? "No matching products"
                    : "Your inventory is empty"}
                </h2>
                <p>
                  {products.length
                    ? "Change your search or filters."
                    : "Add a product or import an Excel workbook to get started."}
                </p>
                <button
                  onClick={() => {
                    setSearch("");
                    setCategory("all");
                    setStatus("all");
                  }}
                >
                  Clear filters
                </button>
              </div>
            )}
            <footer className="table-footer">
              <span>
                {visible.length} of {products.length} products
              </span>
              <span>Stock quantities are per SKU</span>
            </footer>
          </section>
        </div>
      </main>
      {editor && (
        <ProductForm
          product={editor.product}
          busy={!!pending}
          error={formError}
          onSave={save}
          onClose={() => setEditor(null)}
        />
      )}{" "}
      {deleting && (
        <Modal
          title="Delete product?"
          onClose={() => !pending && setDeleting(null)}
        >
          <p className="delete-copy">
            Remove <strong>{deleting.name}</strong> ({deleting.sku}) from
            inventory? Its stock history will be retained.
          </p>
          {formError && (
            <p className="form-error" role="alert">
              {formError}
            </p>
          )}
          <div className="modal-footer">
            <button disabled={!!pending} onClick={() => setDeleting(null)}>
              Cancel
            </button>
            <button className="danger" disabled={!!pending} onClick={remove}>
              {pending ? "Deleting…" : "Delete product"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
createRoot(document.getElementById("root")).render(<App />);
