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
    const { medicineId, quantity, unitPrice: customUnitPrice } = body;

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

    const todayStr = new Date().toISOString().split("T")[0];

    // 1. Fetch all batches for medicine with quantity > 0 and shopId matching
    const allBatchesForMed = await db
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

    // Separate valid unexpired stock vs expired stock
    const availableBatches = allBatchesForMed.filter((b) => b.expiryDate >= todayStr);
    const expiredBatches = allBatchesForMed.filter((b) => b.expiryDate < todayStr);

    if (availableBatches.length === 0 && expiredBatches.length > 0) {
      const expiredSample = expiredBatches[0];
      return NextResponse.json(
        {
          error: `Cannot dispense expired stock! All available stock for ${med.name} is EXPIRED (Batch ${expiredSample.batchNumber} expired on ${expiredSample.expiryDate}). Expired medicines cannot be sold to patients. Please log under Wastage.`,
          isExpiredError: true,
        },
        { status: 400 }
      );
    }

    // Determine effective selling unit price (passed custom price -> med price -> batch cost price fallback)
    const passedPrice = parseFloat(customUnitPrice);
    const fallbackPrice = allBatchesForMed.length > 0 ? (allBatchesForMed[0].costPrice || 0) : 0;
    const effectiveUnitPrice = !isNaN(passedPrice) && passedPrice > 0 
      ? passedPrice 
      : (med.unitPrice > 0 ? med.unitPrice : fallbackPrice);

    // Update medicine unit price in database if it was updated or previously zero
    if (effectiveUnitPrice > 0 && med.unitPrice !== effectiveUnitPrice) {
      await db.update(medicines).set({ unitPrice: effectiveUnitPrice }).where(eq(medicines.id, med.id));
    }

    // 3. Sum total available valid unexpired stock
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

    const totalSaleAmount = requestedQty * effectiveUnitPrice;

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
        unitPrice: effectiveUnitPrice,
        totalSaleAmount,
        deductions,
      }),
    });

    // 7. Return deduction list
    return NextResponse.json({
      success: true,
      medicineName: med.name,
      requestedQuantity: requestedQty,
      unitPrice: effectiveUnitPrice,
      totalPrice: totalSaleAmount,
      deductions,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Sell dispense failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
