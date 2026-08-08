import { client } from "./index";

export async function initDatabase() {
  try {
    // Enable WAL mode & foreign keys
    await client.execute("PRAGMA journal_mode = WAL;");
    await client.execute("PRAGMA foreign_keys = ON;");

    await client.batch([
      `CREATE TABLE IF NOT EXISTS shops (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        address TEXT,
        phone TEXT,
        license_number TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );`,
      `CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        shop_id INTEGER NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'pharmacist',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );`,
      `CREATE TABLE IF NOT EXISTS medicines (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        shop_id INTEGER NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        barcode TEXT,
        manufacturer TEXT NOT NULL,
        schedule TEXT NOT NULL DEFAULT 'OTC',
        unit_price REAL NOT NULL DEFAULT 0,
        reorder_threshold INTEGER NOT NULL DEFAULT 10,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );`,
      `CREATE TABLE IF NOT EXISTS batches (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        shop_id INTEGER NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
        medicine_id INTEGER NOT NULL REFERENCES medicines(id) ON DELETE CASCADE,
        batch_number TEXT NOT NULL,
        quantity INTEGER NOT NULL DEFAULT 0,
        expiry_date TEXT NOT NULL,
        supplier TEXT NOT NULL,
        cost_price REAL NOT NULL DEFAULT 0,
        received_date TEXT NOT NULL DEFAULT (DATE('now'))
      );`,
      `CREATE TABLE IF NOT EXISTS incoming_orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        shop_id INTEGER NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
        medicine_id INTEGER NOT NULL REFERENCES medicines(id) ON DELETE CASCADE,
        expected_quantity INTEGER NOT NULL,
        expected_arrival_date TEXT NOT NULL,
        supplier TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );`,
      `CREATE TABLE IF NOT EXISTS wastage_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        shop_id INTEGER NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
        medicine_id INTEGER NOT NULL REFERENCES medicines(id) ON DELETE CASCADE,
        batch_id INTEGER REFERENCES batches(id) ON DELETE SET NULL,
        batch_number TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        reason TEXT NOT NULL,
        performed_by INTEGER REFERENCES users(id),
        date DATETIME DEFAULT CURRENT_TIMESTAMP
      );`,
      `CREATE TABLE IF NOT EXISTS audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        shop_id INTEGER NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id),
        action TEXT NOT NULL,
        entity_type TEXT,
        entity_id INTEGER,
        detail TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      );`,
      `CREATE TABLE IF NOT EXISTS scanner_sessions (
        session_id TEXT PRIMARY KEY,
        shop_id INTEGER NOT NULL,
        paired INTEGER NOT NULL DEFAULT 0,
        last_scanned_barcode TEXT,
        last_scanned_time INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL
      );`,
      `CREATE INDEX IF NOT EXISTS idx_users_shop ON users(shop_id);`,
      `CREATE INDEX IF NOT EXISTS idx_medicines_shop ON medicines(shop_id);`,
      `CREATE INDEX IF NOT EXISTS idx_medicines_barcode ON medicines(shop_id, barcode);`,
      `CREATE INDEX IF NOT EXISTS idx_batches_shop ON batches(shop_id);`,
      `CREATE INDEX IF NOT EXISTS idx_batches_expiry ON batches(medicine_id, expiry_date);`,
      `CREATE INDEX IF NOT EXISTS idx_audit_shop ON audit_logs(shop_id);`,
      `INSERT OR IGNORE INTO shops (id, name, address, phone) VALUES (1, 'Apex MedTrack Pharmacy', '123 Health Ave', '+1-800-555-MEDS');`,
      `INSERT OR IGNORE INTO users (id, shop_id, name, email, password_hash, role) VALUES (1, 1, 'Pharmacy Admin', 'admin@medtrack.com', '$2a$12$DummyHashForDemoUserOnly1234567890', 'owner');`
    ], "write");

    return { success: true, message: "Database schema initialized with WAL and Foreign Keys." };
  } catch (err: unknown) {
    console.error("Database initialization error:", err);
    throw err;
  }
}
