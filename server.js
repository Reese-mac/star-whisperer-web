import express from "express";
import Database from "better-sqlite3";
import cors from "cors";
import jwt from "jsonwebtoken";
import cookieParser from "cookie-parser";
import nodemailer from "nodemailer";
import path from "path";
import { fileURLToPath } from "url";

// 修正路徑
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

/* ==========================
   🌐 CORS（允許前端訪問）
========================== */
app.use(
  cors({
    origin: ["http://localhost:3000", "http://127.0.0.1:3000"],
    credentials: true,
  })
);

app.use(express.json());
app.use(cookieParser());

/* ==========================
   🖼 靜態檔案（HTML / 圖片 / CSS）
========================== */
// ★★★ 最重要：讓 index.html / purchase.html 能被 Render 正常讀取
app.use(express.static(path.join(__dirname, "public")));

/* ==========================
   📦 SQLite 資料庫
========================== */
const db = new Database(path.join(__dirname, "orders.db"));

db.prepare(`
  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product TEXT,
    quantity INTEGER,
    name TEXT,
    phone TEXT,
    address TEXT,
    status TEXT,
    created_at TEXT
  )
`).run();

/* ==========================
   🔐 後台登入 / JWT
========================== */
const ADMIN_USERNAME = "admin";
const ADMIN_PASSWORD = "admin123";
const JWT_SECRET = "StarWhispererSecret";

/* ==========================
   ✉ Gmail（訂單通知）
========================== */
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "yourEmail@gmail.com",
    pass: "yourEmailPassword",
  },
});

/* ==========================
   🔐 後台登入
========================== */
app.post("/admin/login", (req, res) => {
  const { username, password } = req.body;

  if (username !== ADMIN_USERNAME || password !== ADMIN_PASSWORD) {
    return res.json({ success: false, message: "帳號或密碼錯誤" });
  }

  const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: "7d" });

  res.cookie("adminToken", token, {
    httpOnly: true,
    secure: false,
  });

  res.json({ success: true });
});

/* ==========================
   🛡 後台保護
========================== */
function adminAuth(req, res, next) {
  const token = req.cookies.adminToken;
  if (!token) return res.status(403).json({ success: false });

  try {
    jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(403).json({ success: false });
  }
}

/* ==========================
   📝 建立訂單
========================== */
app.post("/api/orders", (req, res) => {
  const { product, quantity, name, phone, address } = req.body;
  const createdAt = new Date().toISOString();

  const stmt = db.prepare(`
    INSERT INTO orders (product, quantity, name, phone, address, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const result = stmt.run(
    product,
    quantity,
    name,
    phone,
    address,
    "pending",
    createdAt
  );

  const orderId = result.lastInsertRowid;

  transporter.sendMail({
    from: "Star Whisperer 訂單通知",
    to: "yourEmail@gmail.com",
    subject: `📦 新訂單：#${orderId}`,
    html: `
      <h2>新訂單成立</h2>
      <p>訂單編號：<b>${orderId}</b></p>
      <p>商品：${product}</p>
      <p>數量：${quantity}</p>
      <p>姓名：${name}</p>
      <p>電話：${phone}</p>
      <p>地址：${address}</p>
    `,
  });

  res.json({ success: true, orderId });
});

/* ==========================
   📦 後台訂單列表
========================== */
app.get("/admin/orders", adminAuth, (req, res) => {
  const rows = db.prepare(`SELECT * FROM orders ORDER BY id DESC`).all();
  res.json({ success: true, orders: rows });
});

/* ==========================
   ✔ 最重要：Render 必須使用動態 PORT
========================== */
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Star Whisperer Server running on port ${PORT}`);
});
