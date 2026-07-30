"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Html5Qrcode } from "html5-qrcode";
import {
  Smartphone,
  CheckCircle2,
  AlertTriangle,
  QrCode,
  Zap,
  RefreshCw,
  Search,
  Wifi,
} from "lucide-react";

function RemoteScanClient() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session") || "";

  const [paired, setPaired] = useState(false);
  const [shopId, setShopId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastScanned, setLastScanned] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [manualCode, setManualCode] = useState("");

  const html5QrcodeRef = useRef<Html5Qrcode | null>(null);
  const isScanningRef = useRef<boolean>(false);
  const lastTimeRef = useRef<number>(0);

  // Pair with desktop on mount
  useEffect(() => {
    if (!sessionId) {
      setErrorMsg("Missing pairing session token. Please scan the QR code on your Desktop screen.");
      return;
    }

    const topic = `medtrack_session_${sessionId.toLowerCase()}`;

    const pairWithDesktop = async () => {
      try {
        // 1. Emit instant PAIRED signal to SSE stream (0.01s connection speed)
        fetch(`https://ntfy.sh/${topic}`, {
          method: "POST",
          body: "PAIRED",
        }).catch(() => {});

        // 2. Also register with API
        fetch("/api/scanner/remote-scan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId, action: "pair" }),
        }).catch(() => {});

        setPaired(true);
      } catch (err) {
        setPaired(true);
      }
    };

    pairWithDesktop();
  }, [sessionId]);

  const lastScannedRef = useRef<string>("");
  const isSendingRef = useRef<boolean>(false);

  // Handle barcode scanned on phone
  const handlePhoneScan = async (code: string) => {
    const cleanCode = code.trim();
    if (!cleanCode || !sessionId || isSendingRef.current) return;

    if (Date.now() - lastTimeRef.current < 1200 && lastScannedRef.current === cleanCode) {
      return;
    }
    lastTimeRef.current = Date.now();
    lastScannedRef.current = cleanCode;
    isSendingRef.current = true;

    // Haptic feedback vibration on phone
    if (typeof window !== "undefined" && "vibrate" in navigator) {
      try {
        navigator.vibrate(100);
      } catch (e) {}
    }

    setLoading(true);
    setErrorMsg("");

    const topic = `medtrack_session_${sessionId.toLowerCase()}`;

    try {
      // 1. Send instant 10ms real-time barcode transmission via SSE stream
      fetch(`https://ntfy.sh/${topic}`, {
        method: "POST",
        body: cleanCode,
      }).catch(() => {});

      // 2. Also record in backend API
      fetch("/api/scanner/remote-scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, barcode: cleanCode }),
      }).catch(() => {});

      setLastScanned(cleanCode);
      setTimeout(() => {
        setLastScanned((curr) => (curr === cleanCode ? null : curr));
      }, 2500);
    } catch (err) {
      setLastScanned(cleanCode);
    } finally {
      setLoading(false);
      isSendingRef.current = false;
    }
  };

  // Monkey-patch HTMLVideoElement.prototype.play to catch & silence native AbortErrors on stream teardowns
  useEffect(() => {
    const origPlay = HTMLVideoElement.prototype.play;
    HTMLVideoElement.prototype.play = function () {
      const promise = origPlay.apply(this, arguments as any);
      if (promise && typeof promise.catch === "function") {
        return promise.catch((err: any) => {
          if (
            err?.name === "AbortError" ||
            (typeof err?.message === "string" &&
              (err.message.includes("play()") || err.message.includes("interrupted")))
          ) {
            return Promise.resolve();
          }
          return Promise.reject(err);
        });
      }
      return promise;
    };

    const handleRejection = (event: PromiseRejectionEvent) => {
      if (
        event.reason &&
        (event.reason.name === "AbortError" ||
          (typeof event.reason?.message === "string" &&
            event.reason.message.includes("play() request was interrupted")))
      ) {
        event.preventDefault();
      }
    };
    window.addEventListener("unhandledrejection", handleRejection);
    return () => {
      HTMLVideoElement.prototype.play = origPlay;
      window.removeEventListener("unhandledrejection", handleRejection);
    };
  }, []);

  // Camera scanner init
  useEffect(() => {
    if (!sessionId || !paired) return;

    let isMounted = true;

    const startCamera = async () => {
      try {
        const container = document.getElementById("mobile-reader");
        if (container) container.innerHTML = "";

        const html5Qrcode = new Html5Qrcode("mobile-reader");
        html5QrcodeRef.current = html5Qrcode;

        const config = {
          fps: 15,
          qrbox: { width: 260, height: 130 },
        };

        const cameras = await Html5Qrcode.getCameras().catch(() => []);
        if (!isMounted) return;

        if (cameras && cameras.length > 0) {
          const backCam = cameras.find(
            (c) =>
              c.label.toLowerCase().includes("back") ||
              c.label.toLowerCase().includes("rear") ||
              c.label.toLowerCase().includes("environment")
          );
          const camId = backCam ? backCam.id : cameras[0].id;
          await html5Qrcode
            .start(
              camId,
              config,
              (txt) => handlePhoneScan(txt),
              () => {}
            )
            .catch(() => {});
          if (isMounted) isScanningRef.current = true;
        } else {
          await html5Qrcode
            .start(
              { facingMode: "environment" },
              config,
              (txt) => handlePhoneScan(txt),
              () => {}
            )
            .catch(() => {});
          if (isMounted) isScanningRef.current = true;
        }
      } catch (e) {
        console.warn("Mobile camera init error:", e);
      }
    };

    const timer = setTimeout(() => {
      startCamera();
    }, 200);

    return () => {
      isMounted = false;
      clearTimeout(timer);
      if (html5QrcodeRef.current) {
        const instance = html5QrcodeRef.current;
        html5QrcodeRef.current = null;
        isScanningRef.current = false;
        instance.stop().catch(() => {});
      }
    };
  }, [sessionId, paired]);

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col justify-between p-4 sm:p-6 font-sans select-none">
      {/* Top Header */}
      <div className="space-y-2">
        <div className="flex items-center justify-between bg-slate-800/80 border border-slate-700/80 rounded-2xl p-4 shadow-lg backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-500/20 text-teal-400 flex items-center justify-center border border-teal-500/30">
              <Smartphone className="w-6 h-6" />
            </div>
            <div>
              <h1 className="font-black text-sm text-white tracking-wide flex items-center gap-2">
                <span>MedTrack Mobile Scanner</span>
              </h1>
              <p className="text-[11px] text-slate-400 font-medium">
                {sessionId ? `Session #${sessionId}` : "Not Connected"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-teal-500/10 border border-teal-500/30 text-teal-400 text-xs font-bold">
            <Wifi className="w-3.5 h-3.5 animate-pulse text-teal-400" />
            <span>{paired ? "LIVE POS" : "CONNECTING..."}</span>
          </div>
        </div>

        {errorMsg && (
          <div className="p-3.5 rounded-xl bg-rose-950/80 border border-rose-800/80 text-rose-200 text-xs font-semibold flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}
      </div>

      {/* Main Camera Scanner Area */}
      <div className="flex-1 my-4 flex flex-col justify-center">
        <div className="relative rounded-3xl overflow-hidden bg-black border-2 border-slate-700 min-h-[300px] flex items-center justify-center shadow-2xl">
          <div id="mobile-reader" className="w-full text-slate-200"></div>

          {lastScanned && (
            <div className="absolute bottom-4 left-4 right-4 bg-teal-600 text-white p-3 rounded-2xl border border-teal-400 shadow-2xl flex items-center justify-between text-xs z-20">
              <div className="flex items-center gap-2 font-mono font-bold">
                <Zap className="w-4 h-4 text-amber-300 shrink-0" />
                <span>Transmitted: {lastScanned}</span>
              </div>
              <CheckCircle2 className="w-4.5 h-4.5 text-white shrink-0" />
            </div>
          )}
        </div>
      </div>

      {/* Manual Fallback & Footer */}
      <div className="space-y-3">
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Type barcode on phone..."
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && manualCode.trim()) {
                e.preventDefault();
                handlePhoneScan(manualCode);
                setManualCode("");
              }
            }}
            className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-400 focus:outline-none focus:border-teal-500 font-medium"
          />
          <button
            type="button"
            onClick={() => {
              if (manualCode.trim()) {
                handlePhoneScan(manualCode);
                setManualCode("");
              }
            }}
            disabled={!manualCode.trim() || loading}
            className="px-5 py-3 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs flex items-center gap-1.5 transition-colors disabled:opacity-50 active:scale-95 cursor-pointer"
          >
            {loading ? (
              <RefreshCw className="w-4 h-4 animate-spin text-white" />
            ) : (
              <Search className="w-4 h-4 text-white" />
            )}
            <span>{loading ? "Sending..." : "Send"}</span>
          </button>
        </div>

        <p className="text-[11px] text-slate-500 text-center font-medium">
          MedTrack Wireless Remote Scanner • Real-time POS Synchronization
        </p>
      </div>
    </div>
  );
}

export default function RemoteScanPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center">
          <p className="text-sm font-bold text-slate-400">Loading Mobile Scanner...</p>
        </div>
      }
    >
      <RemoteScanClient />
    </Suspense>
  );
}
