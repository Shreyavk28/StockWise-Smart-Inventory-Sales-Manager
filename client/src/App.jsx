import { useState, useMemo, useEffect, useCallback } from "react";

import "./App.css";

const CATEGORIES = ["Electronics", "Clothing", "Food", "Stationery", "Other"];

const EMPTY_FORM = {

  name: "",

  sku: "",

  category: "",

  sellingPrice: "",

  quantity: "",

  minStockLevel: "5",

  supplier: "",

};

const currency = new Intl.NumberFormat("en-IN", {

  style: "currency",

  currency: "INR",

});

const formatCurrency = (value) => currency.format(Number(value) || 0);

async function readApiResponse(response) {

  let result;

  try {

    result = await response.json();

  } catch {

    throw new Error("The server returned an invalid response.");

  }

  if (!response.ok || result.success === false) {

    throw new Error(

      result.message ||

        result.error ||

        `Request failed with status ${response.status}.`

    );

  }

  return result;

}

function normalizeProduct(product) {

  return {

    ...product,

    id: String(product._id || product.id),

    quantity: Number(product.quantity ?? 0),

    minStockLevel: Number(product.minStockLevel ?? 5),

    sellingPrice: Number(product.sellingPrice ?? 0),

    supplier: product.supplier || "",

  };

}

function stockStatus(product) {

  const quantity = Number(product.quantity ?? 0);

  const minimum = Number(product.minStockLevel ?? 5);

  if (quantity <= 0) return "out-of-stock";

  if (quantity <= minimum) return "low-stock";

  return "in-stock";

}

function stockLabel(status) {

  if (status === "out-of-stock") return "Out of Stock";

  if (status === "low-stock") return "Low Stock";

  return "In Stock";

}

function Sidebar({ activeView, onNavigate }) {

  const items = [

    { id: "dashboard", label: "Dashboard", icon: "⊞" },

    { id: "products", label: "Products", icon: "📦" },

    { id: "sales", label: "Sales", icon: "🛒" },

    { id: "movements", label: "Stock Log", icon: "📋" },

  ];

  return (

    <aside className="sidebar">

      <div className="sidebar-brand">

        <span className="brand-icon">📊</span>

        <span className="brand-name">StockWise</span>

      </div>

      <nav className="sidebar-nav" aria-label="Main navigation">

        {items.map((item) => (

          <button

            key={item.id}

            className={`nav-item${activeView === item.id ? " active" : ""}`}

            onClick={() => onNavigate(item.id)}

            aria-current={activeView === item.id ? "page" : undefined}

          >

            <span className="nav-icon" aria-hidden="true">

              {item.icon}

            </span>

            <span className="nav-label">{item.label}</span>

          </button>

        ))}

      </nav>

      <div className="sidebar-footer">

        <span className="sidebar-version">v1.0 · StartupMeu</span>

      </div>

    </aside>

  );

}

function StatCard({ label, value, sub, accent = false }) {

  return (

    <div className={`stat-card${accent ? " stat-card--accent" : ""}`}>

      <span className="stat-label">{label}</span>

      <span className="stat-value">{value}</span>

      {sub && <span className="stat-sub">{sub}</span>}

    </div>

  );

}

function StockBadge({ product }) {

  const status = stockStatus(product);

  return (

    <span

      className={`badge badge--${status}`}

      aria-label={stockLabel(status)}

    >

      {stockLabel(status)}

    </span>

  );

}

function ProductModal({ initialProduct = null, onClose, onSave }) {

  const isEditing = Boolean(initialProduct);

  const [form, setForm] = useState(() =>

    initialProduct

      ? {

          name: initialProduct.name || "",

          sku: initialProduct.sku || "",

          category: initialProduct.category || "",

          sellingPrice: String(initialProduct.sellingPrice ?? ""),

          quantity: String(initialProduct.quantity ?? ""),

          minStockLevel: String(initialProduct.minStockLevel ?? 5),

          supplier: initialProduct.supplier || "",

        }

      : { ...EMPTY_FORM }

  );

  const [errors, setErrors] = useState({});

  const [saving, setSaving] = useState(false);

  function handleChange(event) {

    const { name, value } = event.target;

    setForm((prev) => ({ ...prev, [name]: value }));

    setErrors((prev) => ({ ...prev, [name]: undefined, form: undefined }));

  }

  function validate() {

    const next = {};

    if (!form.name.trim()) {

      next.name = "Product name is required.";

    }

    if (!isEditing && !form.sku.trim()) {

      next.sku = "SKU is required.";

    }

    if (!form.category) {

      next.category = "Select a category.";

    }

    if (

      form.sellingPrice === "" ||

      !Number.isFinite(Number(form.sellingPrice)) ||

      Number(form.sellingPrice) <= 0

    ) {

      next.sellingPrice = "Enter a price greater than 0.";

    }

    if (

      form.quantity === "" ||

      !Number.isInteger(Number(form.quantity)) ||

      Number(form.quantity) < 0

    ) {

      next.quantity = "Enter a whole number greater than or equal to 0.";

    }

    if (

      form.minStockLevel === "" ||

      !Number.isInteger(Number(form.minStockLevel)) ||

      Number(form.minStockLevel) < 0

    ) {

      next.minStockLevel =

        "Enter a whole number greater than or equal to 0.";

    }

    return next;

  }

  async function handleSubmit(event) {

    event.preventDefault();

    const next = validate();

    if (Object.keys(next).length) {

      setErrors(next);

      return;

    }

    const product = {

      name: form.name.trim(),

      category: form.category,

      sellingPrice: Number(form.sellingPrice),

      quantity: Number(form.quantity),

      minStockLevel: Number(form.minStockLevel),

      supplier: form.supplier.trim(),

    };

    if (!isEditing) {

      product.sku = form.sku.trim().toUpperCase();

    }

    setSaving(true);

    setErrors({});

    try {

      await onSave(product, initialProduct?.id);

      onClose();

    } catch (error) {

      setErrors({

        form: error.message || "Unable to save product.",

      });

    } finally {

      setSaving(false);

    }

  }

  return (

    <div className="modal-backdrop" role="presentation">

      <div

        className="modal"

        role="dialog"

        aria-modal="true"

        aria-labelledby="product-modal-title"

      >

        <div className="modal-header">

          <h2 id="product-modal-title">

            {isEditing ? "Edit Product" : "Add New Product"}

          </h2>

          <button

            type="button"

            className="modal-close"

            onClick={onClose}

            disabled={saving}

            aria-label="Close"

          >

            ×

          </button>

        </div>

        <form className="modal-form" onSubmit={handleSubmit} noValidate>

          <div className="form-row">

            <label className="form-label" htmlFor="product-name">

              Product Name *

            </label>

            <input

              id="product-name"

              name="name"

              className="form-input"

              value={form.name}

              onChange={handleChange}

              placeholder="e.g. Wireless Headphones"

            />

            {errors.name && (

              <span className="field-error">{errors.name}</span>

            )}

          </div>

          <div className="form-row-2col">

            <div className="form-row">

              <label className="form-label" htmlFor="product-sku">

                SKU *

              </label>

              <input

                id="product-sku"

                name="sku"

                className="form-input"

                value={form.sku}

                onChange={handleChange}

                disabled={isEditing}

                placeholder="e.g. ELEC-001"

              />

              {isEditing && (

                <span className="form-hint">SKU cannot be changed.</span>

              )}

              {errors.sku && (

                <span className="field-error">{errors.sku}</span>

              )}

            </div>

            <div className="form-row">

              <label className="form-label" htmlFor="product-category">

                Category *

              </label>

              <select

                id="product-category"

                name="category"

                className="form-input"

                value={form.category}

                onChange={handleChange}

              >

                <option value="">Select category</option>

                {CATEGORIES.map((category) => (

                  <option key={category} value={category}>

                    {category}

                  </option>

                ))}

              </select>

              {errors.category && (

                <span className="field-error">{errors.category}</span>

              )}

            </div>

          </div>

          <div className="form-row-2col">

            <div className="form-row">

              <label className="form-label" htmlFor="product-price">

                Selling Price (₹) *

              </label>

              <input

                id="product-price"

                name="sellingPrice"

                type="number"

                min="0.01"

                step="0.01"

                className="form-input"

                value={form.sellingPrice}

                onChange={handleChange}

              />

              {errors.sellingPrice && (

                <span className="field-error">{errors.sellingPrice}</span>

              )}

            </div>

            <div className="form-row">

              <label className="form-label" htmlFor="product-quantity">

                Quantity *

              </label>

              <input

                id="product-quantity"

                name="quantity"

                type="number"

                min="0"

                step="1"

                className="form-input"

                value={form.quantity}

                onChange={handleChange}

              />

              {errors.quantity && (

                <span className="field-error">{errors.quantity}</span>

              )}

            </div>

          </div>

          <div className="form-row-2col">

            <div className="form-row">

              <label className="form-label" htmlFor="product-min-stock">

                Min Stock Level *

              </label>

              <input

                id="product-min-stock"

                name="minStockLevel"

                type="number"

                min="0"

                step="1"

                className="form-input"

                value={form.minStockLevel}

                onChange={handleChange}

              />

              {errors.minStockLevel && (

                <span className="field-error">{errors.minStockLevel}</span>

              )}

            </div>

            <div className="form-row">

              <label className="form-label" htmlFor="product-supplier">

                Supplier

              </label>

              <input

                id="product-supplier"

                name="supplier"

                className="form-input"

                value={form.supplier}

                onChange={handleChange}

                placeholder="Optional"

              />

            </div>

          </div>

          {errors.form && (

            <p className="field-error" role="alert">

              {errors.form}

            </p>

          )}

          <div className="modal-actions">

            <button

              type="button"

              className="btn btn--secondary"

              onClick={onClose}

              disabled={saving}

            >

              Cancel

            </button>

            <button

              type="submit"

              className="btn btn--primary"

              disabled={saving}

            >

              {saving

                ? "Saving..."

                : isEditing

                  ? "Save Changes"

                  : "Add Product"}

            </button>

          </div>

        </form>

      </div>

    </div>

  );

}

