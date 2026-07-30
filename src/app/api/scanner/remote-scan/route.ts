import { NextResponse } from "next/server";
import { getScannerSession, pushRemoteScan, pairScannerSession } from "@/lib/scannerStore";

// POST /api/scanner/remote-scan -> Called by Mobile Phone to submit scanned barcode or register pairing
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { sessionId, barcode, action } = body;

    if (!sessionId) {
      return NextResponse.json({ error: "Session ID is required" }, { status: 400 });
    }

    const session = await getScannerSession(sessionId);
    if (!session) {
      return NextResponse.json(
        { error: "Pairing session not found or expired. Please rescan QR code on desktop." },
        { status: 404 }
      );
    }

    if (action === "pair") {
      await pairScannerSession(sessionId);
      return NextResponse.json({
        success: true,
        shopId: session.shopId,
        message: "Successfully paired with desktop counter!",
      });
    }

    if (!barcode || typeof barcode !== "string") {
      return NextResponse.json({ error: "Valid barcode is required" }, { status: 400 });
    }

    const cleanBarcode = barcode.trim();
    await pushRemoteScan(sessionId, cleanBarcode);

    return NextResponse.json({
      success: true,
      barcode: cleanBarcode,
      timestamp: Date.now(),
    });
  } catch (error: any) {
    return NextResponse.json({ error: "Failed to process remote scan" }, { status: 500 });
  }
}
