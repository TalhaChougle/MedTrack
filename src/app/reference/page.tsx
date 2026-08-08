"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { Search, Globe, ShieldAlert, Boxes, AlertTriangle, X } from "lucide-react";

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
            <span>🇮🇳 CDSCO & National Drug Reference Search</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 font-medium">
            Query CDSCO, Indian Pharmacopoeia (IPC), and openFDA drug label database for generic composition & Schedule H/H1 guidelines while cross-checking shop stock.
          </p>
        </div>
      </div>

      {/* Search Bar */}
      <form onSubmit={handleSearch} className="flex gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
          <input
            type="text"
            placeholder="Search generic composition e.g. Paracetamol, Cefixime, Amoxicillin, Thromboscar..."
            value={query}
            onChange={(e) => {
              const val = e.target.value;
              setQuery(val);
              if (!val.trim()) {
                setResults(null);
                setErrorMsg("");
              }
            }}
            className="w-full bg-white border border-slate-200 rounded-2xl pl-10 pr-10 py-3 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-teal-600 font-medium shadow-xs"
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setResults(null);
                setErrorMsg("");
              }}
              className="absolute right-3.5 top-3.5 text-slate-400 hover:text-slate-600 cursor-pointer p-0.5 rounded-full hover:bg-slate-100"
              title="Clear search"
            >
              <X className="w-4 h-4" />
            </button>
          )}
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
        <div className="py-16 text-center space-y-3">
          <div className="w-10 h-10 rounded-2xl bg-[#1E3A5F] animate-spin mx-auto flex items-center justify-center text-teal-400">
            <Globe className="w-5 h-5" />
          </div>
          <p className="text-xs text-slate-600 font-bold">Querying CDSCO & openFDA official databases and cross-checking shop stock...</p>
        </div>
      ) : results ? (
        <div className="space-y-6">
          {/* CDSCO Indian Regulatory Guidance Card */}
          {results.cdscoInfo && (
            <div className="p-5 rounded-3xl bg-teal-50/80 border border-teal-200/90 space-y-2 text-xs shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-teal-900 bg-white px-2.5 py-1 rounded-full border border-teal-300">
                  🇮🇳 Indian Regulatory Standard (CDSCO / IPC)
                </span>
                <span className="font-extrabold text-[#1E3A5F]">
                  Schedule Classification: <strong className="text-teal-800 font-mono text-sm">Schedule {results.cdscoInfo.schedule}</strong>
                </span>
              </div>
              <div className="space-y-1 pt-1 text-slate-700">
                <p className="font-bold text-[#1E3A5F] text-sm">Formulation Query: {results.query}</p>
                <p className="text-slate-600 text-[11px] font-medium">{results.cdscoInfo.scheduleNotice}</p>
              </div>
            </div>
          )}

          {/* Indian Pharmacopoeia (IP) Clinical Monograph Card */}
          {results.ipMonograph && (
            <div className="p-6 rounded-3xl bg-white border border-slate-200 space-y-4 shadow-xs text-xs">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <span className="px-2.5 py-0.5 rounded text-[10px] font-extrabold bg-teal-100 text-teal-900 border border-teal-200 uppercase tracking-wider">
                    📖 Indian Pharmacopoeia (IP) Clinical Monograph
                  </span>
                  <h3 className="text-xl font-black text-[#1E3A5F] mt-1.5">{results.ipMonograph.genericName}</h3>
                  <p className="text-slate-500 font-bold text-[11px]">Popular Brands in India: {results.ipMonograph.brandNames}</p>
                </div>
                <span className="px-3 py-1 rounded-xl bg-amber-50 text-amber-900 border border-amber-200 font-extrabold text-[11px]">
                  {results.ipMonograph.dpcoStatus}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-slate-700 font-medium">
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 block">Active Ingredient & Strength</span>
                  <p className="font-bold text-[#1E3A5F] text-xs">{results.ipMonograph.activeIngredient}</p>
                </div>
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 block">Therapeutic Indications & Purpose</span>
                  <p className="font-bold text-[#1E3A5F] text-xs">{results.ipMonograph.purpose}</p>
                </div>
              </div>

              {results.ipMonograph.warnings && (
                <div className="p-4 rounded-2xl bg-amber-50/90 border border-amber-200 text-amber-900 space-y-1">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-800 flex items-center gap-1.5">
                    <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>Indian Pharmacopoeia (IP) Safety Warnings & Precautions</span>
                  </span>
                  <p className="text-xs leading-relaxed font-medium text-amber-950">{results.ipMonograph.warnings}</p>
                </div>
              )}
            </div>
          )}

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
      ) : (
        /* Welcome & Quick Search Chips */
        <div className="bg-white border border-slate-200 rounded-3xl p-8 space-y-6 shadow-xs">
          <div className="space-y-2 max-w-xl">
            <h3 className="text-lg font-extrabold text-[#1E3A5F] flex items-center gap-2">
              <Globe className="w-5 h-5 text-teal-600" />
              <span>Official openFDA Drug Label Database</span>
            </h3>
            <p className="text-xs text-slate-500 font-medium leading-relaxed">
              Search any active pharmaceutical formulation or generic medicine name to fetch official US FDA drug indications, side effects, active ingredients, and safety warnings while cross-referencing your shop's live stock.
            </p>
          </div>

          <div className="space-y-2 pt-2 border-t border-slate-100">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              1-Tap Quick Reference Searches:
            </span>
            <div className="flex flex-wrap gap-2">
              {["Paracetamol", "Amoxicillin", "Ibuprofen", "Metformin", "Cefixime", "Azithromycin", "Pantoprazole"].map((drug) => (
                <button
                  key={drug}
                  onClick={() => {
                    setQuery(drug);
                    const fakeEvent = { preventDefault: () => {} } as React.FormEvent;
                    setTimeout(() => {
                      fetch(`/api/medicines/reference-search?q=${encodeURIComponent(drug)}`)
                        .then((res) => res.json())
                        .then((data) => setResults(data));
                    }, 50);
                  }}
                  className="px-3.5 py-2 rounded-2xl bg-slate-50 hover:bg-teal-50 text-slate-700 hover:text-teal-800 border border-slate-200 hover:border-teal-300 font-bold text-xs transition-all cursor-pointer shadow-2xs"
                >
                  💊 {drug}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
