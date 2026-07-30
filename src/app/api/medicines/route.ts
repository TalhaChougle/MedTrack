import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { medicines, batches, auditLogs } from "@/lib/db/schema";
import { eq, and, sql, like } from "drizzle-orm";

export async function GET() {
  const session = await getAuthSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const shopId = session.user.shopId;

  try {
    // Select medicines and calculate total stock & batch count per medicine
    const medList = await db
      .select({
        id: medicines.id,
        shopId: medicines.shopId,
        name: medicines.name,
        barcode: medicines.barcode,
        manufacturer: medicines.manufacturer,
        schedule: medicines.schedule,
        unitPrice: medicines.unitPrice,
        reorderThreshold: medicines.reorderThreshold,
        createdAt: medicines.createdAt,
        totalStock: sql<number>`COALESCE(SUM(${batches.quantity}), 0)`,
        batchCount: sql<number>`COUNT(${batches.id})`,
      })
      .from(medicines)
      .leftJoin(batches, eq(medicines.id, batches.medicineId))
      .where(eq(medicines.shopId, shopId))
      .groupBy(
        medicines.id,
        medicines.shopId,
        medicines.name,
        medicines.barcode,
        medicines.manufacturer,
        medicines.schedule,
        medicines.unitPrice,
        medicines.reorderThreshold,
        medicines.createdAt
      )
      .orderBy(medicines.name);

    return NextResponse.json(medList);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Failed to fetch medicines";
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
    const { name, manufacturer, barcode, schedule, unitPrice, reorderThreshold } = body;

    if (!name || !manufacturer) {
      return NextResponse.json(
        { error: "Medicine name and manufacturer are required." },
        { status: 400 }
      );
    }

    const trimmedBarcode = barcode?.trim() || null;

    // Check barcode uniqueness per shop if barcode is provided
    if (trimmedBarcode) {
      const existing = await db
        .select()
        .from(medicines)
        .where(
          and(
            eq(medicines.shopId, shopId),
            eq(medicines.barcode, trimmedBarcode)
          )
        );

      if (existing.length > 0) {
        return NextResponse.json(
          { error: `Barcode '${trimmedBarcode}' is already assigned to another medicine in your shop.` },
          { status: 400 }
        );
      }
    }

    const [newMed] = await db
      .insert(medicines)
      .values({
        shopId,
        name: name.trim(),
        manufacturer: manufacturer.trim(),
        barcode: trimmedBarcode,
        schedule: schedule || "OTC",
        unitPrice: parseFloat(unitPrice) || 0,
        reorderThreshold: parseInt(reorderThreshold) || 10,
      })
      .returning();

    // Audit log
    await db.insert(auditLogs).values({
      shopId,
      userId,
      action: "MEDICINE_ADD",
      entityType: "medicine",
      entityId: newMed.id,
      detail: JSON.stringify({
        name: newMed.name,
        barcode: newMed.barcode,
        manufacturer: newMed.manufacturer,
        schedule: newMed.schedule,
      }),
    });

    return NextResponse.json(newMed, { status: 201 });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Failed to add medicine";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
