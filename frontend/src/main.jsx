import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  BarChart3,
  Boxes,
  CreditCard,
  LogOut,
  Moon,
  PackagePlus,
  ReceiptText,
  Search,
  ShoppingCart,
  Sun,
  Users
} from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import "./styles.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000/api";

function money(value) {
  return Number(value || 0).toLocaleString("vi-VN", { style: "currency", currency: "VND" });
}

function useApi() {
  const [token, setToken] = useState(localStorage.getItem("token") || "");
  const [user, setUser] = useState(JSON.parse(localStorage.getItem("user") || "null"));

  async function request(path, options = {}) {
    const res = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {})
      }
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: "Request failed" }));
      throw new Error(err.message);
    }
    if (res.status === 204) return null;
    return res.json();
  }

  function saveSession(payload) {
    setToken(payload.token);
    setUser(payload.user);
    localStorage.setItem("token", payload.token);
    localStorage.setItem("user", JSON.stringify(payload.user));
  }

  function logout() {
    setToken("");
    setUser(null);
    localStorage.removeItem("token");
    localStorage.removeItem("user");
  }

  return { token, user, request, saveSession, logout };
}

function Login({ api }) {
  const [form, setForm] = useState({ email: "admin@example.com", password: "123456" });
  const [error, setError] = useState("");

  async function submit(e) {
    e.preventDefault();
    setError("");
    try {
      api.saveSession(await api.request("/auth/login", { method: "POST", body: JSON.stringify(form) }));
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <main className="login-page">
      <form className="login-panel" onSubmit={submit}>
        <h1>Retail POS</h1>
        <p>Dang nhap he thong ban hang va quan ly kho.</p>
        <label>Email</label>
        <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <label>Mat khau</label>
        <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        {error && <div className="error">{error}</div>}
        <button className="primary">Dang nhap</button>
      </form>
    </main>
  );
}

function Shell({ api }) {
  const [page, setPage] = useState("dashboard");
  const [dark, setDark] = useState(localStorage.getItem("theme") === "dark");
  const nav = [
    ["dashboard", BarChart3, "Tong quan"],
    ["pos", ShoppingCart, "Ban hang"],
    ["products", Boxes, "San pham"],
    ["orders", ReceiptText, "Don hang"],
    ["customers", Users, "Khach hang"],
    ["inventory", PackagePlus, "Kho"]
  ];

  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    localStorage.setItem("theme", dark ? "dark" : "light");
  }, [dark]);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">Retail POS</div>
        {nav.map(([id, Icon, label]) => (
          <button key={id} className={page === id ? "nav active" : "nav"} onClick={() => setPage(id)}>
            <Icon size={18} /> {label}
          </button>
        ))}
        <div className="sidebar-footer">
          <button className="nav" onClick={() => setDark(!dark)}>{dark ? <Sun size={18} /> : <Moon size={18} />} Giao dien</button>
          <button className="nav" onClick={api.logout}><LogOut size={18} /> Dang xuat</button>
        </div>
      </aside>
      <section className="main">
        <header className="topbar">
          <div>
            <strong>{api.user?.name}</strong>
            <span>{api.user?.role}</span>
          </div>
        </header>
        {page === "dashboard" && <Dashboard api={api} />}
        {page === "pos" && <POS api={api} />}
        {page === "products" && <Products api={api} />}
        {page === "orders" && <Orders api={api} />}
        {page === "customers" && <Customers api={api} />}
        {page === "inventory" && <Inventory api={api} />}
      </section>
    </div>
  );
}

function Dashboard({ api }) {
  const [summary, setSummary] = useState(null);
  const [sales, setSales] = useState([]);
  const [top, setTop] = useState([]);

  useEffect(() => {
    Promise.all([api.request("/reports/summary"), api.request("/reports/sales"), api.request("/reports/top-products")])
      .then(([a, b, c]) => { setSummary(a); setSales(b); setTop(c); })
      .catch(console.error);
  }, []);

  return (
    <div className="page">
      <h2>Dashboard</h2>
      <div className="metric-grid">
        <Metric label="Doanh thu hom nay" value={money(summary?.today?.revenue)} />
        <Metric label="Loi nhuan thang" value={money(summary?.month?.profit)} />
        <Metric label="Don thang nay" value={summary?.month?.orders || 0} />
        <Metric label="Sap het hang" value={summary?.lowStock || 0} />
      </div>
      <div className="split">
        <section className="panel chart-panel">
          <h3>Doanh thu 30 ngay</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={sales}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip formatter={(v) => money(v)} />
              <Bar dataKey="revenue" fill="#0f766e" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </section>
        <section className="panel">
          <h3>Top ban chay</h3>
          {top.map((p) => <Row key={p.productId} left={p.name} right={`${p.quantity} sp`} />)}
        </section>
      </div>
    </div>
  );
}

