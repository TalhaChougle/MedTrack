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

function formatAuditDetail(detailStr: string | null): string {
  if (!detailStr) return "N/A";
  try {
    const obj = JSON.parse(detailStr);
    const parts: string[] = [];
    if (obj.medicineName) parts.push(`Medicine: ${obj.medicineName}`);
    if (obj.batchNumber) parts.push(`Batch: ${obj.batchNumber}`);
    if (obj.quantity !== undefined || obj.requestedQuantity !== undefined) {
      parts.push(`Qty: ${obj.quantity ?? obj.requestedQuantity}`);
    }
    if (obj.unitPrice !== undefined) parts.push(`Price: ₹${obj.unitPrice}`);
    if (obj.totalSaleAmount !== undefined) parts.push(`Total: ₹${obj.totalSaleAmount}`);
    if (obj.expiryDate) parts.push(`Exp: ${obj.expiryDate}`);

    return parts.length > 0 ? parts.join(" | ") : detailStr;
  } catch (e) {
    return detailStr;
  }
}

function buildExcelHtml(title: string, headers: string[], rows: (string | number | null | undefined)[][]): string {
  const headerHtml = headers.map((h) => `<th>${h}</th>`).join("");
  const rowsHtml = rows
    .map(
      (row) =>
        `<tr>${row
          .map((cell) => {
            const strCell = String(cell ?? "");
            let style = "";
            if (strCell.toLowerCase().includes("expired")) {
              style = "style='background-color: #FFE4E6; color: #9F1239; font-weight: bold;'";
            } else if (strCell.toLowerCase().includes("healthy") || strCell.toLowerCase().includes("valid")) {
              style = "style='background-color: #D1FAE5; color: #065F46; font-weight: bold;'";
            }
            return `<td ${style}>${strCell}</td>`;
          })
          .join("")}</tr>`
    )
    .join("\n");

  return `\uFEFF<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
<!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>${title}</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->
<style>
  table { border-collapse: collapse; font-family: Segoe UI, Arial, sans-serif; font-size: 12px; width: 100%; }
  th { background-color: #1E3A5F; color: #FFFFFF; font-weight: bold; padding: 10px 14px; border: 1px solid #0F172A; text-align: left; }
  td { padding: 8px 12px; border: 1px solid #CBD5E1; text-align: left; vertical-align: middle; }
  tr:nth-child(even) { background-color: #F8FAFC; }
</style>
</head>
<body>
<h2>MedTrack Pharmacy Management — ${title}</h2>
<p>Export Date: ${new Date().toLocaleDateString("en-IN")}</p>
<table>
<thead><tr>${headerHtml}</tr></thead>
<tbody>
${rowsHtml}
</tbody>
</table>
</body>
</html>`;
}

export async function GET(req: Request) {
  const session = await getAuthSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type");
  const format = searchParams.get("format") || "excel"; // 'excel' or 'csv'
  const shopId = session.user.shopId;
  const todayStr = new Date().toISOString().split("T")[0];

  try {
    if (type === "expiry") {
      // Expiry Report
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
        "Cost Price (₹)",
        "Received Date",
      ];

      const dataRows = batchList.map((b) => {
        const alert = classifyExpiry(b.expiryDate);
        return [
          b.medicineName,
          b.manufacturer,
          b.barcode || "N/A",
          b.schedule,
          b.batchNumber,
          b.quantity,
          b.expiryDate,
          alert.daysLeft,
          alert.level ? alert.level.toUpperCase() : "HEALTHY",
          alert.action,
          b.supplier,
          `₹${b.costPrice}`,
          b.receivedDate,
        ];
      });

      if (format === "csv") {
        const csvRows = dataRows.map((r) => r.map(escapeCsv).join(","));
        const csvContent = "\uFEFF" + [headers.map(escapeCsv).join(","), ...csvRows].join("\r\n");
        return new NextResponse(csvContent, {
          status: 200,
          headers: {
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": `attachment; filename="expiry-report-${todayStr}.csv"`,
          },
        });
      }

      // Default Excel HTML Output (.xls)
      const excelHtml = buildExcelHtml("Expiry Compliance Report", headers, dataRows);
      return new NextResponse(excelHtml, {
        status: 200,
        headers: {
          "Content-Type": "application/vnd.ms-excel; charset=utf-8",
          "Content-Disposition": `attachment; filename="expiry-report-${todayStr}.xls"`,
        },
      });
    } else if (type === "wastage") {
      // Wastage Log
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

      const dataRows =
        logs.length > 0
          ? logs.map((l) => [
              l.id,
              l.medicineName,
              l.batchNumber,
              l.quantity,
              l.reason,
              l.performedByName || "System",
              l.date,
            ])
          : [["-", "No wastage logs recorded yet", "-", 0, "No stock written off yet", "-", todayStr]];

      if (format === "csv") {
        const csvRows = dataRows.map((r) => r.map(escapeCsv).join(","));
        const csvContent = "\uFEFF" + [headers.map(escapeCsv).join(","), ...csvRows].join("\r\n");
        return new NextResponse(csvContent, {
          status: 200,
          headers: {
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": `attachment; filename="wastage-log-${todayStr}.csv"`,
          },
        });
      }

      const excelHtml = buildExcelHtml("Wastage & Write-Off Log", headers, dataRows);
      return new NextResponse(excelHtml, {
        status: 200,
        headers: {
          "Content-Type": "application/vnd.ms-excel; charset=utf-8",
          "Content-Disposition": `attachment; filename="wastage-log-${todayStr}.xls"`,
        },
      });
    } else if (type === "audit") {
      // Audit Trail
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
        "Action Details",
        "Timestamp",
      ];

      const dataRows = logs.map((a) => [
        a.id,
        a.userName || "Pharmacy Admin",
        a.userEmail || "N/A",
        a.action,
        a.entityType || "N/A",
        a.entityId || "N/A",
        formatAuditDetail(a.detail),
        a.timestamp,
      ]);

      if (format === "csv") {
        const csvRows = dataRows.map((r) => r.map(escapeCsv).join(","));
        const csvContent = "\uFEFF" + [headers.map(escapeCsv).join(","), ...csvRows].join("\r\n");
        return new NextResponse(csvContent, {
          status: 200,
          headers: {
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": `attachment; filename="audit-trail-${todayStr}.csv"`,
          },
        });
      }

      const excelHtml = buildExcelHtml("System Audit Register", headers, dataRows);
      return new NextResponse(excelHtml, {
        status: 200,
        headers: {
          "Content-Type": "application/vnd.ms-excel; charset=utf-8",
          "Content-Disposition": `attachment; filename="audit-trail-${todayStr}.xls"`,
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
