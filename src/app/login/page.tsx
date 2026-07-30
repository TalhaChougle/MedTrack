"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Pill, Lock, Mail, ArrowRight, AlertTriangle, CheckCircle2, Database } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [initMsg, setInitMsg] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");
    setInitMsg("");

    try {
      const res = await signIn("credentials", {
        email: email.trim().toLowerCase(),
        password,
        redirect: false,
      });

      if (res?.error) {
        setErrorMsg(res.error);
      } else {
        router.push("/");
        router.refresh();
      }
    } catch (err: any) {
      setErrorMsg("An error occurred during sign in.");
    } finally {
      setLoading(false);
    }
  };

  const handleInitDatabase = async () => {
    setLoading(true);
    setInitMsg("");
    setErrorMsg("");
    try {
      const res = await fetch("/api/init");
      const data = await res.json();
      if (res.ok) {
        setInitMsg("Database tables initialized successfully!");
      } else {
        setErrorMsg(data.error || "Failed to initialize database.");
      }
    } catch (e: any) {
      setErrorMsg("Database init request failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex-1 bg-auth-gradient flex items-center justify-center p-4 sm:p-6 lg:p-8">
      <div className="max-w-md w-full space-y-8 bg-white border border-white/20 p-8 sm:p-10 rounded-3xl shadow-2xl relative overflow-hidden">
        {/* Decorative ambient background */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-[#4FC3E8]/20 rounded-full blur-3xl pointer-events-none"></div>


        {/* Brand Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex p-3.5 rounded-2xl bg-[#1E3A5F] text-white shadow-md shadow-[#1E3A5F]/20">
            <Pill className="w-8 h-8 text-teal-400" />
          </div>
          <h2 className="text-3xl font-extrabold tracking-tight text-[#1E3A5F]">
            Welcome to MedTrack
          </h2>
          <p className="text-xs text-slate-500 max-w-sm mx-auto font-medium">
            Batch-Level Medicine Stock & Expiry Management for Local Pharmacies
          </p>
        </div>

        {/* Alerts */}
        {errorMsg && (
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {initMsg && (
          <div className="p-4 rounded-2xl bg-teal-50 border border-teal-200 text-teal-800 text-xs font-semibold flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
            <span>{initMsg}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="block text-xs font-extrabold text-[#1E3A5F] mb-1.5 uppercase tracking-wider">
              Email Address
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="pharmacist@example.com"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-3 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-teal-600 focus:bg-white focus:ring-2 focus:ring-teal-500/20 transition-all font-medium"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-extrabold text-[#1E3A5F] mb-1.5 uppercase tracking-wider">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-3 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-teal-600 focus:bg-white focus:ring-2 focus:ring-teal-500/20 transition-all font-medium"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-[#1E3A5F] via-[#0F2544] to-[#0D9488] hover:from-[#0F2544] hover:to-[#0F766E] text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-[#1E3A5F]/20 transition-all transform active:scale-[0.99] disabled:opacity-50 cursor-pointer"
          >
            <span>Sign In to Pharmacy Dashboard</span>
            <ArrowRight className="w-4 h-4 text-teal-300" />
          </button>
        </form>

        {/* Footer Actions */}
        <div className="space-y-4 pt-4 border-t border-slate-200 text-center">
          <p className="text-xs text-slate-500 font-medium">
            Don't have a pharmacy account?{" "}
            <Link
              href="/register"
              className="text-teal-700 font-bold hover:underline"
            >
              Register Pharmacy & Owner
            </Link>
          </p>

          <div className="pt-2">
            <button
              onClick={handleInitDatabase}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-[#1E3A5F] text-xs font-bold border border-slate-200 transition-colors cursor-pointer"
            >
              <Database className="w-3.5 h-3.5 text-teal-600" />
              Initialize DB Tables
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
