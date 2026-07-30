import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { batches, medicines, wastageLogs, auditLogs, users } from "@/lib/db/schema";
import { eq, asc, desc } from "drizzle-orm";
import { classifyExpiry } from "@/app/api/batches/alerts/route";

function escapeCsv(val: unknown): string {
  if (val === null || val === undefined) return '""';
  const str = String(val).replace(/"/g, '""');
  return `"${str}"`;
}

export async function GET(req: Request) {
  const session = await getAuthSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type");
  const shopId = session.user.shopId;
  const todayStr = new Date().toISOString().split("T")[0];

  try {
    if (type === "expiry") {
      // Expiry Report CSV
      const batchList = await db
        .select({
          medicineName: medicines.name,
          manufacturer: medicines.manufacturer,
          barcode: medicines.barcode,
          schedule: medicines.schedule,
          batchNumber: batches.batchNumber,
          quantity: batches.quantity,
          expiryDate: batches.expiryDate,
          supplier: batches.supplier,
          costPrice: batches.costPrice,
          receivedDate: batches.receivedDate,
        })
        .from(batches)
        .innerJoin(medicines, eq(batches.medicineId, medicines.id))
        .where(eq(batches.shopId, shopId))
        .orderBy(asc(batches.expiryDate));

      const headers = [
        "Medicine Name",
        "Manufacturer",
        "Barcode",
        "Schedule",
        "Batch Number",
        "Quantity",
        "Expiry Date",
        "Days Left",
        "Alert Status",
        "Recommended Action",
        "Supplier",
        "Cost Price",
        "Received Date",
      ];

      const rows = batchList.map((b) => {
        const alert = classifyExpiry(b.expiryDate);
        return [
          escapeCsv(b.medicineName),
          escapeCsv(b.manufacturer),
          escapeCsv(b.barcode || "N/A"),
          escapeCsv(b.schedule),
          escapeCsv(b.batchNumber),
          escapeCsv(b.quantity),
          escapeCsv(b.expiryDate),
          escapeCsv(alert.daysLeft),
          escapeCsv(alert.level || "Healthy"),
          escapeCsv(alert.action),
          escapeCsv(b.supplier),
          escapeCsv(b.costPrice),
          escapeCsv(b.receivedDate),
        ].join(",");
      });

      const csvContent = "\uFEFF" + [headers.join(","), ...rows].join("\r\n");
      const fileName = `expiry-report-${todayStr}.csv`;

      return new NextResponse(csvContent, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${fileName}"`,
        },
      });
    } else if (type === "wastage") {
      // Wastage Log CSV
      const logs = await db
        .select({
          id: wastageLogs.id,
          medicineName: medicines.name,
          batchNumber: wastageLogs.batchNumber,
          quantity: wastageLogs.quantity,
          reason: wastageLogs.reason,
          performedByName: users.name,
          date: wastageLogs.date,
        })
        .from(wastageLogs)
        .innerJoin(medicines, eq(wastageLogs.medicineId, medicines.id))
        .leftJoin(users, eq(wastageLogs.performedBy, users.id))
        .where(eq(wastageLogs.shopId, shopId))
        .orderBy(desc(wastageLogs.date));

      const headers = [
        "Log ID",
        "Medicine Name",
        "Batch Number",
        "Quantity Written Off",
        "Reason",
        "Logged By",
        "Timestamp",
      ];

      const rows = logs.map((l) => [
        escapeCsv(l.id),
        escapeCsv(l.medicineName),
        escapeCsv(l.batchNumber),
        escapeCsv(l.quantity),
        escapeCsv(l.reason),
        escapeCsv(l.performedByName || "Unknown"),
        escapeCsv(l.date),
      ].join(","));

      const csvContent = "\uFEFF" + [headers.join(","), ...rows].join("\r\n");
      const fileName = `wastage-log-${todayStr}.csv`;

      return new NextResponse(csvContent, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${fileName}"`,
        },
      });
    } else if (type === "audit") {
      // Audit Trail CSV - Owner role required
      if (session.user.role !== "owner") {
        return NextResponse.json(
          { error: "Access denied. Only pharmacy owners can export system audit logs." },
          { status: 403 }
        );
      }

      const logs = await db
        .select({
          id: auditLogs.id,
          userName: users.name,
          userEmail: users.email,
          action: auditLogs.action,
          entityType: auditLogs.entityType,
          entityId: auditLogs.entityId,
          detail: auditLogs.detail,
          timestamp: auditLogs.timestamp,
        })
        .from(auditLogs)
        .leftJoin(users, eq(auditLogs.userId, users.id))
        .where(eq(auditLogs.shopId, shopId))
        .orderBy(desc(auditLogs.timestamp));

      const headers = [
        "Audit ID",
        "User Name",
        "User Email",
        "Action Type",
        "Entity Type",
        "Entity ID",
        "Detail",
        "Timestamp",
      ];

      const rows = logs.map((a) => [
        escapeCsv(a.id),
        escapeCsv(a.userName || "System"),
        escapeCsv(a.userEmail || "N/A"),
        escapeCsv(a.action),
        escapeCsv(a.entityType || "N/A"),
        escapeCsv(a.entityId || "N/A"),
        escapeCsv(a.detail || ""),
        escapeCsv(a.timestamp),
      ].join(","));

      const csvContent = "\uFEFF" + [headers.join(","), ...rows].join("\r\n");
      const fileName = `audit-trail-${todayStr}.csv`;

      return new NextResponse(csvContent, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${fileName}"`,
        },
      });
    } else {
      return NextResponse.json(
        { error: "Invalid export type. Must be 'expiry', 'wastage', or 'audit'." },
        { status: 400 }
      );
    }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Export failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
