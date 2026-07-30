import { db } from "@/lib/db";
import { scannerSessions } from "@/lib/db/schema";
import { eq, lt } from "drizzle-orm";
import { initDatabase } from "@/lib/db/init";

export interface ScannerSession {
  sessionId: string;
  shopId: number;
  createdAt: number;
  lastScannedBarcode: string | null;
  lastScannedTime: number;
  paired: boolean;
}

export async function createScannerSession(shopId: number): Promise<ScannerSession> {
  try {
    await initDatabase();
  } catch (e) {}

  const sessionId = Math.random().toString(36).substring(2, 8).toUpperCase();
  const now = Date.now();

  const newSession: ScannerSession = {
    sessionId,
    shopId,
    createdAt: now,
    lastScannedBarcode: null,
    lastScannedTime: 0,
    paired: false,
  };

  try {
    await db.insert(scannerSessions).values({
      sessionId,
      shopId,
      paired: false,
      lastScannedBarcode: null,
      lastScannedTime: 0,
      createdAt: now,
    });

    // Cleanup sessions older than 30 minutes
    const thirtyMinsAgo = now - 30 * 60 * 1000;
    await db.delete(scannerSessions).where(lt(scannerSessions.createdAt, thirtyMinsAgo)).catch(() => {});
  } catch (e) {
    console.error("createScannerSession DB error:", e);
  }

  return newSession;
}

export async function getScannerSession(sessionId: string): Promise<ScannerSession | null> {
  try {
    await initDatabase();
  } catch (e) {}

  try {
    const list = await db
      .select()
      .from(scannerSessions)
      .where(eq(scannerSessions.sessionId, sessionId.toUpperCase().trim()));

    const s = list[0];
    if (!s) return null;

    return {
      sessionId: s.sessionId,
      shopId: s.shopId,
      createdAt: s.createdAt,
      lastScannedBarcode: s.lastScannedBarcode,
      lastScannedTime: s.lastScannedTime,
      paired: Boolean(s.paired),
    };
  } catch (e) {
    console.error("getScannerSession DB error:", e);
    return null;
  }
}

export async function pairScannerSession(sessionId: string): Promise<boolean> {
  try {
    await initDatabase();
  } catch (e) {}

  try {
    await db
      .update(scannerSessions)
      .set({ paired: true })
      .where(eq(scannerSessions.sessionId, sessionId.toUpperCase().trim()));

    return true;
  } catch (e) {
    return false;
  }
}

export async function pushRemoteScan(sessionId: string, barcode: string): Promise<boolean> {
  try {
    await initDatabase();
  } catch (e) {}

  try {
    await db
      .update(scannerSessions)
      .set({
        lastScannedBarcode: barcode,
        lastScannedTime: Date.now(),
        paired: true,
      })
      .where(eq(scannerSessions.sessionId, sessionId.toUpperCase().trim()));

    return true;
  } catch (e) {
    return false;
  }
}