function Metric({ label, value }) {
  return <div className="metric"><span>{label}</span><strong>{value}</strong></div>;
}

function POS({ api }) {
  const [q, setQ] = useState("");
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [discountType, setDiscountType] = useState("AMOUNT");
  const [discountValue, setDiscountValue] = useState(0);
  const [paidAmount, setPaidAmount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [message, setMessage] = useState("");

  useEffect(() => {
    api.request(`/products?q=${encodeURIComponent(q)}&limit=12`).then((r) => setProducts(r.items)).catch(console.error);
  }, [q]);

  const subtotal = cart.reduce((s, i) => s + Number(i.salePrice) * i.quantity, 0);
  const discount = discountType === "PERCENT" ? Math.min(subtotal, subtotal * (Number(discountValue) / 100)) : Math.min(subtotal, Number(discountValue || 0));
  const total = subtotal - discount;

  function add(product) {
    setCart((items) => {
      const found = items.find((i) => i.id === product.id);
      if (found) return items.map((i) => i.id === product.id ? { ...i, quantity: i.quantity + 1 } : i);
      return [...items, { ...product, quantity: 1 }];
    });
  }

  async function checkout() {
    setMessage("");
    const order = await api.request("/orders", {
      method: "POST",
      body: JSON.stringify({
        items: cart.map((i) => ({ productId: i.id, quantity: i.quantity })),
        discountType,
        discountValue: Number(discountValue),
        paidAmount: Number(paidAmount || total),
        paymentMethod
      })
    });
    setCart([]);
    setPaidAmount(0);
    setDiscountValue(0);
    setMessage(`Da tao don ${order.code}`);
    const receipt = await fetch(`${API_URL}/orders/${order.id}/receipt.pdf`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
    });
    const blob = await receipt.blob();
    window.open(URL.createObjectURL(blob), "_blank");
  }

  return (
    <div className="page pos-grid">
      <section>
        <h2>Ban hang</h2>
        <div className="search-box"><Search size={18} /><input placeholder="Tim ten, SKU, barcode" value={q} onChange={(e) => setQ(e.target.value)} autoFocus /></div>
        <div className="product-grid">
          {products.map((p) => (
            <button className="product-tile" key={p.id} onClick={() => add(p)}>
              <strong>{p.name}</strong>
              <span>{p.sku} - Ton {p.stock}</span>
              <b>{money(p.salePrice)}</b>
            </button>
          ))}
        </div>
      </section>
      <aside className="cart">
        <h3>Gio hang</h3>
        {cart.map((item) => (
          <div className="cart-line" key={item.id}>
            <div><strong>{item.name}</strong><span>{money(item.salePrice)}</span></div>
            <input type="number" min="1" value={item.quantity} onChange={(e) => setCart(cart.map((i) => i.id === item.id ? { ...i, quantity: Number(e.target.value) } : i))} />
          </div>
        ))}
        <Row left="Tam tinh" right={money(subtotal)} />
        <div className="discount">
          <select value={discountType} onChange={(e) => setDiscountType(e.target.value)}><option value="AMOUNT">VND</option><option value="PERCENT">%</option></select>
          <input type="number" value={discountValue} onChange={(e) => setDiscountValue(e.target.value)} />
        </div>
        <Row left="Tong thanh toan" right={money(total)} strong />
        <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}><option value="CASH">Tien mat</option><option value="BANK_TRANSFER">Chuyen khoan</option></select>
        <input type="number" placeholder="Khach dua" value={paidAmount} onChange={(e) => setPaidAmount(e.target.value)} />
        <button className="primary" disabled={!cart.length} onClick={checkout}><CreditCard size={18} /> Thanh toan</button>
        {message && <div className="success">{message}</div>}
      </aside>
    </div>
  );
}

