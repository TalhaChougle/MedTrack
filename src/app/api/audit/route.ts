import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { auditLogs, users } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";

export async function GET() {
  const session = await getAuthSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Owner role enforcement for audit logs
  if (session.user.role !== "owner") {
    return NextResponse.json(
      { error: "Access denied. Only pharmacy owners can view system audit logs." },
      { status: 403 }
    );
  }

  const shopId = session.user.shopId;

  try {
    const list = await db
      .select({
        id: auditLogs.id,
        shopId: auditLogs.shopId,
        userId: auditLogs.userId,
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
      .orderBy(desc(auditLogs.timestamp))
      .limit(200);

    return NextResponse.json(list);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Failed to fetch audit logs";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
