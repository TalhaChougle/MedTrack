import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import {
  createScannerSession,
  getScannerSession,
} from "@/lib/scannerStore";

// POST /api/scanner/session -> Creates a new pairing session for the desktop
export async function POST(req: Request) {
  const session = await getAuthSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const shopId = session.user.shopId;
  const scannerSession = createScannerSession(shopId);

  const origin = req.headers.get("origin") || req.headers.get("host") || "";
  const host = origin.startsWith("http") ? origin : `http://${origin}`;
  const remoteUrl = `${host}/remote-scan?session=${scannerSession.sessionId}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(
    remoteUrl
  )}`;

  return NextResponse.json({
    sessionId: scannerSession.sessionId,
    remoteUrl,
    qrUrl,
    createdAt: scannerSession.createdAt,
  });
}

// GET /api/scanner/session?sessionId=XXX&since=123 -> Polled by desktop modal to check for scans
export async function GET(req: Request) {
  const session = await getAuthSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get("sessionId");
  const since = parseInt(searchParams.get("since") || "0", 10);

  if (!sessionId) {
    return NextResponse.json({ error: "Session ID is required" }, { status: 400 });
  }

  const scannerSession = getScannerSession(sessionId);

  if (!scannerSession) {
    return NextResponse.json({ error: "Scanner session expired or invalid" }, { status: 404 });
  }

  const hasNewScan =
    scannerSession.lastScannedBarcode !== null &&
    scannerSession.lastScannedTime > since;

  return NextResponse.json({
    paired: scannerSession.paired,
    newScan: hasNewScan
      ? {
          barcode: scannerSession.lastScannedBarcode,
          timestamp: scannerSession.lastScannedTime,
        }
      : null,
  });
}