function ProductsView({

  products,

  onAdd,

  onUpdate,

  onDelete,

  loading,

  error,

  onRetry,

}) {

  const [search, setSearch] = useState("");

  const [categoryFilter, setCategoryFilter] = useState("");

  const [showAdd, setShowAdd] = useState(false);

  const [editing, setEditing] = useState(null);

  const [deleteTarget, setDeleteTarget] = useState(null);

  const [deleting, setDeleting] = useState(false);

  const [deleteError, setDeleteError] = useState("");

  const filtered = useMemo(() => {

    const query = search.trim().toLowerCase();

    return products.filter(

      (product) =>

        (!query ||

          String(product.name || "").toLowerCase().includes(query) ||

          String(product.sku || "").toLowerCase().includes(query)) &&

        (!categoryFilter || product.category === categoryFilter)

    );

  }, [products, search, categoryFilter]);

  async function confirmDelete() {

    if (!deleteTarget || deleting) return;

    setDeleting(true);

    setDeleteError("");

    try {

      await onDelete(deleteTarget.id);

      setDeleteTarget(null);

    } catch (error) {

      setDeleteError(error.message || "Unable to delete product.");

    } finally {

      setDeleting(false);

    }

  }

  return (

    <div className="view">

      <div className="view-header">

        <div>

          <h1 className="view-title">Products</h1>

          <p className="view-subtitle">Manage your inventory</p>

        </div>

        <button

          className="btn btn--primary"

          onClick={() => setShowAdd(true)}

          disabled={loading}

        >

          + Add Product

        </button>

      </div>

      <div className="toolbar">

        <input

          className="toolbar-search"

          type="search"

          placeholder="Search by name or SKU..."

          value={search}

          onChange={(event) => setSearch(event.target.value)}

          aria-label="Search products"

        />

        <select

          className="toolbar-filter"

          value={categoryFilter}

          onChange={(event) => setCategoryFilter(event.target.value)}

          aria-label="Filter by category"

        >

          <option value="">All Categories</option>

          {CATEGORIES.map((category) => (

            <option key={category} value={category}>

              {category}

            </option>

          ))}

        </select>

      </div>

      {loading ? (

        <div className="empty-state">Loading products...</div>

      ) : error ? (

        <div className="empty-state" role="alert">

          <p>{error}</p>

          <button className="btn btn--secondary" onClick={onRetry}>

            Retry

          </button>

        </div>

      ) : filtered.length === 0 ? (

        <div className="empty-state">

          <span className="empty-icon">📭</span>

          <p>

            No products found

            {search || categoryFilter ? " matching your filters" : "."}

          </p>

          {!search && !categoryFilter && (

            <button

              className="btn btn--primary"

              onClick={() => setShowAdd(true)}

            >

              Add your first product

            </button>

          )}

        </div>

      ) : (

        <div className="table-wrapper">

          <table className="product-table">

            <thead>

              <tr>

                {[

                  "Product",

                  "SKU",

                  "Category",

                  "Price",

                  "Sold",

                  "Available",

                  "Min Stock",

                  "Supplier",

                  "Status",

                  "Actions",

                ].map((heading) => (

                  <th key={heading}>{heading}</th>

                ))}

              </tr>

            </thead>

            <tbody>

              {filtered.map((product) => {

                const sold = Number(product.sold || 0);

                const available = Number(product.quantity || 0);

                return (

                  <tr key={product.id}>

                    <td className="td-name">{product.name}</td>

                    <td className="td-sku">

                      <code>{product.sku}</code>

                    </td>

                    <td>{product.category}</td>

                    <td>{formatCurrency(product.sellingPrice)}</td>

                    <td className="td-qty">{sold}</td>

                    <td className="td-qty">{available}</td>

                    <td>{product.minStockLevel}</td>

                    <td>{product.supplier || "—"}</td>

                    <td>

                      <StockBadge product={product} />

                    </td>

                    <td>

                      <div className="product-actions">

                        <button

                          className="btn btn--secondary"

                          onClick={() => setEditing(product)}

                        >

                          ✏️ Edit

                        </button>

                        <button

                          className="btn-icon btn-icon--danger"

                          onClick={() => {

                            setDeleteTarget(product);

                            setDeleteError("");

                          }}

                          aria-label={`Delete ${product.name}`}

                        >

                          🗑

                        </button>

                      </div>

                    </td>

                  </tr>

                );

              })}

            </tbody>

          </table>

        </div>

      )}

      {showAdd && (

        <ProductModal

          onClose={() => setShowAdd(false)}

          onSave={onAdd}

        />

      )}

      {editing && (

        <ProductModal

          key={editing.id}

          initialProduct={editing}

          onClose={() => setEditing(null)}

          onSave={onUpdate}

        />

      )}

      {deleteTarget && (

        <div className="modal-backdrop" role="presentation">

          <div

            className="modal modal--sm"

            role="dialog"

            aria-modal="true"

            aria-labelledby="delete-title"

          >

            <div className="modal-header">

              <h2 id="delete-title">Delete Product</h2>

            </div>

            <p className="confirm-body">

              Are you sure you want to delete{" "}

              <strong>{deleteTarget.name}</strong>? This action cannot be

              undone.

            </p>

            {deleteError && (

              <p className="field-error modal-inline-error">{deleteError}</p>

            )}

            <div className="modal-actions">

              <button

                className="btn btn--secondary"

                onClick={() => setDeleteTarget(null)}

                disabled={deleting}

              >

                Cancel

              </button>

              <button

                className="btn btn--danger"

                onClick={confirmDelete}

                disabled={deleting}

              >

                {deleting ? "Deleting..." : "Delete"}

              </button>

            </div>

          </div>

        </div>

      )}

    </div>

  );

}