function Products({ api }) {
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState({ name: "", sku: "", barcode: "", costPrice: 0, salePrice: 0, stock: 0, lowStockAlert: 5, categoryId: "" });
  const load = () => api.request("/products?limit=100").then((r) => setItems(r.items));
  useEffect(() => { load(); api.request("/categories").then(setCategories); }, []);

  async function save(e) {
    e.preventDefault();
    await api.request("/products", { method: "POST", body: JSON.stringify({ ...form, categoryId: form.categoryId || null }) });
    setForm({ ...form, name: "", sku: "", barcode: "" });
    load();
  }

  return <CrudPage title="San pham" form={
    <form className="form-grid" onSubmit={save}>
      {["name", "sku", "barcode", "costPrice", "salePrice", "stock", "lowStockAlert"].map((key) => <input key={key} placeholder={key} value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />)}
      <select value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}><option value="">Nhom hang</option>{categories.map((c) => <option value={c.id} key={c.id}>{c.name}</option>)}</select>
      <button className="primary">Them</button>
    </form>
  } rows={items.map((p) => [p.name, p.sku, money(p.salePrice), `Ton ${p.stock}`])} />;
}

function Orders({ api }) {
  const [orders, setOrders] = useState([]);
  useEffect(() => { api.request("/orders?limit=50").then((r) => setOrders(r.items)); }, []);
  return <CrudPage title="Don hang" rows={orders.map((o) => [o.code, o.customer?.name || "Khach le", money(o.total), o.status])} />;
}

function Customers({ api }) {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({ name: "", phone: "", email: "", address: "" });
  const load = () => api.request("/customers").then(setItems);
  useEffect(() => { load(); }, []);
  async function save(e) {
    e.preventDefault();
    await api.request("/customers", { method: "POST", body: JSON.stringify(form) });
    setForm({ name: "", phone: "", email: "", address: "" });
    load();
  }
  return <CrudPage title="Khach hang" form={
    <form className="form-grid" onSubmit={save}>
      {Object.keys(form).map((key) => <input key={key} placeholder={key} value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />)}
      <button className="primary">Them</button>
    </form>
  } rows={items.map((c) => [c.name, c.phone || "", money(c.debt), c.address || ""])} />;
}

function Inventory({ api }) {
  const [products, setProducts] = useState([]);
  const [movements, setMovements] = useState([]);
  const [form, setForm] = useState({ productId: "", type: "IMPORT", quantity: 1, reason: "" });
  const load = () => Promise.all([api.request("/products?limit=100"), api.request("/inventory/movements")]).then(([p, m]) => { setProducts(p.items); setMovements(m); });
  useEffect(load, []);
  async function save(e) {
    e.preventDefault();
    await api.request("/inventory/movements", { method: "POST", body: JSON.stringify(form) });
    load();
  }
  return <CrudPage title="Quan ly kho" form={
    <form className="form-grid" onSubmit={save}>
      <select value={form.productId} onChange={(e) => setForm({ ...form, productId: e.target.value })}><option value="">San pham</option>{products.map((p) => <option value={p.id} key={p.id}>{p.name}</option>)}</select>
      <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}><option value="IMPORT">Nhap</option><option value="EXPORT">Xuat</option><option value="ADJUSTMENT">Dieu chinh</option></select>
      <input type="number" min="1" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })} />
      <input placeholder="Ly do" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
      <button className="primary">Ghi kho</button>
    </form>
  } rows={movements.map((m) => [m.product.name, m.type, m.quantity, `${m.beforeStock} -> ${m.afterStock}`])} />;
}

function CrudPage({ title, form, rows }) {
  return (
    <div className="page">
      <h2>{title}</h2>
      {form && <section className="panel">{form}</section>}
      <section className="panel table-panel">
        {rows.map((row, idx) => <div className="table-row" key={idx}>{row.map((cell, i) => <span key={i}>{cell}</span>)}</div>)}
      </section>
    </div>
  );
}

function Row({ left, right, strong }) {
  return <div className={strong ? "row strong" : "row"}><span>{left}</span><b>{right}</b></div>;
}

function App() {
  const api = useApi();
  return api.token ? <Shell api={api} /> : <Login api={api} />;
}

createRoot(document.getElementById("root")).render(<App />);
