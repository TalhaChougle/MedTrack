// In-memory store for pairing store smartphone cameras to desktop POS sessions

export interface ScannerSession {
  sessionId: string;
  shopId: number;
  createdAt: number;
  lastScannedBarcode: string | null;
  lastScannedTime: number;
  paired: boolean;
}

// Global store map surviving Next.js hot reloads in dev mode
const globalForScanner = globalThis as unknown as {
  scannerSessions: Map<string, ScannerSession>;
};

export const sessions =
  globalForScanner.scannerSessions || new Map<string, ScannerSession>();

if (process.env.NODE_ENV !== "production") {
  globalForScanner.scannerSessions = sessions;
}

export function createScannerSession(shopId: number): ScannerSession {
  const sessionId = Math.random().toString(36).substring(2, 8).toUpperCase();
  const session: ScannerSession = {
    sessionId,
    shopId,
    createdAt: Date.now(),
    lastScannedBarcode: null,
    lastScannedTime: 0,
    paired: false,
  };

  sessions.set(sessionId, session);

  // Auto-cleanup sessions older than 30 minutes
  const thirtyMinsAgo = Date.now() - 30 * 60 * 1000;
  for (const [id, sess] of sessions.entries()) {
    if (sess.createdAt < thirtyMinsAgo) {
      sessions.delete(id);
    }
  }

  return session;
}

export function getScannerSession(sessionId: string): ScannerSession | null {
  return sessions.get(sessionId) || null;
}

export function pairScannerSession(sessionId: string): boolean {
  const sess = sessions.get(sessionId);
  if (sess) {
    sess.paired = true;
    return true;
  }
  return false;
}

export function pushRemoteScan(sessionId: string, barcode: string): boolean {
  const sess = sessions.get(sessionId);
  if (sess) {
    sess.lastScannedBarcode = barcode;
    sess.lastScannedTime = Date.now();
    sess.paired = true;
    return true;
  }
  return false;
}