function DashboardView({
  products,
  sales,
  onNavigate,
  loading,
  error,
  onRetry,
}) {
  const inventoryValue = products.reduce(
    (sum, product) => sum + product.sellingPrice * product.quantity,
    0
  );

  const needsAttention = products
    .filter((product) => stockStatus(product) !== "in-stock")
    .sort((a, b) => a.quantity - b.quantity);

  const totalUnits = products.reduce(
    (sum, product) => sum + product.quantity,
    0
  );

  const salesTotal = sales.reduce(
    (sum, sale) => sum + Number(sale.totalAmount || 0),
    0
  );

  const unitsSold = sales.reduce(
    (sum, sale) => sum + Number(sale.quantity || 0),
    0
  );

  const recentSales = [...sales]
    .sort(
      (a, b) =>
        new Date(b.createdAt || b.saleDate || 0).getTime() -
        new Date(a.createdAt || a.saleDate || 0).getTime()
    )
    .slice(0, 5);

  const topProducts = [...products]
    .sort((a, b) => Number(b.sold || 0) - Number(a.sold || 0))
    .slice(0, 5);

  const maxSold = Math.max(1, ...topProducts.map((product) => Number(product.sold || 0)));

  const weeklySales = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - (6 - index));
    const nextDate = new Date(date);
    nextDate.setDate(nextDate.getDate() + 1);
    const amount = sales.reduce((sum, sale) => {
      const saleDate = sale.createdAt ? new Date(sale.createdAt) : null;
      return saleDate && saleDate >= date && saleDate < nextDate
        ? sum + Number(sale.totalAmount || 0)
        : sum;
    }, 0);
    return {
      label: date.toLocaleDateString("en-IN", { weekday: "short" }),
      amount,
    };
  });
  const maxDailySales = Math.max(1, ...weeklySales.map((day) => day.amount));

  return (
    <div className="view dashboard-view">
      <section className="dashboard-hero">
        <div className="dashboard-hero-copy">
          <span className="dashboard-eyebrow">
            <span className="dashboard-eyebrow-dot" />
            INVENTORY OVERVIEW
          </span>
          <h1>Good to see you again 👋</h1>
          <p>
            Here’s your business at a glance. Track stock, review sales, and
            keep everything moving.
          </p>
          <div className="dashboard-hero-actions">
            <button
              className="btn btn--hero-primary"
              onClick={() => onNavigate("products")}
            >
              <span aria-hidden="true">＋</span> Manage inventory
            </button>
            <button
              className="btn btn--hero-secondary"
              onClick={() => onNavigate("sales")}
            >
              View sales <span aria-hidden="true">↗</span>
            </button>
          </div>
        </div>
        <div className="dashboard-hero-art" aria-hidden="true">
          <div className="hero-art-orbit hero-art-orbit--one" />
          <div className="hero-art-orbit hero-art-orbit--two" />
          <div className="hero-art-card">
            <span className="hero-art-icon">📦</span>
            <span className="hero-art-card-label">Stock tracked</span>
            <strong>{totalUnits.toLocaleString("en-IN")} units</strong>
            <span className="hero-art-card-foot">Across your inventory</span>
          </div>
          <span className="hero-art-spark hero-art-spark--one">✦</span>
          <span className="hero-art-spark hero-art-spark--two">✧</span>
        </div>
      </section>

      {error && (
        <div className="inline-alert inline-alert--error" role="alert">
          <span>{error}</span>
          <button className="btn btn--secondary" onClick={onRetry}>
            Retry
          </button>
        </div>
      )}

      {loading ? (
        <div className="empty-state">Loading inventory...</div>
      ) : (
        <>
          <div className="dashboard-section-heading">
            <div>
              <h2>Business snapshot</h2>
              <p>Key numbers from your current inventory and sales.</p>
            </div>
            <span className="dashboard-live-label">
              <span /> Live data
            </span>
          </div>

          <div className="dashboard-metric-grid">
            <article className="dashboard-metric-card">
              <div className="metric-card-top">
                <span className="metric-icon metric-icon--violet">▦</span>
                <span className="metric-card-kicker">CATALOGUE</span>
              </div>
              <span className="metric-card-label">Total products</span>
              <strong className="metric-card-value">
                {products.length.toLocaleString("en-IN")}
              </strong>
              <span className="metric-card-foot">Unique active SKUs</span>
            </article>

            <article className="dashboard-metric-card">
              <div className="metric-card-top">
                <span className="metric-icon metric-icon--blue">₹</span>
                <span className="metric-card-kicker">IN STOCK</span>
              </div>
              <span className="metric-card-label">Inventory value</span>
              <strong className="metric-card-value metric-card-value--purple">
                {formatCurrency(inventoryValue)}
              </strong>
              <span className="metric-card-foot">At current selling prices</span>
            </article>

            <article className="dashboard-metric-card">
              <div className="metric-card-top">
                <span className="metric-icon metric-icon--amber">!</span>
                <span className="metric-card-kicker">ACTION NEEDED</span>
              </div>
              <span className="metric-card-label">Stock alerts</span>
              <strong className={`metric-card-value${needsAttention.length ? " metric-card-value--warning" : ""}`}>
                {needsAttention.length.toLocaleString("en-IN")}
              </strong>
              <span className="metric-card-foot">
                {needsAttention.length
                  ? "Products need your attention"
                  : "All products are above minimum stock"}
              </span>
            </article>

            <article className="dashboard-metric-card">
              <div className="metric-card-top">
                <span className="metric-icon metric-icon--green">↗</span>
                <span className="metric-card-kicker">SALES ACTIVITY</span>
              </div>
              <span className="metric-card-label">Units sold</span>
              <strong className="metric-card-value">
                {unitsSold.toLocaleString("en-IN")}
              </strong>
              <span className="metric-card-foot">
                {sales.length.toLocaleString("en-IN")} recorded transactions
              </span>
            </article>
          </div>

          <div className="dashboard-content-grid">
            <section className="dashboard-panel dashboard-sales-panel">
              <div className="dashboard-panel-heading">
                <div>
                  <span className="dashboard-panel-eyebrow">REVENUE</span>
                  <h2>Sales overview</h2>
                  <p>Total value of all recorded sales</p>
                </div>
                <button
                  className="dashboard-text-link"
                  onClick={() => onNavigate("sales")}
                >
                  View sales <span aria-hidden="true">→</span>
                </button>
              </div>
              <div className="dashboard-revenue-value">
                {formatCurrency(salesTotal)}
              </div>
              <div className="dashboard-revenue-meta">
                <span className="revenue-meta-icon">↗</span>
                <span>Across {sales.length} transaction{sales.length === 1 ? "" : "s"}</span>
              </div>
              <div className="dashboard-revenue-visual dashboard-weekly-chart">
                <div className="revenue-visual-line" />
                <div className="revenue-visual-bars">
                  {weeklySales.map((day) => (
                    <div className="revenue-day" key={day.label}>
                      <span
                        className={`revenue-bar${day.amount === Math.max(...weeklySales.map((item) => item.amount)) && day.amount > 0 ? " revenue-bar--highlight" : ""}`}
                        style={{ height: `${day.amount > 0 ? Math.max(8, (day.amount / maxDailySales) * 100) : 3}%` }}
                        title={`${day.label}: ${formatCurrency(day.amount)}`}
                      />
                      <span className="revenue-day-label">{day.label}</span>
                    </div>
                  ))}
                </div>
              </div>
              <p className="dashboard-chart-note">
                Daily sales for the last 7 days · {formatCurrency(weeklySales.reduce((sum, day) => sum + day.amount, 0))} total
              </p>
            </section>

            <section className="dashboard-panel dashboard-stock-panel">
              <div className="dashboard-panel-heading">
                <div>
                  <span className="dashboard-panel-eyebrow">INVENTORY HEALTH</span>
                  <h2>Stock health</h2>
                  <p>Current product availability</p>
                </div>
                <span className="dashboard-panel-icon">◉</span>
              </div>
              <div className="stock-health-total">
                <strong>{products.length}</strong>
                <span>products tracked</span>
              </div>
              <div className="stock-health-list">
                <div className="stock-health-row">
                  <span className="stock-health-dot stock-health-dot--good" />
                  <span>In stock</span>
                  <strong>
                    {products.filter((product) => stockStatus(product) === "in-stock").length}
                  </strong>
                </div>
                <div className="stock-health-track">
                  <span
                    className="stock-health-fill stock-health-fill--good"
                    style={{
                      width: `${products.length ? (products.filter((product) => stockStatus(product) === "in-stock").length / products.length) * 100 : 0}%`,
                    }}
                  />
                </div>
                <div className="stock-health-row">
                  <span className="stock-health-dot stock-health-dot--low" />
                  <span>Low stock</span>
                  <strong>
                    {products.filter((product) => stockStatus(product) === "low-stock").length}
                  </strong>
                </div>
                <div className="stock-health-track">
                  <span
                    className="stock-health-fill stock-health-fill--low"
                    style={{
                      width: `${products.length ? (products.filter((product) => stockStatus(product) === "low-stock").length / products.length) * 100 : 0}%`,
                    }}
                  />
                </div>
                <div className="stock-health-row">
                  <span className="stock-health-dot stock-health-dot--out" />
                  <span>Out of stock</span>
                  <strong>
                    {products.filter((product) => stockStatus(product) === "out-of-stock").length}
                  </strong>
                </div>
                <div className="stock-health-track">
                  <span
                    className="stock-health-fill stock-health-fill--out"
                    style={{
                      width: `${products.length ? (products.filter((product) => stockStatus(product) === "out-of-stock").length / products.length) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>
              <button
                className="dashboard-outline-link"
                onClick={() => onNavigate("movements")}
              >
                Open stock log <span aria-hidden="true">→</span>
              </button>
            </section>
          </div>

          <div className="dashboard-bottom-grid">
            <section className="dashboard-panel dashboard-recent-panel">
              <div className="dashboard-panel-heading">
                <div>
                  <span className="dashboard-panel-eyebrow">LATEST ACTIVITY</span>
                  <h2>Recent sales</h2>
                  <p>Your latest recorded transactions</p>
                </div>
                <button
                  className="dashboard-text-link"
                  onClick={() => onNavigate("sales")}
                >
                  See all <span aria-hidden="true">→</span>
                </button>
              </div>

              {recentSales.length === 0 ? (
                <div className="dashboard-empty">
                  <span className="dashboard-empty-icon">🧾</span>
                  <strong>No sales yet</strong>
                  <p>Recorded sales will appear here.</p>
                  <button
                    className="dashboard-text-link"
                    onClick={() => onNavigate("sales")}
                  >
                    Record your first sale →
                  </button>
                </div>
              ) : (
                <div className="dashboard-recent-list">
                  {recentSales.map((sale, index) => (
                    <div className="dashboard-recent-row" key={sale._id || sale.id || `${sale.sku}-${sale.createdAt}-${index}`}>
                      <span className="recent-sale-icon">🧾</span>
                      <div className="recent-sale-info">
                        <strong>{sale.productName || sale.product?.name || "Product sale"}</strong>
                        <span>
                          {Number(sale.quantity || 0)} unit{Number(sale.quantity || 0) === 1 ? "" : "s"}
                          {" · "}
                          {sale.createdAt
                            ? new Date(sale.createdAt).toLocaleDateString("en-IN", {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                              })
                            : "Date unavailable"}
                        </span>
                      </div>
                      <strong className="recent-sale-amount">
                        {formatCurrency(sale.totalAmount)}
                      </strong>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="dashboard-panel dashboard-top-products">
              <div className="dashboard-panel-heading">
                <div>
                  <span className="dashboard-panel-eyebrow">PRODUCT PERFORMANCE</span>
                  <h2>Top products</h2>
                  <p>Ranked by units sold</p>
                </div>
                <span className="dashboard-panel-icon">★</span>
              </div>
              {topProducts.length === 0 ? (
                <div className="dashboard-empty">
                  <span className="dashboard-empty-icon">📦</span>
                  <strong>No products yet</strong>
                  <p>Add products to see inventory performance.</p>
                </div>
              ) : (
                <div className="top-products-list">
                  {topProducts.map((product, index) => {
                    const sold = Number(product.sold || 0);
                    return (
                      <div className="top-product-row" key={product.id}>
                        <span className="top-product-rank">{String(index + 1).padStart(2, "0")}</span>
                        <div className="top-product-details">
                          <div className="top-product-name-row">
                            <strong>{product.name}</strong>
                            <span>{sold} sold</span>
                          </div>
                          <div className="top-product-track">
                            <span
                              style={{ width: `${(sold / maxSold) * 100}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              <button
                className="dashboard-outline-link"
                onClick={() => onNavigate("products")}
              >
                Manage products <span aria-hidden="true">→</span>
              </button>
            </section>
          </div>

          {needsAttention.length > 0 && (
            <section className="dashboard-panel dashboard-alert-panel">
              <div className="dashboard-panel-heading">
                <div>
                  <span className="dashboard-panel-eyebrow">ACTION REQUIRED</span>
                  <h2>Stock alerts</h2>
                  <p>Review these products before they run out.</p>
                </div>
                <span className="stock-alert-count">{needsAttention.length} alert{needsAttention.length === 1 ? "" : "s"}</span>
              </div>
              <div className="alert-list">
                {needsAttention.map((product) => (
                  <div
                    key={product.id}
                    className={`alert-row alert-row--${stockStatus(product)}`}
                  >
                    <div className="alert-info">
                      <span className="alert-name">{product.name}</span>
                      <code className="alert-sku">{product.sku}</code>
                    </div>
                    <div className="alert-right">
                      <span className="alert-qty">{product.quantity} units left</span>
                      <StockBadge product={product} />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function SalesView({

  products,

  sales,

  salesLoading,

  salesError,

  onRetrySales,

  onRecordSale,

  submitting,

}) {

  const [productId, setProductId] = useState("");

  const [quantity, setQuantity] = useState("1");

  const [formError, setFormError] = useState("");

  const [successMessage, setSuccessMessage] = useState("");

  const selected = products.find((product) => product.id === productId);

  const amount =

    selected &&

    Number.isInteger(Number(quantity)) &&

    Number(quantity) > 0

      ? selected.sellingPrice * Number(quantity)

      : 0;

  const availableProducts = products.filter(

    (product) => product.quantity > 0

  );

  async function submit(event) {

    event.preventDefault();

    setFormError("");

    setSuccessMessage("");

    const qty = Number(quantity);

    if (!selected) {

      setFormError("Please select a product.");

      return;

    }

    if (!Number.isSafeInteger(qty) || qty <= 0) {

      setFormError("Enter a positive whole-number quantity.");

      return;

    }

    if (qty > selected.quantity) {

      setFormError(

        `Only ${selected.quantity} unit(s) are currently available.`

      );

      return;

    }

    try {

      await onRecordSale(productId, qty);

      setSuccessMessage(

        "Sale recorded successfully and inventory updated."

      );

      setQuantity("1");

      setProductId("");

    } catch (error) {

      setFormError(error.message || "Unable to record sale.");

    }

  }

  const salesTotal = sales.reduce(

    (sum, sale) => sum + Number(sale.totalAmount || 0),

    0

  );

  const unitsSold = sales.reduce(

    (sum, sale) => sum + Number(sale.quantity || 0),

    0

  );

  return (

    <div className="view">

      <div className="view-header">

        <div>

          <h1 className="view-title">Sales</h1>

          <p className="view-subtitle">

            Record sales and review transaction history

          </p>

        </div>

        <div className="sales-count-pill">

          {sales.length} recorded sale{sales.length === 1 ? "" : "s"}

        </div>

      </div>

      <div className="sales-layout">

        <section className="panel sale-form-panel">

          <div className="panel-heading">

            <div>

              <h2>Record a Sale</h2>

              <p>Select a product and quantity to sell.</p>

            </div>

            <span className="panel-icon">🛒</span>

          </div>

          <form className="sale-form" onSubmit={submit}>

            <div className="form-row">

              <label className="form-label" htmlFor="sale-product">

                Product *

              </label>

              <select

                id="sale-product"

                className="form-input"

                value={productId}

                onChange={(event) => {

                  setProductId(event.target.value);

                  setFormError("");

                  setSuccessMessage("");

                }}

                required

              >

                <option value="">Select a product</option>

                {availableProducts.map((product) => (

                  <option key={product.id} value={product.id}>

                    {product.name} · {product.sku} · {product.quantity} available

                  </option>

                ))}

              </select>

              {availableProducts.length === 0 && (

                <span className="form-hint">

                  No products currently have stock available.

                </span>

              )}

            </div>

            {selected && (

              <div className="selected-product-card">

                <div>

                  <span className="selected-product-label">UNIT PRICE</span>

                  <strong>{formatCurrency(selected.sellingPrice)}</strong>

                </div>

                <div>

                  <span className="selected-product-label">

                    AVAILABLE STOCK

                  </span>

                  <strong>{selected.quantity} units</strong>

                </div>

                <div>

                  <span className="selected-product-label">SKU</span>

                  <strong>{selected.sku}</strong>

                </div>

              </div>

            )}

            <div className="form-row">

              <label className="form-label" htmlFor="sale-quantity">

                Quantity to sell *

              </label>

              <input

                id="sale-quantity"

                className="form-input"

                type="number"

                min="1"

                step="1"

                max={selected?.quantity || undefined}

                value={quantity}

                onChange={(event) => {

                  setQuantity(event.target.value);

                  setFormError("");

                  setSuccessMessage("");

                }}

                required

              />

            </div>

            <div className="sale-total">

              <span>Sale total</span>

              <strong>{formatCurrency(amount)}</strong>

              <small>Calculated using the current product price.</small>

            </div>

            {formError && (

              <p className="field-error" role="alert">

                {formError}

              </p>

            )}

            {successMessage && (

              <p className="success-message" role="status">

                ✓ {successMessage}

              </p>

            )}

            <button

              className="btn btn--primary btn--wide"

              type="submit"

              disabled={submitting || availableProducts.length === 0}

            >

              {submitting ? "Recording sale..." : "Confirm Sale →"}

            </button>

          </form>

        </section>

        <section className="panel sales-summary-panel">

          <div className="panel-heading">

            <div>

              <h2>Sales Overview</h2>

              <p>Summary of saved transactions</p>

            </div>

            <span className="panel-icon panel-icon--purple">₹</span>

          </div>

          <div className="sales-summary-value">

            {formatCurrency(salesTotal)}

          </div>

          <span className="sales-summary-caption">Total recorded sales</span>

          <div className="summary-divider" />

          <div className="summary-row">

            <span>Transactions</span>

            <strong>{sales.length}</strong>

          </div>

          <div className="summary-row">

            <span>Units sold</span>

            <strong>{unitsSold.toLocaleString("en-IN")}</strong>

          </div>

          <div className="summary-row">

            <span>Average sale</span>

            <strong>

              {formatCurrency(sales.length ? salesTotal / sales.length : 0)}

            </strong>

          </div>

        </section>

      </div>

      <section className="panel sales-history-panel">

        <div className="panel-heading">

          <div>

            <h2>Sales History</h2>

            <p>Most recent transactions appear first.</p>

          </div>

          <button

            className="btn btn--secondary"

            onClick={onRetrySales}

            disabled={salesLoading}

          >

            ↻ Refresh

          </button>

        </div>

        {salesLoading ? (

          <div className="empty-state">Loading sales history...</div>

        ) : salesError ? (

          <div className="empty-state" role="alert">

            <p>{salesError}</p>

            <button className="btn btn--secondary" onClick={onRetrySales}>

              Retry

            </button>

          </div>

        ) : sales.length === 0 ? (

          <div className="empty-state">

            <span className="empty-icon">🧾</span>

            <p>No sales recorded yet.</p>

            <span className="form-hint">

              Your completed sales will appear here.

            </span>

          </div>

        ) : (

          <div className="table-wrapper">

            <table className="product-table sales-table">

              <thead>

                <tr>

                  <th>Product</th>

                  <th>SKU</th>

                  <th>Quantity</th>

                  <th>Unit Price</th>

                  <th>Total</th>

                  <th>Date &amp; Time</th>

                </tr>

              </thead>

              <tbody>

                {sales.map((sale) => (

                  <tr key={sale._id}>

                    <td className="td-name">{sale.productName}</td>

                    <td className="td-sku">

                      <code>{sale.sku}</code>

                    </td>

                    <td className="td-qty">{sale.quantity}</td>

                    <td>{formatCurrency(sale.unitPrice)}</td>

                    <td className="sale-amount">

                      {formatCurrency(sale.totalAmount)}

                    </td>

                    <td>

                      {sale.createdAt

                        ? new Date(sale.createdAt).toLocaleString("en-IN")

                        : "—"}

                    </td>

                  </tr>

                ))}

              </tbody>

            </table>

          </div>

        )}

      </section>

    </div>

  );

}

function RestockModal({ products, onClose, onRestock }) {

  const [productId, setProductId] = useState("");

  const [quantity, setQuantity] = useState("1");

  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");

  const [success, setSuccess] = useState("");

  const selectedProduct = products.find((product) => product.id === productId);

  async function handleSubmit(event) {

    event.preventDefault();

    setError("");

    setSuccess("");

    const amount = Number(quantity);

    if (!selectedProduct) {

      setError("Please select a product.");

      return;

    }

    if (!Number.isSafeInteger(amount) || amount <= 0) {

      setError("Enter a positive whole-number quantity.");

      return;

    }

    setSaving(true);

    try {

      await onRestock(productId, amount);

      setSuccess("Stock added successfully.");

      setTimeout(() => onClose(), 500);

    } catch (err) {

      setError(err.message || "Unable to add stock.");

    } finally {

      setSaving(false);

    }

  }

  return (

    <div className="modal-backdrop" role="presentation">

      <div className="modal modal--sm" role="dialog" aria-modal="true" aria-labelledby="restock-title">

        <div className="modal-header">

          <h2 id="restock-title">Add Stock</h2>

          <button type="button" className="modal-close" onClick={onClose} disabled={saving} aria-label="Close">×</button>

        </div>

        <form className="modal-form" onSubmit={handleSubmit} noValidate>

          <div className="form-row">

            <label className="form-label" htmlFor="restock-product">Product *</label>

            <select id="restock-product" className="form-input" value={productId} onChange={(event) => setProductId(event.target.value)} required>

              <option value="">Select a product</option>

              {products.map((product) => (

                <option key={product.id} value={product.id}>{product.name} · {product.sku} · {product.quantity} available</option>

              ))}

            </select>

          </div>

          {selectedProduct && (

            <div className="selected-product-card">

              <div><span className="selected-product-label">CURRENT STOCK</span><strong>{selectedProduct.quantity} units</strong></div>

              <div><span className="selected-product-label">SKU</span><strong>{selectedProduct.sku}</strong></div>

            </div>

          )}

          <div className="form-row">

            <label className="form-label" htmlFor="restock-quantity">Quantity to add *</label>

            <input id="restock-quantity" className="form-input" type="number" min="1" step="1" value={quantity} onChange={(event) => setQuantity(event.target.value)} required />

            <span className="form-hint">This quantity will be added to the current stock.</span>

          </div>

          {error && <p className="field-error" role="alert">{error}</p>}

          {success && <p className="success-message" role="status">✓ {success}</p>}

          <div className="modal-actions">

            <button type="button" className="btn btn--secondary" onClick={onClose} disabled={saving}>Cancel</button>

            <button type="submit" className="btn btn--primary" disabled={saving || products.length === 0}>{saving ? "Adding stock..." : "Add Stock"}</button>

          </div>

        </form>

      </div>

    </div>

  );

}



function AdjustStockModal({ products, onClose, onAdjust }) {

  const [productId, setProductId] = useState("");

  const [actualQuantity, setActualQuantity] = useState("");

  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");

  const [success, setSuccess] = useState("");



  const selectedProduct = products.find((product) => product.id === productId);

  const actual = actualQuantity === "" ? null : Number(actualQuantity);

  const difference =

    selectedProduct && actual !== null && Number.isSafeInteger(actual) && actual >= 0

      ? actual - selectedProduct.quantity

      : null;



  async function handleSubmit(event) {

    event.preventDefault();

    setError("");

    setSuccess("");



    if (!selectedProduct) {

      setError("Please select a product.");

      return;

    }



    if (

      actualQuantity === "" ||

      !Number.isSafeInteger(Number(actualQuantity)) ||

      Number(actualQuantity) < 0

    ) {

      setError("Enter a non-negative whole-number quantity.");

      return;

    }



    if (Number(actualQuantity) === selectedProduct.quantity) {

      setError("The actual quantity matches current stock. No adjustment is needed.");

      return;

    }



    setSaving(true);

    try {

      await onAdjust(productId, Number(actualQuantity));

      setSuccess("Stock adjusted successfully.");

      window.setTimeout(onClose, 500);

    } catch (err) {

      setError(err.message || "Unable to adjust stock.");

    } finally {

      setSaving(false);

    }

  }



  return (

    <div className="modal-backdrop" role="presentation">

      <div

        className="modal modal--sm"

        role="dialog"

        aria-modal="true"

        aria-labelledby="adjust-stock-title"

      >

        <div className="modal-header">

          <h2 id="adjust-stock-title">Adjust Stock</h2>

          <button

            type="button"

            className="modal-close"

            onClick={onClose}

            disabled={saving}

            aria-label="Close"

          >

            ×

          </button>

        </div>

        <form className="modal-form" onSubmit={handleSubmit} noValidate>

          <div className="form-row">

            <label className="form-label" htmlFor="adjust-product">

              Product *

            </label>

            <select

              id="adjust-product"

              className="form-input"

              value={productId}

              onChange={(event) => {

                setProductId(event.target.value);

                setError("");

                setSuccess("");

              }}

              required

            >

              <option value="">Select a product</option>

              {products.map((product) => (

                <option key={product.id} value={product.id}>

                  {product.name} · {product.sku} · {product.quantity} recorded

                </option>

              ))}

            </select>

          </div>



          {selectedProduct && (

            <div className="selected-product-card">

              <div>

                <span className="selected-product-label">CURRENT STOCK</span>

                <strong>{selectedProduct.quantity} units</strong>

              </div>

              <div>

                <span className="selected-product-label">SKU</span>

                <strong>{selectedProduct.sku}</strong>

              </div>

            </div>

          )}



          <div className="form-row">

            <label className="form-label" htmlFor="adjust-quantity">

              Actual quantity counted *

            </label>

            <input

              id="adjust-quantity"

              className="form-input"

              type="number"

              min="0"

              step="1"

              value={actualQuantity}

              onChange={(event) => {

                setActualQuantity(event.target.value);

                setError("");

                setSuccess("");

              }}

              required

            />

            <span className="form-hint">

              Enter the total quantity you physically counted, not the amount to add or remove.

            </span>

          </div>



          {difference !== null && selectedProduct && (

            <div className="sale-total">

              <span>Stock change</span>

              <strong>

                {difference > 0

                  ? `+${difference} units (Stock In)`

                  : difference < 0

                    ? `${difference} units (Stock Out)`

                    : "No change"}

              </strong>

              <small>

                New available quantity: {actual} unit{actual === 1 ? "" : "s"}.

              </small>

            </div>

          )}



          {error && <p className="field-error" role="alert">{error}</p>}

          {success && <p className="success-message" role="status">✓ {success}</p>}



          <div className="modal-actions">

            <button

              type="button"

              className="btn btn--secondary"

              onClick={onClose}

              disabled={saving}

            >

              Cancel

            </button>

            <button

              type="submit"

              className="btn btn--primary"

              disabled={saving || products.length === 0}

            >

              {saving ? "Saving adjustment..." : "Save Adjustment"}

            </button>

          </div>

        </form>

      </div>

    </div>

  );

}



function MovementsView({

  products,

  onRestock,

  onAdjust,

  movements,

  loading,

  error,

  onRefresh,

}) {

  const [search, setSearch] = useState("");

  const [typeFilter, setTypeFilter] = useState("");

  const [reasonFilter, setReasonFilter] = useState("");

  const [showRestock, setShowRestock] = useState(false);

  const [showAdjust, setShowAdjust] = useState(false);

  const filteredMovements = useMemo(() => {

    const query = search.trim().toLowerCase();

    return movements.filter((movement) => {

      const matchesSearch =

        !query ||

        String(movement.productName || "").toLowerCase().includes(query) ||

        String(movement.sku || "").toLowerCase().includes(query);

      const matchesType = !typeFilter || movement.type === typeFilter;

      const matchesReason = !reasonFilter || movement.reason === reasonFilter;

      return matchesSearch && matchesType && matchesReason;

    });

  }, [movements, search, typeFilter, reasonFilter]);

  function formatDate(value) {

    if (!value) return "—";

    const date = new Date(value);

    return Number.isNaN(date.getTime())

      ? "—"

      : date.toLocaleString("en-IN");

  }

  return (

    <div className="view">

      <div className="view-header">

        <div>

          <h1 className="view-title">Stock Log</h1>

          <p className="view-subtitle">

            Track inventory movements from sales and stock changes

          </p>

        </div>

        <div className="product-actions">

          <button

            type="button"

            className="btn btn--primary"

            onClick={() => setShowRestock(true)}

            disabled={products.length === 0}

          >

            + Add Stock

          </button>

          <button
            type="button"
            className="btn btn--adjust"
            onClick={() => setShowAdjust(true)}
            disabled={products.length === 0}
          >
            Adjust Stock
          </button>

          <button

          type="button"

          className="btn btn--secondary"

          onClick={onRefresh}

          disabled={loading}

        >

          {loading ? "Refreshing..." : "↻ Refresh"}

          </button>

        </div>

      </div>

      <div className="toolbar">

        <input

          className="toolbar-search"

          type="search"

          placeholder="Search by product name or SKU..."

          value={search}

          onChange={(event) => setSearch(event.target.value)}

          aria-label="Search stock movements"

        />

        <select

          className="toolbar-filter"

          value={typeFilter}

          onChange={(event) => setTypeFilter(event.target.value)}

          aria-label="Filter by movement type"

        >

          <option value="">All Types</option>

          <option value="IN">Stock In</option>

          <option value="OUT">Stock Out</option>

        </select>

        <select

          className="toolbar-filter"

          value={reasonFilter}

          onChange={(event) => setReasonFilter(event.target.value)}

          aria-label="Filter by reason"

        >

          <option value="">All Reasons</option>

          <option value="SALE">Sale</option>

          <option value="RESTOCK">Restock</option>

          <option value="ADJUSTMENT">Adjustment</option>

        </select>

      </div>

      {loading ? (

        <div className="empty-state">Loading stock movement history...</div>

      ) : error ? (

        <div className="empty-state" role="alert">

          <p>{error}</p>

          <button

            type="button"

            className="btn btn--secondary"

            onClick={() => setShowAdjust(true)}

            disabled={products.length === 0}

          >

            Adjust Stock

          </button>

          <button

            type="button"

            className="btn btn--secondary"

            onClick={onRefresh}

          >

            Retry

          </button>

        </div>

      ) : filteredMovements.length === 0 ? (

        <div className="empty-state">

          <span className="empty-icon">📋</span>

          <p>

            {movements.length === 0

              ? "No stock movements recorded yet."

              : "No stock movements match your filters."}

          </p>

          <span className="form-hint">

            Completed sales and future stock changes will appear here.

          </span>

        </div>

      ) : (

        <div className="table-wrapper">

          <table className="product-table">

            <thead>

              <tr>

                <th>Product</th>

                <th>SKU</th>

                <th>Movement</th>

                <th>Quantity</th>

                <th>Reason</th>

                <th>Date &amp; Time</th>

              </tr>

            </thead>

            <tbody>

              {filteredMovements.map((movement) => (

                <tr key={movement._id}>

                  <td className="td-name">{movement.productName || "Deleted product"}</td>

                  <td className="td-sku">

                    <code>{movement.sku || "—"}</code>

                  </td>

                  <td>

                    <span

                      className={`badge ${

                        movement.type === "IN"

                          ? "badge--in-stock"

                          : "badge--out-of-stock"

                      }`}

                    >

                      {movement.type === "IN" ? "Stock In" : "Stock Out"}

                    </span>

                  </td>

                  <td className="td-qty">{Number(movement.quantity || 0)}</td>

                  <td>{movement.reason || "—"}</td>

                  <td>{formatDate(movement.createdAt)}</td>

                </tr>

              ))}

            </tbody>

          </table>

        </div>

      )}

      <p className="form-hint">

        Showing {filteredMovements.length} of {movements.length} loaded movements.

      </p>

      {showRestock && (

        <RestockModal

          products={products}

          onClose={() => setShowRestock(false)}

          onRestock={onRestock}

        />

      )}

      {showAdjust && (

        <AdjustStockModal

          products={products}

          onClose={() => setShowAdjust(false)}

          onAdjust={onAdjust}

        />

      )}

    </div>

  );

}

export default function App() {

  const [products, setProducts] = useState([]);

  const [sales, setSales] = useState([]);

  const [activeView, setActiveView] = useState("dashboard");

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState("");

  const [reloadKey, setReloadKey] = useState(0);

  const [salesLoading, setSalesLoading] = useState(false);

  const [salesError, setSalesError] = useState("");

  const [salesReloadKey, setSalesReloadKey] = useState(0);

  const [submittingSale, setSubmittingSale] = useState(false);

  const [movements, setMovements] = useState([]);

  const [movementsLoading, setMovementsLoading] = useState(false);

  const [movementsError, setMovementsError] = useState("");

  const [movementsReloadKey, setMovementsReloadKey] = useState(0);

  const loadProducts = useCallback(async (signal) => {

    setLoading(true);

    setError("");

    try {

      const result = await readApiResponse(

        await fetch("/api/products?pageSize=100", { signal })

      );

      setProducts((result.data || []).map(normalizeProduct));

    } catch (error) {

      if (error.name !== "AbortError") {

        setError(error.message || "Unable to load products.");

      }

    } finally {

      if (!signal?.aborted) setLoading(false);

    }

  }, []);

  useEffect(() => {

    const controller = new AbortController();

    loadProducts(controller.signal);

    return () => controller.abort();

  }, [loadProducts, reloadKey]);

  const loadSales = useCallback(async (signal) => {

    setSalesLoading(true);

    setSalesError("");

    try {

      const result = await readApiResponse(

        await fetch("/api/sales?pageSize=100", { signal })

      );

      setSales(result.data || []);

    } catch (error) {

      if (error.name !== "AbortError") {

        setSalesError(error.message || "Unable to load sales history.");

      }

    } finally {

      if (!signal?.aborted) setSalesLoading(false);

    }

  }, []);

  useEffect(() => {

    const controller = new AbortController();

    loadSales(controller.signal);

    return () => controller.abort();

  }, [loadSales, salesReloadKey]);

  const loadMovements = useCallback(async (signal) => {

    setMovementsLoading(true);

    setMovementsError("");

    try {

      const result = await readApiResponse(

        await fetch("/api/stock-movements?pageSize=100", { signal })

      );

      setMovements(result.data || []);

    } catch (error) {

      if (error.name !== "AbortError") {

        setMovementsError(error.message || "Unable to load stock movement history.");

      }

    } finally {

      if (!signal?.aborted) setMovementsLoading(false);

    }

  }, []);

  useEffect(() => {

    const controller = new AbortController();

    loadMovements(controller.signal);

    return () => controller.abort();

  }, [loadMovements, movementsReloadKey]);

  const retryProducts = () => setReloadKey((key) => key + 1);

  const retrySales = () => setSalesReloadKey((key) => key + 1);

  async function handleAddProduct(product) {

    const result = await readApiResponse(

      await fetch("/api/products", {

        method: "POST",

        headers: { "Content-Type": "application/json" },

        body: JSON.stringify(product),

      })

    );

    if (!result.data) {

      throw new Error("The server did not return the saved product.");

    }

    setProducts((prev) => [normalizeProduct(result.data), ...prev]);

    setError("");

  }

  async function handleUpdateProduct(product, id) {

    const result = await readApiResponse(

      await fetch(`/api/products/${encodeURIComponent(id)}`, {

        method: "PUT",

        headers: { "Content-Type": "application/json" },

        body: JSON.stringify(product),

      })

    );

    if (!result.data) {

      throw new Error("The server did not return the updated product.");

    }

    const updated = normalizeProduct(result.data);

    setProducts((prev) =>

      prev.map((item) => (item.id === String(id) ? updated : item))

    );

    setError("");

  }

  async function handleDeleteProduct(id) {

    await readApiResponse(

      await fetch(`/api/products/${encodeURIComponent(id)}`, {

        method: "DELETE",

      })

    );

    setProducts((prev) => prev.filter((product) => product.id !== String(id)));

    setError("");

  }

  async function handleRecordSale(productId, quantity) {

    setSubmittingSale(true);

    try {

      await readApiResponse(

        await fetch("/api/sales", {

          method: "POST",

          headers: { "Content-Type": "application/json" },

          body: JSON.stringify({ productId, quantity }),

        })

      );

      await Promise.all([loadProducts(), loadSales(), loadMovements()]);

    } finally {

      setSubmittingSale(false);

    }

  }

  async function handleRestock(productId, quantity) {

    await readApiResponse(

      await fetch("/api/stock-movements/restock", {

        method: "POST",

        headers: { "Content-Type": "application/json" },

        body: JSON.stringify({ productId, quantity }),

      })

    );

    await Promise.all([loadProducts(), loadMovements()]);

  }



  async function handleAdjustStock(productId, actualQuantity) {

    await readApiResponse(

      await fetch("/api/stock-movements/adjust", {

        method: "POST",

        headers: { "Content-Type": "application/json" },

        body: JSON.stringify({ productId, actualQuantity }),

      })

    );

    await Promise.all([loadProducts(), loadMovements()]);

  }

  function renderView() {

    if (activeView === "products") {

      return (

        <ProductsView

          products={products}

          onAdd={handleAddProduct}

          onUpdate={handleUpdateProduct}

          onDelete={handleDeleteProduct}

          loading={loading}

          error={error}

          onRetry={retryProducts}

        />

      );

    }

    if (activeView === "sales") {

      return (

        <SalesView

          products={products}

          sales={sales}

          salesLoading={salesLoading}

          salesError={salesError}

          onRetrySales={retrySales}

          onRecordSale={handleRecordSale}

          submitting={submittingSale}

        />

      );

    }

    if (activeView === "movements") {

      return (

        <MovementsView

          products={products}

          onRestock={handleRestock}

          onAdjust={handleAdjustStock}

          movements={movements}

          loading={movementsLoading}

          error={movementsError}

          onRefresh={() => setMovementsReloadKey((key) => key + 1)}

        />

      );

    }

    return (

      <DashboardView

        products={products}

        sales={sales}

        onNavigate={setActiveView}

        loading={loading}

        error={error}

        onRetry={retryProducts}

      />

    );

  }

  const pageTitle =

    {

      dashboard: "Dashboard",

      products: "Products",

      sales: "Sales",

      movements: "Stock Log",

    }[activeView] || "Dashboard";

  return (

    <div className="app-layout">

      <Sidebar activeView={activeView} onNavigate={setActiveView} />

      <div className="app-main">

        <header className="top-header">

          <span className="header-title">{pageTitle}</span>

          <div className="header-right">

            <span

              className={`header-tag${

                error || salesError ? " header-tag--error" : ""

              }`}

            >

              {loading

                ? "Connecting..."

                : error || salesError

                  ? "Connection Error"

                  : "Live Data"}

            </span>

          </div>

        </header>

        <main className="content-area">{renderView()}</main>

      </div>

    </div>

  );

}