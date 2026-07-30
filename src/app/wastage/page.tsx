"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Trash2, CheckCircle2 } from "lucide-react";

export default function WastageLogPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [wastageList, setWastageList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    } else if (status === "authenticated") {
      fetchWastageLogs();
    }
  }, [status, router]);

  const fetchWastageLogs = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/wastage");
      if (res.ok) {
        setWastageList(await res.json());
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#1E3A5F] tracking-tight flex items-center gap-3">
            <Trash2 className="w-8 h-8 text-rose-600" />
            <span>Stock Wastage & Write-Off Log</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 font-medium">
            Audit-safe record of all expired, damaged, contaminated, or recalled medicine write-offs.
          </p>
        </div>
      </div>

      {/* Wastage Logs List */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 space-y-4 shadow-xs">
        {loading ? (
          <p className="text-xs text-slate-500 text-center py-8 font-bold">Loading wastage logs...</p>
        ) : wastageList.length === 0 ? (
          <div className="py-12 text-center space-y-2">
            <CheckCircle2 className="w-10 h-10 text-teal-600 mx-auto" />
            <p className="text-sm font-bold text-[#1E3A5F]">No Wastage Logged!</p>
            <p className="text-xs text-slate-500">Zero stock write-offs recorded in your pharmacy history.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {wastageList.map((log) => (
              <div
                key={log.id}
                className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-[#1E3A5F] text-sm">{log.medicineName}</span>
                    <span className="px-2 py-0.5 rounded font-mono text-[10px] font-bold bg-slate-200 text-slate-700">
                      Batch: {log.batchNumber}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-rose-100 text-rose-800 border border-rose-200 uppercase">
                      {log.reason}
                    </span>
                  </div>
                  <p className="text-slate-500 font-medium">
                    Logged by <span className="text-slate-800 font-bold">{log.performedByName || "User"}</span> •{" "}
                    {log.date}
                  </p>
                </div>

                <div className="text-right shrink-0">
                  <span className="text-lg font-black text-rose-600">-{log.quantity} Units</span>
                  <span className="block text-[10px] text-slate-500 font-bold">Written Off</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
