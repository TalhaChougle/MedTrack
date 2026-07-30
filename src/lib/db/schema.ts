import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const shops = sqliteTable("shops", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  address: text("address"),
  phone: text("phone"),
  licenseNumber: text("license_number"),
  createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
});

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  shopId: integer("shop_id")
    .notNull()
    .references(() => shops.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").default("pharmacist").notNull(), // owner | pharmacist
  createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
});

export const medicines = sqliteTable("medicines", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  shopId: integer("shop_id")
    .notNull()
    .references(() => shops.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  barcode: text("barcode"), // nullable, unique per shop checked programmatically
  manufacturer: text("manufacturer").notNull(),
  schedule: text("schedule").default("OTC").notNull(), // OTC | H | H1 | X
  unitPrice: real("unit_price").default(0).notNull(),
  reorderThreshold: integer("reorder_threshold").default(10).notNull(),
  createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
});

export const batches = sqliteTable("batches", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  shopId: integer("shop_id")
    .notNull()
    .references(() => shops.id, { onDelete: "cascade" }),
  medicineId: integer("medicine_id")
    .notNull()
    .references(() => medicines.id, { onDelete: "cascade" }),
  batchNumber: text("batch_number").notNull(),
  quantity: integer("quantity").default(0).notNull(),
  expiryDate: text("expiry_date").notNull(), // YYYY-MM-DD
  supplier: text("supplier").notNull(),
  costPrice: real("cost_price").default(0).notNull(),
  receivedDate: text("received_date").default(sql`CURRENT_DATE`).notNull(),
});

export const incomingOrders = sqliteTable("incoming_orders", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  shopId: integer("shop_id")
    .notNull()
    .references(() => shops.id, { onDelete: "cascade" }),
  medicineId: integer("medicine_id")
    .notNull()
    .references(() => medicines.id, { onDelete: "cascade" }),
  expectedQuantity: integer("expected_quantity").notNull(),
  expectedArrivalDate: text("expected_arrival_date").notNull(), // YYYY-MM-DD
  supplier: text("supplier").notNull(),
  status: text("status").default("pending").notNull(), // pending | arrived | delayed
  createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
});

export const wastageLogs = sqliteTable("wastage_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  shopId: integer("shop_id")
    .notNull()
    .references(() => shops.id, { onDelete: "cascade" }),
  medicineId: integer("medicine_id")
    .notNull()
    .references(() => medicines.id, { onDelete: "cascade" }),
  batchId: integer("batch_id").references(() => batches.id, { onDelete: "set null" }),
  batchNumber: text("batch_number").notNull(), // Stored as text for audit durability
  quantity: integer("quantity").notNull(),
  reason: text("reason").notNull(), // expired | damaged | contaminated | recalled | other
  performedBy: integer("performed_by").references(() => users.id),
  date: text("date").default(sql`CURRENT_TIMESTAMP`),
});

export const auditLogs = sqliteTable("audit_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  shopId: integer("shop_id")
    .notNull()
    .references(() => shops.id, { onDelete: "cascade" }),
  userId: integer("user_id").references(() => users.id),
  action: text("action").notNull(), // SELL, STOCK_IN, WASTAGE, ORDER_CREATE, MEDICINE_ADD, REGISTER, STATUS_UPDATE
  entityType: text("entity_type"), // medicine, batch, order, user
  entityId: integer("entity_id"),
  detail: text("detail"), // JSON string
  timestamp: text("timestamp").default(sql`CURRENT_TIMESTAMP`),
});
