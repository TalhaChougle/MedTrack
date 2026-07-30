import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { medicines, batches, auditLogs } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

function suggestNextBatchNumber(batchNumbers: string[]): string {
  let maxNum = 0;
  for (const b of batchNumbers) {
    const match = b.match(/(\d+)/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > maxNum) maxNum = num;
    }
  }
  const nextNum = maxNum + 1;
  const padded = nextNum.toString().padStart(3, "0");
  return `BATCH-${padded}`;
}

export async function GET(req: Request) {
  const session = await getAuthSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const shopId = session.user.shopId;
  const { searchParams } = new URL(req.url);
  const barcode = searchParams.get("barcode")?.trim();

  if (!barcode) {
    return NextResponse.json({ error: "Barcode query parameter is required." }, { status: 400 });
  }

  try {
    const [med] = await db
      .select()
      .from(medicines)
      .where(
        and(
          eq(medicines.shopId, shopId),
          eq(medicines.barcode, barcode)
        )
      );

    if (!med) {
      return NextResponse.json({
        isNew: true,
        medicine: {
          id: 0,
          barcode,
          name: "",
          manufacturer: "General Pharma",
          category: "General",
          schedule: "OTC",
          price: 0,
        },
        suggestedBatchNumber: "BATCH-001",
        existingBatchesCount: 0,
      });
    }

    const medBatches = await db
      .select()
      .from(batches)
      .where(
        and(
          eq(batches.shopId, shopId),
          eq(batches.medicineId, med.id)
        )
      );

    const existingBatchNumbers = medBatches.map((b) => b.batchNumber);
    const suggestedBatchNumber = suggestNextBatchNumber(existingBatchNumbers);

    return NextResponse.json({
      isNew: false,
      medicine: med,
      suggestedBatchNumber,
      existingBatchesCount: medBatches.length,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Lookup failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await getAuthSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const shopId = session.user.shopId;
  const userId = parseInt(session.user.id);

  try {
    const body = await req.json();
    const {
      barcode,
      medicineName,
      category,
      manufacturer,
      schedule,
      price,
      batchNumber,
      quantity,
      expiryDate,
      supplier,
      costPrice,
      receivedDate,
    } = body;

    if (!barcode || quantity === undefined || !expiryDate || !supplier) {
      return NextResponse.json(
        { error: "Barcode, quantity, expiry date, and supplier are required." },
        { status: 400 }
      );
    }

    // Auto-resolve or create medicine
    let [med] = await db
      .select()
      .from(medicines)
      .where(
        and(
          eq(medicines.shopId, shopId),
          eq(medicines.barcode, barcode.trim())
        )
      );

    if (!med) {
      const nameToUse = medicineName?.trim() || `Medicine (${barcode.trim()})`;
      [med] = await db
        .insert(medicines)
        .values({
          shopId,
          barcode: barcode.trim(),
          name: nameToUse,
          manufacturer: manufacturer?.trim() || "General Pharma",
          schedule: schedule?.trim() || "OTC",
          unitPrice: parseFloat(price) || 0,
        })
        .returning();
    }

    const existingBatches = await db
      .select()
      .from(batches)
      .where(
        and(
          eq(batches.shopId, shopId),
          eq(batches.medicineId, med.id)
        )
      );

    const finalBatchNumber =
      batchNumber?.trim() ||
      suggestNextBatchNumber(existingBatches.map((b) => b.batchNumber));

    const qty = parseInt(quantity);
    if (isNaN(qty) || qty < 0) {
      return NextResponse.json(
        { error: "Quantity must be a non-negative integer." },
        { status: 400 }
      );
    }

    const todayStr = new Date().toISOString().split("T")[0];

    const [newBatch] = await db
      .insert(batches)
      .values({
        shopId,
        medicineId: med.id,
        batchNumber: finalBatchNumber,
        quantity: qty,
        expiryDate: expiryDate.trim(),
        supplier: supplier.trim(),
        costPrice: parseFloat(costPrice) || 0,
        receivedDate: receivedDate ? receivedDate.trim() : todayStr,
      })
      .returning();

    // Audit log
    await db.insert(auditLogs).values({
      shopId,
      userId,
      action: "STOCK_IN",
      entityType: "batch",
      entityId: newBatch.id,
      detail: JSON.stringify({
        medicineName: med.name,
        barcode: med.barcode,
        batchNumber: newBatch.batchNumber,
        quantity: newBatch.quantity,
        expiryDate: newBatch.expiryDate,
        supplier: newBatch.supplier,
      }),
    });

    return NextResponse.json(
      {
        batch: newBatch,
        medicine: med,
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Stock in failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
