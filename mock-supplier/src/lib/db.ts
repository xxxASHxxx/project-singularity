import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

// Support SUPPLIER_DB_PATH env var for Docker (persisted volume)
const DB_PATH = process.env.SUPPLIER_DB_PATH ?? path.join(process.cwd(), 'supplier.db');

// Ensure parent directory exists
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!_db) {
    _db = new Database(DB_PATH);
    _db.pragma('journal_mode = WAL');
    initSchema(_db);
  }
  return _db;
}

function initSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_ref TEXT UNIQUE NOT NULL,
      sku TEXT NOT NULL,
      product_name TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      unit_price REAL NOT NULL,
      total_price REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'CONFIRMED',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS cart_sessions (
      session_id TEXT PRIMARY KEY,
      items_json TEXT NOT NULL DEFAULT '[]',
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}

export interface CartItem {
  sku: string;
  productName: string;
  quantity: number;
  unitPrice: number;
}

export interface Order {
  id: number;
  order_ref: string;
  sku: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  status: string;
  created_at: string;
}
