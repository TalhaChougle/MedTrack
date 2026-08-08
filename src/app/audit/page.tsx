"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  FileSpreadsheet,
  Download,
  ShieldCheck,
  Lock,
} from "lucide-react";

export default function AuditExportsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    } else if (status === "authenticated") {
      if (session?.user?.role !== "owner") {
        setAccessDenied(true);
        setLoading(false);
      } else {
        fetchAuditLogs();
      }
    }
  }, [status, session, router]);

  const fetchAuditLogs = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/audit");
      if (res.ok) {
        setAuditLogs(await res.json());
      } else if (res.status === 403) {
        setAccessDenied(true);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = (type: "expiry" | "wastage" | "audit", format: "excel" | "csv" = "excel") => {
    window.open(`/api/export?type=${type}&format=${format}`, "_blank");
  };

  if (accessDenied) {
    return (
      <div className="py-16 text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-200">
          <Lock className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-extrabold text-[#1E3A5F]">Access Restricted</h2>
        <p className="text-xs text-slate-500 max-w-sm mx-auto font-medium">
          Audit trails and compliance exports are restricted to Pharmacy Owner accounts.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#1E3A5F] tracking-tight flex items-center gap-3">
            <FileSpreadsheet className="w-8 h-8 text-amber-600" />
            <span>Audit Trail & Excel / CSV Exports</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 font-medium">
            Immutable system activity log and 1-click formatted Excel spreadsheets for drug inspector compliance audits.
          </p>
        </div>
      </div>

      {/* Export Action Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-6 rounded-3xl bg-white border border-slate-200 space-y-4 flex flex-col justify-between shadow-xs">
          <div className="space-y-2">
            <span className="px-2.5 py-0.5 rounded text-[10px] font-extrabold bg-amber-50 text-amber-800 border border-amber-200">
              Stock & Expiry Report
            </span>
            <h3 className="text-lg font-extrabold text-[#1E3A5F]">Batch Expiry Report</h3>
            <p className="text-xs text-slate-500 font-medium">
              Full breakdown of all batches, expiry dates, remaining stock, days left, and alert classifications.
            </p>
          </div>
          <div className="space-y-2">
            <button
              onClick={() => handleDownload("expiry", "excel")}
              className="w-full py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4 text-white" />
              <span>Download Excel (.xls)</span>
            </button>
            <button
              onClick={() => handleDownload("expiry", "csv")}
              className="w-full py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] flex items-center justify-center gap-1.5 border border-slate-200 transition-all cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span>Download CSV (.csv)</span>
            </button>
          </div>
        </div>

        <div className="p-6 rounded-3xl bg-white border border-slate-200 space-y-4 flex flex-col justify-between shadow-xs">
          <div className="space-y-2">
            <span className="px-2.5 py-0.5 rounded text-[10px] font-extrabold bg-rose-50 text-rose-800 border border-rose-200">
              Write-Off Report
            </span>
            <h3 className="text-lg font-extrabold text-[#1E3A5F]">Wastage Log</h3>
            <p className="text-xs text-slate-500 font-medium">
              Complete history of written-off medicines, quantities, reasons, user IDs, and timestamps.
            </p>
          </div>
          <div className="space-y-2">
            <button
              onClick={() => handleDownload("wastage", "excel")}
              className="w-full py-2.5 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4 text-white" />
              <span>Download Excel (.xls)</span>
            </button>
            <button
              onClick={() => handleDownload("wastage", "csv")}
              className="w-full py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] flex items-center justify-center gap-1.5 border border-slate-200 transition-all cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span>Download CSV (.csv)</span>
            </button>
          </div>
        </div>

        <div className="p-6 rounded-3xl bg-white border border-slate-200 space-y-4 flex flex-col justify-between shadow-xs">
          <div className="space-y-2">
            <span className="px-2.5 py-0.5 rounded text-[10px] font-extrabold bg-teal-50 text-teal-800 border border-teal-200">
              Schedule H Compliance
            </span>
            <h3 className="text-lg font-extrabold text-[#1E3A5F]">System Audit Trail</h3>
            <p className="text-xs text-slate-500 font-medium">
              Complete dispensing log, stock-ins, registration, and status updates for drug inspector visits.
            </p>
          </div>
          <div className="space-y-2">
            <button
              onClick={() => handleDownload("audit", "excel")}
              className="w-full py-2.5 rounded-2xl bg-teal-600 hover:bg-teal-700 text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4 text-white" />
              <span>Download Excel (.xls)</span>
            </button>
            <button
              onClick={() => handleDownload("audit", "csv")}
              className="w-full py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] flex items-center justify-center gap-1.5 border border-slate-200 transition-all cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span>Download CSV (.csv)</span>
            </button>
          </div>
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 space-y-4 shadow-xs">
        <h3 className="text-base font-extrabold text-[#1E3A5F] flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-teal-600" />
          <span>System Audit Activity Feed</span>
        </h3>

        {loading ? (
          <p className="text-xs text-slate-500 text-center py-8 font-bold">Loading audit trail...</p>
        ) : auditLogs.length === 0 ? (
          <p className="text-xs text-slate-500 text-center py-8 font-medium">No audit logs recorded yet.</p>
        ) : (
          <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1">
            {auditLogs.map((log) => {
              let parsedDetail: any = {};
              try {
                parsedDetail = JSON.parse(log.detail || "{}");
              } catch (e) {}

              return (
                <div
                  key={log.id}
                  className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1.5 text-xs font-mono"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2 py-0.5 rounded font-sans text-[10px] font-black uppercase ${
                          log.action === "SELL"
                            ? "bg-teal-100 text-teal-800 border border-teal-200"
                            : log.action === "STOCK_IN"
                            ? "bg-[#1E3A5F] text-white"
                            : log.action === "WASTAGE"
                            ? "bg-rose-100 text-rose-800 border border-rose-200"
                            : "bg-amber-100 text-amber-800 border border-amber-200"
                        }`}
                      >
                        {log.action}
                      </span>
                      <span className="text-slate-800 font-sans font-bold">{log.userName || "System"}</span>
                    </div>

                    <span className="text-[11px] text-slate-500 font-sans font-medium">{log.timestamp}</span>
                  </div>

                  <p className="text-slate-600 text-[11px] font-sans font-medium">
                    Entity: {log.entityType} #{log.entityId}
                  </p>

                  <div className="p-2.5 rounded-xl bg-white border border-slate-200 text-[11px] text-slate-700 overflow-x-auto shadow-2xs">
                    <pre className="whitespace-pre-wrap">{JSON.stringify(parsedDetail, null, 2)}</pre>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
