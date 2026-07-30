import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { medicines, batches, incomingOrders } from "@/lib/db/schema";
import { eq, and, sql, like } from "drizzle-orm";

export async function GET(req: Request) {
  const session = await getAuthSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim() || "";

  if (!q) {
    return NextResponse.json([]);
  }

  const shopId = session.user.shopId;

  try {
    // 1. Fetch from openFDA public API with fallback
    let fdaResults: Array<{
      generic_name?: string[];
      brand_name?: string[];
      active_ingredient?: string[];
      purpose?: string[];
      warnings?: string[];
    }> = [];

    try {
      const fdaUrl = `https://api.fda.gov/drug/label.json?search=openfda.generic_name:"${encodeURIComponent(
        q
      )}"+openfda.brand_name:"${encodeURIComponent(q)}"&limit=5`;
      const res = await fetch(fdaUrl, { next: { revalidate: 3600 } });
      if (res.ok) {
        const data = await res.json();
        fdaResults = data.results || [];
      }
    } catch (fdaError) {
      console.warn("openFDA API unavailable:", fdaError);
      // Graceful fallback: return empty result array without crashing
    }

    // 2. Cross check query against local stock and pending orders
    const pattern = `%${q}%`;
    const localMeds = await db
      .select({
        id: medicines.id,
        name: medicines.name,
        manufacturer: medicines.manufacturer,
        totalStock: sql<number>`COALESCE(SUM(${batches.quantity}), 0)`,
      })
      .from(medicines)
      .leftJoin(batches, eq(medicines.id, batches.medicineId))
      .where(
        and(
          eq(medicines.shopId, shopId),
          like(medicines.name, pattern)
        )
      )
      .groupBy(medicines.id);

    const pendingOrdersList = await db
      .select({
        id: incomingOrders.id,
        medicineId: incomingOrders.medicineId,
        expectedQuantity: incomingOrders.expectedQuantity,
        expectedArrivalDate: incomingOrders.expectedArrivalDate,
        status: incomingOrders.status,
      })
      .from(incomingOrders)
      .where(
        and(
          eq(incomingOrders.shopId, shopId),
          eq(incomingOrders.status, "pending")
        )
      );

    return NextResponse.json({
      fdaResults: fdaResults.map((item) => ({
        genericName: item.generic_name?.[0] || "N/A",
        brandName: item.brand_name?.[0] || "N/A",
        activeIngredient: item.active_ingredient?.[0] || "N/A",
        purpose: item.purpose?.[0] || "N/A",
        warnings: item.warnings?.[0]?.substring(0, 250) + "..." || "N/A",
      })),
      localMatch: localMeds,
      pendingOrdersCount: pendingOrdersList.length,
    });
  } catch (error: unknown) {
    console.error("Reference search error:", error);
    // Always fail gracefully
    return NextResponse.json({
      fdaResults: [],
      localMatch: [],
      pendingOrdersCount: 0,
    });
  }
}
