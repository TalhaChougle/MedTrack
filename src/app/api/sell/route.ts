import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { medicines, batches, auditLogs } from "@/lib/db/schema";
import { eq, and, asc, gt } from "drizzle-orm";

export async function POST(req: Request) {
  const session = await getAuthSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const shopId = session.user.shopId;
  const userId = parseInt(session.user.id);

  try {
    const body = await req.json();
    const { medicineId, quantity } = body;

    const medId = parseInt(medicineId);
    const requestedQty = parseInt(quantity);

    if (isNaN(medId) || isNaN(requestedQty) || requestedQty <= 0) {
      return NextResponse.json(
        { error: "Valid medicineId and positive quantity are required." },
        { status: 400 }
      );
    }

    // Verify medicine belongs to shop
    const [med] = await db
      .select()
      .from(medicines)
      .where(
        and(
          eq(medicines.id, medId),
          eq(medicines.shopId, shopId)
        )
      );

    if (!med) {
      return NextResponse.json(
        { error: "Medicine not found in your shop." },
        { status: 404 }
      );
    }

    // 1. Fetch all batches for medicine with quantity > 0 and shopId matching
    // 2. Sort ascending by expiry_date (nearest expiry first)
    const availableBatches = await db
      .select()
      .from(batches)
      .where(
        and(
          eq(batches.shopId, shopId),
          eq(batches.medicineId, medId),
          gt(batches.quantity, 0)
        )
      )
      .orderBy(asc(batches.expiryDate));

    // 3. Sum total available
    const totalAvailable = availableBatches.reduce((sum, b) => sum + b.quantity, 0);

    if (totalAvailable < requestedQty) {
      return NextResponse.json(
        {
          error: `Insufficient stock! Requested ${requestedQty} units, but only ${totalAvailable} units available in stock.`,
          totalAvailable,
          requestedQty,
        },
        { status: 400 }
      );
    }

    // 4. Iterate through sorted batches and deduct FEFO
    let remainingToDeduct = requestedQty;
    const deductions: Array<{
      batchId: number;
      batchNumber: string;
      expiryDate: string;
      supplier: string;
      deductedQuantity: number;
      newBatchQuantity: number;
    }> = [];

    for (const batchItem of availableBatches) {
      if (remainingToDeduct <= 0) break;

      const takeFromThisBatch = Math.min(batchItem.quantity, remainingToDeduct);
      const newQty = batchItem.quantity - takeFromThisBatch;
      remainingToDeduct -= takeFromThisBatch;

      // 5. Update batch in database
      await db
        .update(batches)
        .set({ quantity: newQty })
        .where(eq(batches.id, batchItem.id));

      deductions.push({
        batchId: batchItem.id,
        batchNumber: batchItem.batchNumber,
        expiryDate: batchItem.expiryDate,
        supplier: batchItem.supplier,
        deductedQuantity: takeFromThisBatch,
        newBatchQuantity: newQty,
      });
    }

    // 6. Write audit log entry
    await db.insert(auditLogs).values({
      shopId,
      userId,
      action: "SELL",
      entityType: "medicine",
      entityId: med.id,
      detail: JSON.stringify({
        medicineName: med.name,
        requestedQuantity: requestedQty,
        totalSaleAmount: requestedQty * med.unitPrice,
        deductions,
      }),
    });

    // 7. Return deduction list
    return NextResponse.json({
      success: true,
      medicineName: med.name,
      requestedQuantity: requestedQty,
      unitPrice: med.unitPrice,
      totalPrice: requestedQty * med.unitPrice,
      deductions,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Sell dispense failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
