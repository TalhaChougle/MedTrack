"use client";

import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  Pill,
  LayoutDashboard,
  ShoppingCart,
  Boxes,
  AlertTriangle,
  RefreshCw,
  Trash2,
  Search,
  FileSpreadsheet,
  LogOut,
  Menu,
  X,
  Building2,
  QrCode,
} from "lucide-react";
import BarcodeScannerModal from "./BarcodeScannerModal";

export default function Navbar() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannerMode, setScannerMode] = useState<"check" | "stockIn">("check");

  if (!session || pathname === "/login" || pathname === "/register" || pathname?.startsWith("/remote-scan")) return null;

  const isOwner = session.user.role === "owner";

  const navItems = [
    { label: "Dashboard", href: "/", icon: LayoutDashboard },
    { label: "FEFO Dispense", href: "/sell", icon: ShoppingCart },
    { label: "Inventory", href: "/inventory", icon: Boxes },
    { label: "Expiry Alerts", href: "/alerts", icon: AlertTriangle },
    { label: "Restock", href: "/restock", icon: RefreshCw },
    { label: "Wastage", href: "/wastage", icon: Trash2 },
    { label: "FDA Reference", href: "/reference", icon: Search },
    ...(isOwner ? [{ label: "Audit & Exports", href: "/audit", icon: FileSpreadsheet }] : []),
  ];

  const handleOpenScanner = (mode: "check" | "stockIn") => {
    setScannerMode(mode);
    setScannerOpen(true);
    setMobileMenuOpen(false);
  };

  return (
    <>
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200 text-[#1A2B3C] shadow-xs w-full">
        {/* Top Tier: Logo & Main Actions */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 border-b border-slate-100">
          <div className="flex items-center justify-between h-14 gap-4">
            {/* Brand Logo */}
            <Link href="/" className="flex items-center gap-2.5 group shrink-0">
              <div className="w-8 h-8 rounded-xl bg-cyan-gradient flex items-center justify-center text-white font-black shadow-md shadow-[#29C5E0]/30 group-hover:scale-105 transition-transform">
                <Pill className="w-4 h-4 text-white" />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-extrabold tracking-tight text-[#1A2B3C]">
                  MedTrack
                </span>
                <span className="inline-flex items-center text-[9px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-cyan-50 text-[#1BA6C4] font-extrabold border border-cyan-200">
                  FEFO ENABLED
                </span>
              </div>
            </Link>

            {/* Desktop Action Bar */}
            <div className="hidden md:flex items-center gap-3 shrink-0">
              {/* Dual Scanner Segmented Control */}
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
                <button
                  onClick={() => handleOpenScanner("check")}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold text-[#1A2B3C] hover:bg-white transition-all cursor-pointer"
                  title="Scan barcode to check stock & expiry"
                >
                  <QrCode className="w-3.5 h-3.5 text-[#1BA6C4]" />
                  <span>Check Stock</span>
                </button>
                <button
                  onClick={() => handleOpenScanner("stockIn")}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold btn-primary-cyan shadow-xs hover:shadow-md transition-all cursor-pointer"
                  title="Scan delivery barcode to stock in new batch"
                >
                  <Boxes className="w-3.5 h-3.5 text-white" />
                  <span>Stock In</span>
                </button>
              </div>

              {/* User Profile Info */}
              <div className="flex items-center gap-2.5 pl-3 border-l border-slate-200">
                <div className="text-right text-xs">
                  <p className="font-extrabold text-[#1A2B3C] leading-tight">{session.user.name}</p>
                  <div className="flex items-center justify-end gap-1.5 text-[10px] text-slate-500 font-medium mt-0.5">
                    <Building2 className="w-3 h-3 text-slate-400" />
                    <span className="capitalize text-[#1BA6C4] font-extrabold">Shop #{session.user.shopId}</span>
                    <span className="text-slate-300">•</span>
                    <span className={`capitalize font-extrabold ${isOwner ? "text-amber-600" : "text-[#1BA6C4]"}`}>
                      {session.user.role}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => signOut({ callbackUrl: "/login" })}
                  className="p-1.5 rounded-xl bg-slate-100 hover:bg-rose-50 text-slate-500 hover:text-rose-600 transition-colors border border-slate-200 cursor-pointer"
                  title="Log out"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Mobile Action Buttons */}
            <div className="flex md:hidden items-center gap-1.5">
              <button
                onClick={() => handleOpenScanner("check")}
                className="px-2.5 py-1.5 rounded-lg bg-[#1E3A5F]/10 text-[#1E3A5F] border border-[#1E3A5F]/20 text-xs font-extrabold flex items-center gap-1 cursor-pointer"
                title="Check Stock"
              >
                <QrCode className="w-3.5 h-3.5 text-[#1E3A5F]" />
                <span className="text-[11px]">Check</span>
              </button>

              <button
                onClick={() => handleOpenScanner("stockIn")}
                className="px-2.5 py-1.5 rounded-lg bg-teal-600 text-white text-xs font-extrabold flex items-center gap-1 shadow-xs cursor-pointer"
                title="Stock In Delivery"
              >
                <Boxes className="w-3.5 h-3.5 text-white" />
                <span className="text-[11px]">Stock In</span>
              </button>

              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-1.5 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 cursor-pointer"
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Bottom Tier: Desktop Navigation Bar */}
        <div className="hidden md:block bg-slate-50/70 border-b border-slate-200/60">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <nav className="flex items-center gap-1 overflow-x-auto py-1 scrollbar-none">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                      isActive
                        ? "bg-white text-[#1BA6C4] font-extrabold shadow-2xs border border-slate-200/80"
                        : "text-slate-600 hover:text-[#1A2B3C] hover:bg-white/60"
                    }`}
                  >
                    <Icon className={`w-3.5 h-3.5 ${isActive ? "text-[#1BA6C4]" : "text-slate-400"}`} />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-white border-b border-slate-200 px-4 pt-3 pb-6 space-y-3 shadow-lg">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 text-xs">
              <span className="text-slate-500 font-medium">Shop ID: #{session.user.shopId}</span>
              <span className="text-[#1BA6C4] font-extrabold uppercase">{session.user.role} Account</span>
            </div>

            <div className="grid grid-cols-2 gap-2 py-2">
              <button
                onClick={() => handleOpenScanner("check")}
                className="flex items-center justify-center gap-2 p-2.5 rounded-xl bg-slate-100 border border-slate-200 text-[#1A2B3C] text-xs font-bold"
              >
                <QrCode className="w-4 h-4 text-[#1BA6C4]" />
                Check Stock
              </button>
              <button
                onClick={() => handleOpenScanner("stockIn")}
                className="flex items-center justify-center gap-2 p-2.5 rounded-xl btn-primary-cyan text-white text-xs font-bold"
              >
                <Boxes className="w-4 h-4 text-white" />
                Stock In
              </button>
            </div>

            <div className="space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold ${
                      isActive
                        ? "bg-cyan-50 text-[#1BA6C4] border-l-4 border-[#1BA6C4] font-extrabold"
                        : "text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    <Icon className={`w-4.5 h-4.5 ${isActive ? "text-[#1BA6C4]" : "text-slate-400"}`} />
                    {item.label}
                  </Link>
                );
              })}
            </div>

            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="w-full flex items-center justify-center gap-2 mt-4 px-4 py-2.5 rounded-xl bg-rose-50 text-rose-600 border border-rose-200 text-sm font-bold"
            >
              <LogOut className="w-4 h-4" />
              Sign Out ({session.user.name})
            </button>
          </div>
        )}
      </header>

      {/* Dual Mode Scanner Modal */}
      {scannerOpen && (
        <BarcodeScannerModal
          mode={scannerMode}
          onClose={() => setScannerOpen(false)}
          onSelectMode={(mode) => setScannerMode(mode)}
        />
      )}
    </>
  );
}
