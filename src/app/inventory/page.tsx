"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  Boxes,
  PlusCircle,
  Search,
  Pill,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  X,
} from "lucide-react";

export default function InventoryPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [medicinesList, setMedicinesList] = useState<any[]>([]);
  const [batchesList, setBatchesList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [scheduleFilter, setScheduleFilter] = useState("ALL");

  const [expandedMedId, setExpandedMedId] = useState<number | null>(null);

  // Add Medicine Modal State
  const [addMedOpen, setAddMedOpen] = useState(false);
  const [newMedData, setNewMedData] = useState({
    name: "",
    manufacturer: "",
    barcode: "",
    schedule: "OTC",
    unitPrice: "",
    reorderThreshold: "10",
  });

  // Add Batch Modal State
  const [addBatchOpen, setAddBatchOpen] = useState(false);
  const [selectedMedForBatch, setSelectedMedForBatch] = useState<any>(null);
  const [newBatchData, setNewBatchData] = useState({
    batchNumber: "",
    quantity: "",
    expiryDate: "",
    supplier: "",
    costPrice: "",
  });

  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    } else if (status === "authenticated") {
      fetchInventoryData();
    }
  }, [status, router]);

  const fetchInventoryData = async () => {
    setLoading(true);
    try {
      const [medRes, batchRes] = await Promise.all([
        fetch("/api/medicines"),
        fetch("/api/batches"),
      ]);

      if (medRes.ok) setMedicinesList(await medRes.json());
      if (batchRes.ok) setBatchesList(await batchRes.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // Submit Add Medicine
  const handleAddMedicine = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      const res = await fetch("/api/medicines", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newMedData),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data.error || "Failed to add medicine.");
      } else {
        setSuccessMsg(`Medicine '${data.name}' added successfully!`);
        setAddMedOpen(false);
        setNewMedData({
          name: "",
          manufacturer: "",
          barcode: "",
          schedule: "OTC",
          unitPrice: "",
          reorderThreshold: "10",
        });
        fetchInventoryData();
      }
    } catch (err: any) {
      setErrorMsg("Network error adding medicine.");
    } finally {
      setActionLoading(false);
    }
  };

  // Submit Add Batch
  const handleAddBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMedForBatch) return;

    setActionLoading(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      const res = await fetch("/api/batches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          medicineId: selectedMedForBatch.id,
          ...newBatchData,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data.error || "Failed to add batch.");
      } else {
        setSuccessMsg(`Batch '${data.batchNumber}' added for ${selectedMedForBatch.name}!`);
        setAddBatchOpen(false);
        setNewBatchData({
          batchNumber: "",
          quantity: "",
          expiryDate: "",
          supplier: "",
          costPrice: "",
        });
        fetchInventoryData();
      }
    } catch (err: any) {
      setErrorMsg("Network error adding batch.");
    } finally {
      setActionLoading(false);
    }
  };

  // Filtered medicines
  const filteredMeds = medicinesList.filter((m) => {
    const matchesSearch =
      m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.manufacturer.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (m.barcode && m.barcode.includes(searchQuery));

    const matchesSchedule =
      scheduleFilter === "ALL" || m.schedule === scheduleFilter;

    return matchesSearch && matchesSchedule;
  });

  return (
    <div className="space-y-8 pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#1E3A5F] tracking-tight flex items-center gap-3">
            <Boxes className="w-8 h-8 text-teal-600" />
            <span>Medicine Catalog & Batches</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 font-medium">
            Manage your pharmacy inventory, barcoded items, and batch expiry tracking.
          </p>
        </div>

        <button
          onClick={() => {
            setErrorMsg("");
            setSuccessMsg("");
            setAddMedOpen(true);
          }}
          className="px-4 py-2.5 rounded-2xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer"
        >
          <PlusCircle className="w-4 h-4" />
          <span>Register New Medicine</span>
        </button>
      </div>

      {/* Notifications */}
      {errorMsg && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-4 rounded-2xl bg-teal-50 border border-teal-200 text-teal-800 text-xs font-semibold flex items-start gap-2">
          <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Search by medicine name, barcode, or manufacturer..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white border border-slate-200 rounded-2xl pl-10 pr-4 py-2.5 text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-teal-600 font-medium shadow-xs"
          />
        </div>

        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl border border-slate-200 shrink-0">
          {["ALL", "OTC", "H", "H1", "X"].map((sch) => (
            <button
              key={sch}
              onClick={() => setScheduleFilter(sch)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                scheduleFilter === sch
                  ? "bg-[#1E3A5F] text-white shadow-2xs"
                  : "text-slate-600 hover:bg-slate-200"
              }`}
            >
              {sch === "ALL" ? "All Schedules" : `Schedule ${sch}`}
            </button>
          ))}
        </div>
      </div>

      {/* Inventory List */}
      {loading ? (
        <p className="text-center py-10 text-slate-500 text-xs font-bold">Loading catalog...</p>
      ) : filteredMeds.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center space-y-3 shadow-xs">
          <Pill className="w-10 h-10 text-slate-400 mx-auto" />
          <h3 className="text-base font-extrabold text-[#1E3A5F]">No Medicines Found</h3>
          <p className="text-xs text-slate-500 font-medium">
            {searchQuery ? "Try clearing your search query." : "Register your first medicine to get started."}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredMeds.map((med) => {
            const isExpanded = expandedMedId === med.id;
            const medBatches = batchesList.filter((b) => b.medicineId === med.id);
            const isLowStock = med.totalStock < med.reorderThreshold;

            return (
              <div
                key={med.id}
                className={`bg-white border rounded-3xl overflow-hidden transition-all ${
                  isExpanded ? "border-teal-500 shadow-md" : "border-slate-200 hover:border-slate-300"
                }`}
              >
                {/* Row Header */}
                <div
                  onClick={() => setExpandedMedId(isExpanded ? null : med.id)}
                  className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer select-none"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-slate-100 text-[#1E3A5F] shrink-0">
                      {isExpanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-extrabold text-[#1E3A5F]">{med.name}</h3>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-extrabold ${
                            med.schedule === "OTC"
                              ? "bg-teal-50 text-teal-800 border border-teal-200"
                              : med.schedule === "H" || med.schedule === "H1"
                              ? "bg-amber-50 text-amber-800 border border-amber-200"
                              : "bg-rose-50 text-rose-800 border border-rose-200"
                          }`}
                        >
                          Schedule {med.schedule}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 font-medium">
                        {med.manufacturer} • Barcode: {med.barcode || "N/A"} • Price: ₹{med.unitPrice}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-4 text-right">
                    <div>
                      <div className="flex items-center gap-1.5 justify-end">
                        <span className={`text-xl font-black ${isLowStock ? "text-amber-600" : "text-teal-700"}`}>
                          {med.totalStock}
                        </span>
                        <span className="text-xs text-slate-500 font-bold">Units</span>
                      </div>
                      <span className="text-[10px] text-slate-500 block font-semibold">
                        {medBatches.length} Active Batches
                      </span>
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedMedForBatch(med);
                        setErrorMsg("");
                        setAddBatchOpen(true);
                      }}
                      className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-teal-800 text-xs font-bold border border-slate-200 flex items-center gap-1 cursor-pointer"
                    >
                      <PlusCircle className="w-3.5 h-3.5 text-teal-600" />
                      <span>Add Batch</span>
                    </button>
                  </div>
                </div>

                {/* Expanded Batches Drawer */}
                {isExpanded && (
                  <div className="bg-slate-50 p-5 border-t border-slate-200 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-extrabold text-[#1E3A5F] uppercase tracking-wider">
                        Active Batches for {med.name}
                      </h4>
                      <span className="text-[11px] text-slate-500 font-medium">Sorted by Expiry ASC</span>
                    </div>

                    {medBatches.length === 0 ? (
                      <p className="text-xs text-slate-500 italic py-2">No active batches logged for this medicine yet.</p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {medBatches.map((b) => (
                          <div
                            key={b.id}
                            className="p-3.5 rounded-2xl bg-white border border-slate-200 space-y-1.5 text-xs shadow-2xs"
                          >
                            <div className="flex items-center justify-between font-mono">
                              <span className="font-bold text-[#1E3A5F]">{b.batchNumber}</span>
                              <span className="font-bold text-slate-800">{b.quantity} Units</span>
                            </div>
                            <div className="text-slate-600 space-y-0.5 text-[11px] font-medium">
                              <p>
                                Expiry: <span className="text-amber-700 font-bold">{b.expiryDate}</span>
                              </p>
                              <p>Supplier: {b.supplier}</p>
                              <p>Cost Price: ₹{b.costPrice}/unit</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: Add New Medicine */}
      {addMedOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-md p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-lg font-extrabold text-[#1E3A5F]">Register New Medicine</h3>
              <button onClick={() => setAddMedOpen(false)} className="text-slate-400 hover:text-slate-700 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddMedicine} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 font-bold mb-1">Medicine Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Paracetamol 500mg"
                  value={newMedData.name}
                  onChange={(e) => setNewMedData({ ...newMedData, name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-800 focus:border-teal-600 font-medium"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Manufacturer *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Cipla Ltd"
                  value={newMedData.manufacturer}
                  onChange={(e) => setNewMedData({ ...newMedData, manufacturer: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-800 focus:border-teal-600 font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Barcode (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. 8901234567890"
                    value={newMedData.barcode}
                    onChange={(e) => setNewMedData({ ...newMedData, barcode: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:border-teal-600 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Drug Schedule</label>
                  <select
                    value={newMedData.schedule}
                    onChange={(e) => setNewMedData({ ...newMedData, schedule: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:border-teal-600 font-semibold"
                  >
                    <option value="OTC">OTC (Over The Counter)</option>
                    <option value="H">Schedule H</option>
                    <option value="H1">Schedule H1</option>
                    <option value="X">Schedule X</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Unit Selling Price (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="e.g. 15.00"
                    value={newMedData.unitPrice}
                    onChange={(e) => setNewMedData({ ...newMedData, unitPrice: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:border-teal-600 font-medium"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Reorder Threshold</label>
                  <input
                    type="number"
                    placeholder="e.g. 10"
                    value={newMedData.reorderThreshold}
                    onChange={(e) => setNewMedData({ ...newMedData, reorderThreshold: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:border-teal-600 font-medium"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={actionLoading}
                className="w-full py-3 rounded-xl bg-teal-600 hover:bg-teal-700 font-bold text-white text-xs shadow-md transition-all cursor-pointer"
              >
                Save Medicine
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add Batch */}
      {addBatchOpen && selectedMedForBatch && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-md p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h3 className="text-base font-extrabold text-[#1E3A5F]">Add Stock Batch</h3>
                <p className="text-xs text-teal-700 font-extrabold">{selectedMedForBatch.name}</p>
              </div>
              <button onClick={() => setAddBatchOpen(false)} className="text-slate-400 hover:text-slate-700 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddBatch} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Batch Number *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. BATCH-001"
                    value={newBatchData.batchNumber}
                    onChange={(e) => setNewBatchData({ ...newBatchData, batchNumber: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 font-mono focus:border-teal-600"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Quantity Received *</label>
                  <input
                    type="number"
                    required
                    min="1"
                    placeholder="e.g. 50"
                    value={newBatchData.quantity}
                    onChange={(e) => setNewBatchData({ ...newBatchData, quantity: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:border-teal-600 font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Expiry Date (YYYY-MM-DD) *</label>
                  <input
                    type="date"
                    required
                    value={newBatchData.expiryDate}
                    onChange={(e) => setNewBatchData({ ...newBatchData, expiryDate: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:border-teal-600 font-medium"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Supplier *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Cipla Distributor"
                    value={newBatchData.supplier}
                    onChange={(e) => setNewBatchData({ ...newBatchData, supplier: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:border-teal-600 font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Cost Price Per Unit (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="e.g. 10.50"
                  value={newBatchData.costPrice}
                  onChange={(e) => setNewBatchData({ ...newBatchData, costPrice: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-800 focus:border-teal-600 font-medium"
                />
              </div>

              <button
                type="submit"
                disabled={actionLoading}
                className="w-full py-3 rounded-xl bg-teal-600 hover:bg-teal-700 font-bold text-white text-xs shadow-md cursor-pointer"
              >
                Confirm Batch Addition
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
