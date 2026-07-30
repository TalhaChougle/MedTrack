"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { Search, Globe, ShieldAlert, Boxes, AlertTriangle } from "lucide-react";

export default function FdaReferencePage() {
  const { data: session } = useSession();
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState("");

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setErrorMsg("");
    setResults(null);

    try {
      const res = await fetch(`/api/medicines/reference-search?q=${encodeURIComponent(query.trim())}`);
      const data = await res.json();
      setResults(data);
    } catch (err: any) {
      setErrorMsg("Failed to connect to reference search.");
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
            <Globe className="w-8 h-8 text-teal-600" />
            <span>openFDA Medicine Reference Search</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 font-medium">
            Query openFDA drug label database for generic composition & warnings while cross-checking against shop stock.
          </p>
        </div>
      </div>

      {/* Search Bar */}
      <form onSubmit={handleSearch} className="flex gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
          <input
            type="text"
            required
            placeholder="Search generic composition e.g. Paracetamol, Ibuprofen, Amoxicillin..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-white border border-slate-200 rounded-2xl pl-10 pr-4 py-3 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-teal-600 font-medium shadow-xs"
          />
        </div>
        <button
          type="submit"
          disabled={loading || !query.trim()}
          className="px-6 py-3 rounded-2xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs sm:text-sm flex items-center gap-2 shadow-md disabled:opacity-50 cursor-pointer"
        >
          <Search className="w-4 h-4" />
          <span>Lookup</span>
        </button>
      </form>

      {errorMsg && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Results View */}
      {loading ? (
        <p className="text-center py-12 text-slate-500 text-xs font-bold">
          Querying openFDA API & local stock records...
        </p>
      ) : results ? (
        <div className="space-y-6">
          {/* Local Stock Cross-Check Banner */}
          <div className="p-5 rounded-3xl bg-white border border-slate-200 space-y-3 shadow-xs">
            <h3 className="text-sm font-extrabold text-[#1E3A5F] flex items-center gap-2">
              <Boxes className="w-4 h-4 text-teal-600" />
              <span>Local Shop Availability Cross-Check</span>
            </h3>

            {results.localMatch.length === 0 ? (
              <p className="text-xs text-slate-500 italic">No matching medicine found in your shop inventory.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {results.localMatch.map((lm: any) => (
                  <div key={lm.id} className="p-3 rounded-2xl bg-slate-50 border border-slate-200 text-xs">
                    <p className="font-extrabold text-[#1E3A5F]">{lm.name}</p>
                    <p className="text-slate-500 text-[11px] font-medium">
                      Manufacturer: {lm.manufacturer} • Total Stock:{" "}
                      <span className="font-extrabold text-teal-700">{lm.totalStock} units</span>
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* openFDA Results List */}
          <div className="space-y-4">
            <h3 className="text-base font-extrabold text-[#1E3A5F] flex items-center gap-2">
              <Globe className="w-5 h-5 text-teal-600" />
              <span>openFDA Public Drug Labels ({results.fdaResults.length})</span>
            </h3>

            {results.fdaResults.length === 0 ? (
              <div className="p-8 rounded-3xl bg-white border border-slate-200 text-center text-xs text-slate-500 font-medium">
                No openFDA records returned for '{query}'.
              </div>
            ) : (
              results.fdaResults.map((item: any, idx: number) => (
                <div key={idx} className="p-6 rounded-3xl bg-white border border-slate-200 space-y-4 shadow-xs text-xs">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="px-2.5 py-0.5 rounded text-[10px] font-extrabold bg-teal-50 text-teal-800 border border-teal-200">
                        Generic Composition
                      </span>
                      <h4 className="text-lg font-black text-[#1E3A5F] mt-1">{item.genericName}</h4>
                      <p className="text-slate-500 font-medium">Brand Name: {item.brandName}</p>
                    </div>
                  </div>

                  <div className="space-y-2 text-slate-700 font-medium">
                    <p>
                      <strong className="text-slate-500">Active Ingredient: </strong>
                      {item.activeIngredient}
                    </p>
                    <p>
                      <strong className="text-slate-500">Purpose / Indications: </strong>
                      {item.purpose}
                    </p>
                  </div>

                  {item.warnings !== "N/A" && (
                    <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 space-y-1">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-800 flex items-center gap-1">
                        <ShieldAlert className="w-3.5 h-3.5" />
                        Drug Warnings & Precautions
                      </span>
                      <p className="text-xs leading-relaxed font-medium">{item.warnings}</p>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
