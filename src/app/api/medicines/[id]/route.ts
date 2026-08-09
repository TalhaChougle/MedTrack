import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { medicines, batches, auditLogs, incomingOrders, wastageLogs } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { persistCurrentDatabaseState } from "@/lib/db/storeSync";

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAuthSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const shopId = session.user.shopId;
  const userId = parseInt(session.user.id);
  const resolvedParams = await params;
  const medId = parseInt(resolvedParams.id);

  if (isNaN(medId)) {
    return NextResponse.json({ error: "Invalid medicine ID" }, { status: 400 });
  }

  try {
    // 1. Verify medicine exists and belongs to this shop
    const [med] = await db
      .select()
      .from(medicines)
      .where(and(eq(medicines.id, medId), eq(medicines.shopId, shopId)));

    if (!med) {
      return NextResponse.json({ error: "Medicine not found in your inventory" }, { status: 404 });
    }

    // 2. Delete associated child records explicitly for database engine safety
    await db.delete(wastageLogs).where(and(eq(wastageLogs.shopId, shopId), eq(wastageLogs.medicineId, medId))).catch(() => {});
    await db.delete(incomingOrders).where(and(eq(incomingOrders.shopId, shopId), eq(incomingOrders.medicineId, medId))).catch(() => {});
    await db.delete(batches).where(and(eq(batches.shopId, shopId), eq(batches.medicineId, medId))).catch(() => {});

    // 3. Delete primary medicine record
    await db.delete(medicines).where(and(eq(medicines.id, medId), eq(medicines.shopId, shopId)));

    // 4. Immediately sync memory cache & snapshot
    await persistCurrentDatabaseState();

    // 5. Audit Log
    await db.insert(auditLogs).values({
      shopId,
      userId,
      action: "MEDICINE_DELETE",
      entityType: "medicine",
      entityId: medId,
      detail: JSON.stringify({
        name: med.name,
        barcode: med.barcode,
        manufacturer: med.manufacturer,
      }),
    });

    return NextResponse.json({
      success: true,
      message: `Successfully deleted medicine '${med.name}' and all associated stock batches.`,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Failed to delete medicine";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
