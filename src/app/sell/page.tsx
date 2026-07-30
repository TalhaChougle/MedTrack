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
  const [loading, setLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);

  const [errorMsg, setErrorMsg] = useState("");
  const [saleResult, setSaleResult] = useState<any>(null);

  const [scannerOpen, setScannerOpen] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  // Search medicines
  useEffect(() => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const res = await fetch(`/api/medicines/search?q=${encodeURIComponent(query.trim())}`);
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data);
        }
      } catch (err) {
        console.error("Search error:", err);
      } finally {
        setSearchLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  // Select medicine and load its batches for FEFO preview
  const handleSelectMedicine = async (med: any) => {
    setSelectedMed(med);
    setErrorMsg("");
    setSaleResult(null);

    try {
      const res = await fetch(`/api/batches`);
      if (res.ok) {
        const allBatches = await res.json();
        const filtered = allBatches.filter(
          (b: any) => b.medicineId === med.id && b.quantity > 0
        );
        setMedBatches(filtered);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Calculate FEFO Preview allocation
  const calculateFEFOPreview = () => {
    const reqQty = parseInt(quantity) || 0;
    if (reqQty <= 0 || medBatches.length === 0) return [];

    let remaining = reqQty;
    const allocation: Array<{
      batchNumber: string;
      expiryDate: string;
      supplier: string;
      currentQty: number;
      takeQty: number;
    }> = [];

    for (const b of medBatches) {
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

    return allocation;
  };

  const previewAllocation = calculateFEFOPreview();

  // Execute FEFO Dispense
  const handleExecuteDispense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMed) return;

    const reqQty = parseInt(quantity);
    if (isNaN(reqQty) || reqQty <= 0) {
      setErrorMsg("Please enter a valid positive quantity.");
      return;
    }

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
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data.error || "Dispense transaction failed.");
      } else {
        setSaleResult(data);
        handleSelectMedicine(selectedMed);
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
              <p className="text-xs text-slate-500 text-center py-4 font-medium">Searching inventory...</p>
            ) : searchResults.length > 0 ? (
              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                {searchResults.map((med) => (
                  <button
                    key={med.id}
                    onClick={() => handleSelectMedicine(med)}
                    className={`w-full text-left p-3 rounded-2xl border text-xs transition-all flex items-center justify-between cursor-pointer ${
                      selectedMed?.id === med.id
                        ? "bg-teal-50 border-teal-300 text-slate-800"
                        : "bg-white border-slate-200 text-slate-700 hover:border-slate-300"
                    }`}
                  >
                    <div>
                      <p className="font-extrabold text-[#1E3A5F] text-sm">{med.name}</p>
                      <p className="text-slate-500 font-medium">
                        {med.manufacturer} • Schedule {med.schedule}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="font-extrabold text-teal-700 text-sm">{med.totalStock}</span>
                      <span className="block text-[10px] text-slate-500 font-bold">In Stock</span>
                    </div>
                  </button>
                ))}
              </div>
            ) : query.trim() ? (
              <p className="text-xs text-slate-500 text-center py-4 font-medium">No matching medicine found.</p>
            ) : null}
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
                  <span className="text-[10px] uppercase tracking-widest px-2 py-0.5 rounded bg-teal-50 text-teal-800 font-bold border border-teal-200">
                    Schedule {selectedMed.schedule}
                  </span>
                  <h3 className="text-xl font-black text-[#1E3A5F] mt-1">{selectedMed.name}</h3>
                  <p className="text-xs text-slate-500 font-medium">
                    Manufacturer: {selectedMed.manufacturer} • Unit Price: ₹{selectedMed.unitPrice}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-3xl font-extrabold text-teal-700">{selectedMed.totalStock}</span>
                  <span className="block text-[10px] text-slate-500 uppercase tracking-wider font-bold">Total Units</span>
                </div>
              </div>

              {/* Dispense Form */}
              <form onSubmit={handleExecuteDispense} className="space-y-6">
                <div>
                  <label className="block text-xs font-bold text-[#1E3A5F] uppercase tracking-wider mb-2">
                    Requested Quantity to Dispense
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      min="1"
                      max={selectedMed.totalStock}
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                      required
                      className="w-36 bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-lg font-bold text-slate-800 text-center focus:outline-none focus:border-teal-600"
                    />
                    <div className="text-xs text-slate-600 font-medium">
                      <p className="font-bold text-[#1E3A5F]">
                        Total Amount: ₹{(parseInt(quantity) || 0) * selectedMed.unitPrice}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        Calculated at ₹{selectedMed.unitPrice}/unit
                      </p>
                    </div>
                  </div>
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

                  {previewAllocation.length === 0 ? (
                    <p className="text-xs text-rose-600 italic font-semibold">No active batches available for this medicine.</p>
                  ) : (
                    <div className="space-y-2">
                      {previewAllocation.map((item, idx) => (
                        <div
                          key={idx}
                          className="p-3 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs"
                        >
                          <div className="flex items-center gap-3">
                            <span className="w-6 h-6 rounded-full bg-teal-100 text-teal-800 flex items-center justify-center font-extrabold text-[11px]">
                              #{idx + 1}
                            </span>
                            <div>
                              <p className="font-mono font-bold text-slate-800">{item.batchNumber}</p>
                              <p className="text-slate-500 text-[11px] font-medium">
                                Expiry: <span className="text-amber-700 font-bold">{item.expiryDate}</span> •{" "}
                                {item.supplier}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="font-bold text-teal-700 text-sm">-{item.takeQty} units</span>
                            <span className="block text-[10px] text-slate-500">
                              (Batch has {item.currentQty} left)
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

          {/* Sale Receipt Summary Modal / Card */}
          {saleResult && (
            <div className="bg-white border border-teal-300 rounded-3xl p-6 space-y-4 shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <div className="flex items-center gap-2 text-teal-700">
                  <CheckCircle2 className="w-5 h-5" />
                  <h3 className="text-base font-extrabold text-[#1E3A5F]">Dispense Transaction Successful</h3>
                </div>
                <span className="text-xs text-slate-500 font-medium">{new Date().toLocaleTimeString()}</span>
              </div>

              <div className="space-y-2 text-xs font-medium">
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Medicine:</span>
                  <span className="font-bold text-slate-800">{saleResult.medicineName}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Total Quantity Sold:</span>
                  <span className="font-bold text-slate-800">{saleResult.requestedQuantity} units</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Total Bill Amount:</span>
                  <span className="font-extrabold text-teal-700 text-sm">₹{saleResult.totalPrice}</span>
                </div>
              </div>

              <div className="space-y-2 pt-2">
                <p className="text-[11px] font-bold text-[#1E3A5F] uppercase tracking-wider">
                  Batches Deducted (FEFO Order):
                </p>
                <div className="space-y-1">
                  {saleResult.deductions?.map((d: any, i: number) => (
                    <div
                      key={i}
                      className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex justify-between text-xs font-mono"
                    >
                      <span className="text-slate-700">
                        {d.batchNumber} (Exp: {d.expiryDate})
                      </span>
                      <span className="text-teal-700 font-bold">
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
