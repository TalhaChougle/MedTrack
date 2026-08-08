"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  ShoppingCart,
  Search,
  QrCode,
  AlertTriangle,
  CheckCircle2,
  Pill,
  Sparkles,
} from "lucide-react";
import BarcodeScannerModal from "@/components/BarcodeScannerModal";

export default function SellFEFOPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedMed, setSelectedMed] = useState<any>(null);
  const [medBatches, setMedBatches] = useState<any[]>([]);
  const [quantity, setQuantity] = useState("1");
  const [customUnitPrice, setCustomUnitPrice] = useState("");
  const [loading, setLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);

  const [errorMsg, setErrorMsg] = useState("");
  const [saleResult, setSaleResult] = useState<any>(null);

  const [scannerOpen, setScannerOpen] = useState(false);

  const [allMedicines, setAllMedicines] = useState<any[]>([]);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    } else if (status === "authenticated") {
      fetchAllMedicines();
    }
  }, [status, router]);

  useEffect(() => {
    const handleRefresh = () => {
      fetchAllMedicines();
    };
    window.addEventListener("medtrack:refresh", handleRefresh);
    return () => {
      window.removeEventListener("medtrack:refresh", handleRefresh);
    };
  }, []);

  const fetchAllMedicines = async () => {
    setSearchLoading(true);
    try {
      const res = await fetch("/api/medicines");
      if (res.ok) {
        const data = await res.json();
        setAllMedicines(data);
        setSearchResults(data);
      }
    } catch (err) {
      console.error("Fetch all medicines error:", err);
    } finally {
      setSearchLoading(false);
    }
  };

  // Search/Filter medicines
  useEffect(() => {
    if (!query.trim()) {
      setSearchResults(allMedicines);
      return;
    }

    const filtered = allMedicines.filter((m) =>
      m.name.toLowerCase().includes(query.toLowerCase()) ||
      m.manufacturer?.toLowerCase().includes(query.toLowerCase()) ||
      (m.barcode && m.barcode.includes(query))
    );
    setSearchResults(filtered);
  }, [query, allMedicines]);

  // Select medicine and load its batches for FEFO preview
  const handleSelectMedicine = async (med: any) => {
    setSelectedMed(med);
    setErrorMsg("");
    setSaleResult(null);

    // Initial unit price from medicine or zero fallback
    const initialPrice = med.unitPrice > 0 ? med.unitPrice.toString() : "";
    setCustomUnitPrice(initialPrice);

    try {
      const res = await fetch(`/api/batches`);
      if (res.ok) {
        const allBatches = await res.json();
        const filtered = allBatches.filter(
          (b: any) => b.medicineId === med.id && b.quantity > 0
        );
        setMedBatches(filtered);

        // If med.unitPrice was 0, fallback to batch cost price if available
        if ((!med.unitPrice || med.unitPrice === 0) && filtered.length > 0) {
          const fallbackBatchPrice = filtered[0].costPrice || 0;
          if (fallbackBatchPrice > 0) {
            setCustomUnitPrice(fallbackBatchPrice.toString());
          }
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Calculate FEFO Preview allocation (Excludes Expired Batches)
  const calculateFEFOPreview = () => {
    const reqQty = parseInt(quantity) || 0;
    const todayStr = new Date().toISOString().split("T")[0];

    const validBatches = medBatches.filter((b) => b.expiryDate >= todayStr && b.quantity > 0);
    const expiredBatches = medBatches.filter((b) => b.expiryDate < todayStr && b.quantity > 0);

    if (reqQty <= 0 || validBatches.length === 0) {
      return { allocation: [], expiredBatches, validBatches };
    }

    let remaining = reqQty;
    const allocation: Array<{
      batchNumber: string;
      expiryDate: string;
      supplier: string;
      currentQty: number;
      takeQty: number;
    }> = [];

    for (const b of validBatches) {
      if (remaining <= 0) break;
      const take = Math.min(b.quantity, remaining);
      allocation.push({
        batchNumber: b.batchNumber,
        expiryDate: b.expiryDate,
        supplier: b.supplier,
        currentQty: b.quantity,
        takeQty: take,
      });
      remaining -= take;
    }

    return { allocation, expiredBatches, validBatches };
  };

  const fefoData = calculateFEFOPreview();
  const previewAllocation = fefoData.allocation;
  const expiredBatchesInStock = fefoData.expiredBatches;

  // Execute FEFO Dispense
  const handleExecuteDispense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMed) return;

    const reqQty = parseInt(quantity);
    if (isNaN(reqQty) || reqQty <= 0) {
      setErrorMsg("Please enter a valid positive quantity.");
      return;
    }

    const priceToSubmit = parseFloat(customUnitPrice) || 0;

    setLoading(true);
    setErrorMsg("");
    setSaleResult(null);

    try {
      const res = await fetch("/api/sell", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          medicineId: selectedMed.id,
          quantity: reqQty,
          unitPrice: priceToSubmit,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data.error || "Dispense transaction failed.");
      } else {
        setSaleResult(data);

        // Global refresh event for dashboard/nav/inventory
        if (typeof window !== "undefined") {
          window.dispatchEvent(new Event("medtrack:refresh"));
        }

        // Refresh all medicines list and updated batches
        const [medRes, batchRes] = await Promise.all([
          fetch("/api/medicines"),
          fetch("/api/batches"),
        ]);

        if (medRes.ok) {
          const freshMeds = await medRes.json();
          setAllMedicines(freshMeds);
          const updatedMed = freshMeds.find((m: any) => m.id === selectedMed.id);
          if (updatedMed) {
            setSelectedMed(updatedMed);
          }
        }

        if (batchRes.ok) {
          const allBatches = await batchRes.json();
          const filtered = allBatches.filter(
            (b: any) => b.medicineId === selectedMed.id && b.quantity > 0
          );
          setMedBatches(filtered);
        }
      }
    } catch (err: any) {
      setErrorMsg("Network error processing dispense.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-teal-50 text-teal-800 border border-teal-200">
              FEFO Dispense Algorithm
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#1E3A5F] tracking-tight mt-1 flex items-center gap-3">
            <ShoppingCart className="w-8 h-8 text-teal-600" />
            <span>Point of Sale Counter</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 font-medium">
            System automatically deducts stock from nearest-expiry batch to eliminate financial loss.
          </p>
        </div>

        <button
          onClick={() => setScannerOpen(true)}
          className="px-4 py-2.5 rounded-2xl bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs"
        >
          <QrCode className="w-4 h-4 text-teal-600" />
          <span>Scan Barcode</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Search & Select Medicine */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white border border-slate-200 rounded-3xl p-5 space-y-4 shadow-xs">
            <label className="block text-xs font-bold text-[#1E3A5F] uppercase tracking-wider">
              1. Search Medicine by Name or Barcode
            </label>

            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
              <input
                type="text"
                placeholder="Search e.g. Paracetamol, Cipla..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-10 pr-4 py-3 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-teal-600 font-medium"
              />
            </div>

            {/* Results List */}
            {searchLoading ? (
              <p className="text-xs text-slate-500 text-center py-4 font-medium">Loading inventory medicines...</p>
            ) : searchResults.length > 0 ? (
              <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                <div className="flex items-center justify-between px-1 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  <span>{query.trim() ? "Search Results" : "All Inventory Medicines"}</span>
                  <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{searchResults.length}</span>
                </div>
                {searchResults.map((med) => (
                  <button
                    key={med.id}
                    onClick={() => handleSelectMedicine(med)}
                    className={`w-full text-left p-3 rounded-2xl border text-xs transition-all flex items-center justify-between cursor-pointer ${
                      selectedMed?.id === med.id
                        ? "bg-teal-50 border-teal-300 text-slate-800 shadow-xs"
                        : "bg-white border-slate-200 text-slate-700 hover:border-slate-300"
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5">
                        <p className="font-extrabold text-[#1E3A5F] text-sm">{med.name}</p>
                        {med.barcode ? (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-teal-100 text-teal-800 border border-teal-200">
                            ⚡ Barcoded
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                            ✍️ Manual
                          </span>
                        )}
                      </div>
                      <p className="text-slate-500 font-medium">
                        {med.manufacturer} • Schedule {med.schedule} {med.unitPrice ? `• ₹${med.unitPrice}` : ""}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className={`font-extrabold text-sm ${med.totalStock > 0 ? "text-teal-700" : "text-rose-500"}`}>
                        {med.totalStock}
                      </span>
                      <span className="block text-[10px] text-slate-500 font-bold">In Stock</span>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500 text-center py-4 font-medium">No matching medicines found in inventory.</p>
            )}
          </div>
        </div>

        {/* Right Column: FEFO Preview & Dispense Form */}
        <div className="lg:col-span-7 space-y-6">
          {!selectedMed ? (
            <div className="bg-white border border-dashed border-slate-300 rounded-3xl p-12 text-center space-y-3 shadow-xs">
              <Pill className="w-12 h-12 text-slate-400 mx-auto" />
              <h3 className="text-base font-extrabold text-[#1E3A5F]">No Medicine Selected</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto font-medium">
                Search and select a medicine from the left panel to preview automatic FEFO batch allocation before selling.
              </p>
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-3xl p-6 space-y-6 shadow-md">
              {/* Selected Medicine Info Card */}
              <div className="flex items-center justify-between border-b border-slate-200 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] uppercase tracking-widest px-2 py-0.5 rounded bg-teal-50 text-teal-800 font-bold border border-teal-200">
                      Schedule {selectedMed.schedule}
                    </span>
                    {selectedMed.barcode ? (
                      <span className="text-[10px] px-2 py-0.5 rounded bg-teal-100 text-teal-900 font-extrabold border border-teal-200">
                        ⚡ Barcoded
                      </span>
                    ) : (
                      <span className="text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-extrabold border border-slate-200">
                        ✍️ Non-Barcoded (Manual)
                      </span>
                    )}
                  </div>
                  <h3 className="text-xl font-black text-[#1E3A5F] mt-1">{selectedMed.name}</h3>
                  <p className="text-xs text-slate-500 font-medium">
                    Manufacturer: {selectedMed.manufacturer} • Barcode: {selectedMed.barcode || "None"}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-3xl font-extrabold text-teal-700">{selectedMed.totalStock}</span>
                  <span className="block text-[10px] text-slate-500 uppercase tracking-wider font-bold">Total Units</span>
                </div>
              </div>

              {/* Dispense Form */}
              <form onSubmit={handleExecuteDispense} className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-[#1E3A5F] uppercase tracking-wider mb-1.5">
                      1. Quantity to Dispense *
                    </label>
                    <input
                      type="number"
                      min="1"
                      max={selectedMed.totalStock}
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                      required
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-lg font-bold text-slate-800 text-center focus:outline-none focus:border-teal-600 shadow-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#1E3A5F] uppercase tracking-wider mb-1.5">
                      2. Selling Price Per Unit (₹) *
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={customUnitPrice}
                        onChange={(e) => setCustomUnitPrice(e.target.value)}
                        placeholder="e.g. 25.00"
                        required
                        className="w-full bg-teal-50/50 border border-teal-300 rounded-2xl px-4 py-3 text-lg font-bold text-teal-800 text-center focus:outline-none focus:border-teal-600 shadow-xs"
                      />
                    </div>
                  </div>
                </div>

                {/* Total Bill Calculation Summary Card */}
                <div className="p-4 rounded-2xl bg-teal-50 border border-teal-200 flex items-center justify-between shadow-xs">
                  <div>
                    <span className="text-xs text-teal-900 font-extrabold block uppercase tracking-wider">Total Sale Bill Amount</span>
                    <span className="text-[11px] text-slate-600 font-medium">
                      Calculated at ₹{parseFloat(customUnitPrice) || 0}/unit × {parseInt(quantity) || 0} units
                    </span>
                  </div>
                  <span className="text-2xl font-black text-teal-700 font-mono">
                    ₹{((parseInt(quantity) || 0) * (parseFloat(customUnitPrice) || 0)).toFixed(2)}
                  </span>
                </div>

                {/* FEFO Batch Allocation Live Preview */}
                <div className="space-y-3 pt-2 border-t border-slate-200">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-teal-700 uppercase tracking-wider flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-teal-600" />
                      <span>Automatic FEFO Batch Allocation Preview</span>
                    </h4>
                    <span className="text-[11px] text-slate-500 font-medium">Sorted by Expiry ASC</span>
                  </div>

                  {/* Expired Stock Warning Banner if expired batches present */}
                  {expiredBatchesInStock.length > 0 && (
                    <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs space-y-2">
                      <div className="flex items-center justify-between font-extrabold">
                        <span className="flex items-center gap-1.5 text-rose-700">
                          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                          <span>{expiredBatchesInStock.length} Expired Batch(es) Detected & Blocked</span>
                        </span>
                        <span className="px-2 py-0.5 rounded bg-rose-200 text-rose-900 text-[10px] uppercase font-black">
                          DO NOT DISPENSE
                        </span>
                      </div>
                      <p className="text-[11px] text-rose-700 font-medium">
                        The FEFO algorithm automatically excludes expired stock from sales to safeguard patient health. Log these expired batches under Wastage.
                      </p>
                      <div className="space-y-1">
                        {expiredBatchesInStock.map((b: any) => (
                          <div key={b.id} className="p-2.5 rounded-xl bg-white border border-rose-200 flex items-center justify-between font-mono text-[11px]">
                            <span>Batch: <strong className="text-rose-900">{b.batchNumber}</strong> (Exp: <span className="line-through text-rose-600">{b.expiryDate}</span>)</span>
                            <span className="font-extrabold text-rose-600">🔴 EXPIRED ({b.quantity} units)</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {previewAllocation.length === 0 ? (
                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-center text-xs text-slate-500 font-medium space-y-1">
                      <p className="font-bold text-slate-700">No Valid Unexpired Batches Available</p>
                      <p className="text-[11px]">
                        {expiredBatchesInStock.length > 0
                          ? "All available stock for this medicine is EXPIRED. Please add a fresh batch or log wastage."
                          : "Please stock in a new batch to dispense this medicine."}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {previewAllocation.map((item, idx) => (
                        <div
                          key={idx}
                          className="p-3.5 rounded-2xl bg-emerald-50/60 border border-emerald-200 flex items-center justify-between text-xs shadow-2xs"
                        >
                          <div className="flex items-center gap-3">
                            <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-extrabold text-[11px]">
                              #{idx + 1}
                            </span>
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="font-mono font-bold text-[#1E3A5F]">{item.batchNumber}</p>
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-emerald-200 text-emerald-900 border border-emerald-300">
                                  🟢 VALID UNEXPIRED BATCH
                                </span>
                              </div>
                              <p className="text-slate-600 text-[11px] font-medium mt-0.5">
                                Expiry Date: <strong className="text-emerald-800">{item.expiryDate}</strong> • Supplier: {item.supplier}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="font-extrabold text-emerald-700 text-sm">-{item.takeQty} units</span>
                            <span className="block text-[10px] text-slate-500 font-medium">
                              ({item.currentQty} left in batch)
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Error Notice */}
                {errorMsg && (
                  <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                {/* Submit Action */}
                <button
                  type="submit"
                  disabled={loading || previewAllocation.length === 0}
                  className="w-full py-4 rounded-2xl bg-teal-600 hover:bg-teal-700 text-white font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg transition-all transform active:scale-[0.99] disabled:opacity-50 cursor-pointer"
                >
                  <ShoppingCart className="w-5 h-5 text-teal-200" />
                  <span>Confirm Dispense & Log Sale</span>
                </button>
              </form>
            </div>
          )}

          {/* Sale Receipt Summary Card */}
          {saleResult && (
            <div className="bg-emerald-50/50 border border-emerald-300 rounded-3xl p-6 space-y-4 shadow-xl animate-in fade-in slide-in-from-bottom-3 duration-300">
              <div className="flex items-center justify-between border-b border-emerald-200 pb-3">
                <div className="flex items-center gap-2 text-emerald-800">
                  <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
                  <div>
                    <h3 className="text-base font-extrabold text-[#1E3A5F]">Dispense & Sale Completed!</h3>
                    <p className="text-[11px] text-emerald-700 font-semibold">Stock deducted according to FEFO algorithm</p>
                  </div>
                </div>
                <button
                  onClick={() => setSaleResult(null)}
                  className="px-3 py-1 rounded-xl bg-white hover:bg-slate-100 text-slate-600 text-xs font-bold border border-slate-200 cursor-pointer"
                >
                  Dismiss Receipt
                </button>
              </div>

              <div className="grid grid-cols-3 gap-3 text-xs bg-white p-3.5 rounded-2xl border border-emerald-200/60 font-medium">
                <div>
                  <span className="text-slate-400 text-[10px] block font-bold uppercase">Medicine Name</span>
                  <span className="font-extrabold text-[#1E3A5F] text-sm">{saleResult.medicineName}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] block font-bold uppercase">Total Sold</span>
                  <span className="font-bold text-slate-800 text-sm">{saleResult.requestedQuantity} Units</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] block font-bold uppercase">Total Bill Amount</span>
                  <span className="font-black text-emerald-700 text-base">₹{saleResult.totalPrice}</span>
                </div>
              </div>

              <div className="space-y-2 pt-1">
                <p className="text-[11px] font-bold text-[#1E3A5F] uppercase tracking-wider">
                  Batches Deducted (Nearest Expiry First):
                </p>
                <div className="space-y-1.5">
                  {saleResult.deductions?.map((d: any, i: number) => (
                    <div
                      key={i}
                      className="p-3 rounded-xl bg-white border border-emerald-200 flex items-center justify-between text-xs font-mono shadow-2xs"
                    >
                      <span className="text-slate-700 font-semibold">
                        {d.batchNumber} (Exp: <strong className="text-amber-700">{d.expiryDate}</strong>)
                      </span>
                      <span className="text-emerald-700 font-extrabold">
                        -{d.deductedQuantity} units ({d.newBatchQuantity} remaining)
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {scannerOpen && (
        <BarcodeScannerModal
          mode="check"
          onClose={() => setScannerOpen(false)}
          onSelectMode={() => {}}
        />
      )}
    </div>
  );
}
