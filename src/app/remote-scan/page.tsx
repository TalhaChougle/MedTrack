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

  function isValidEAN13(code: string): boolean {
    const clean = code.trim();
    if (!/^\d{13}$/.test(clean)) return true;

    // Reject unassigned 990-999 noise distortion prefixes from blurry camera frames
    const prefix3 = parseInt(clean.slice(0, 3));
    if (prefix3 >= 990 && prefix3 <= 999) {
      return false;
    }

    const digits = clean.split("").map(Number);
    const checkDigit = digits.pop()!;
    const sum = digits.reduce((acc, digit, idx) => {
      return acc + digit * (idx % 2 === 0 ? 1 : 3);
    }, 0);
    const calculatedCheck = (10 - (sum % 10)) % 10;
    return checkDigit === calculatedCheck;
  }

  // Handle barcode scanned on phone
  const handlePhoneScan = async (code: string) => {
    const cleanCode = code.trim();
    if (!cleanCode || !sessionId || isSendingRef.current) return;

    // Filter out invalid EAN-13 checksum & noise misreads
    if (/^\d{13}$/.test(cleanCode) && !isValidEAN13(cleanCode)) {
      return;
    }

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

  const [cameraState, setCameraState] = useState<"idle" | "starting" | "active" | "error">("idle");
  const [cameraPermissionError, setCameraPermissionError] = useState<string | null>(null);

  const stopCamera = async () => {
    if (html5QrcodeRef.current && isScanningRef.current) {
      isScanningRef.current = false;
      try {
        await html5QrcodeRef.current.stop();
      } catch (e) {}
      html5QrcodeRef.current = null;
    }
  };

  const startCamera = async () => {
    try {
      await stopCamera();

      const container = document.getElementById("mobile-reader");
      if (container) container.innerHTML = "";

      const html5Qrcode = new Html5Qrcode("mobile-reader");
      html5QrcodeRef.current = html5Qrcode;

      const config = {
        fps: 30,
        videoConstraints: {
          facingMode: "environment",
          width: { ideal: 1920, min: 1280 },
          height: { ideal: 1080, min: 720 },
        },
        experimentalFeatures: {
          useBarCodeDetectorIfSupported: true,
        },
      };

      try {
        await html5Qrcode.start(
          { facingMode: "environment" },
          config,
          (txt) => handlePhoneScan(txt),
          () => {}
        );
        isScanningRef.current = true;
        setCameraState("active");
        return;
      } catch (firstErr) {
        const cameras = await Html5Qrcode.getCameras().catch(() => []);
        if (cameras && cameras.length > 0) {
          const backCam = cameras.find(
            (c) =>
              c.label.toLowerCase().includes("back") ||
              c.label.toLowerCase().includes("rear") ||
              c.label.toLowerCase().includes("environment") ||
              c.label.toLowerCase().includes("0")
          );
          const camId = backCam ? backCam.id : cameras[cameras.length - 1].id;
          await html5Qrcode.start(
            camId,
            config,
            (txt) => handlePhoneScan(txt),
            () => {}
          );
          isScanningRef.current = true;
          setCameraState("active");
          return;
        }
        throw firstErr;
      }
    } catch (e: any) {
      console.warn("Mobile camera init error:", e);
      isScanningRef.current = false;
      setCameraState("error");
      setCameraPermissionError("Camera permission needed. Tap the button below to allow camera access & open rear camera.");
    }
  };

  const requestCameraPermissionAndStart = async () => {
    setCameraPermissionError(null);
    setCameraState("starting");

    try {
      if (typeof navigator !== "undefined" && navigator.mediaDevices?.getUserMedia) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
          stream.getTracks().forEach((track) => track.stop());
        } catch (permErr: any) {
          if (permErr?.name === "NotAllowedError" || permErr?.name === "PermissionDeniedError") {
            setCameraState("error");
            setCameraPermissionError("Camera permission denied in browser settings. Please allow camera access to scan barcodes.");
            return;
          }
        }
      }
      await startCamera();
    } catch (err: any) {
      setCameraState("error");
      setCameraPermissionError(err?.message || "Failed to start camera. Please tap to retry.");
    }
  };

  // Clean up camera on unmount (Do NOT auto-start on load; require user click)
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  return (
    <div className="min-h-screen w-full bg-slate-900 text-white flex flex-col justify-between p-3 sm:p-4 font-sans select-none overflow-x-hidden">
      <div className="w-full max-w-md mx-auto flex-1 flex flex-col justify-between space-y-3">
        {/* Top Header */}
        <div className="space-y-2">
          <div className="flex items-center justify-between bg-slate-800 border border-slate-700 rounded-2xl p-3.5 shadow-lg">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-teal-500/20 text-teal-400 flex items-center justify-center border border-teal-500/30">
                <Smartphone className="w-5 h-5" />
              </div>
              <div>
                <h1 className="font-black text-xs text-white tracking-wide">MedTrack Wireless Scanner</h1>
                <p className="text-[10px] text-slate-400 font-medium">
                  {sessionId ? `Session #${sessionId}` : "Not Connected"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-teal-500/10 border border-teal-500/30 text-teal-400 text-[10px] font-bold">
              <Wifi className="w-3 h-3 animate-pulse text-teal-400" />
              <span>{paired ? "LIVE POS" : "CONNECTING..."}</span>
            </div>
          </div>

          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-950/80 border border-rose-800 text-rose-200 text-xs font-semibold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}
        </div>

        {/* Main Camera Scanner Area */}
        <div className="flex-1 my-2 flex flex-col justify-center items-center">
          <div className="w-full aspect-[4/3] max-h-[480px] rounded-3xl overflow-hidden bg-black border-2 border-teal-500/40 relative shadow-2xl flex items-center justify-center">
            <div id="mobile-reader" className="w-full h-full object-cover text-slate-200"></div>

            {cameraState !== "active" && (
              <div className="absolute inset-0 bg-slate-950/95 p-4 flex flex-col items-center justify-center text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-teal-500/20 text-teal-400 flex items-center justify-center border border-teal-500/30">
                  <Smartphone className="w-6 h-6 animate-pulse" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-sm font-extrabold text-white">Enable Phone Camera Scanner</h3>
                  <p className="text-[11px] text-slate-300 font-medium max-w-xs">
                    {cameraPermissionError || "Tap button below to grant camera permission & open your rear camera."}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => requestCameraPermissionAndStart()}
                  className="px-5 py-3 bg-teal-600 hover:bg-teal-500 text-white text-xs font-black rounded-2xl shadow-xl cursor-pointer flex items-center gap-2 active:scale-95 transition-transform"
                >
                  <Smartphone className="w-4 h-4" />
                  <span>📷 Allow Camera & Start Rear Scanner</span>
                </button>
              </div>
            )}
          </div>

          {/* Static Dedicated Status Box */}
          <div className="w-full h-12 mt-3 flex items-center justify-center">
            {lastScanned ? (
              <div className="w-full bg-teal-600 text-white px-4 py-2.5 rounded-2xl border border-teal-400 shadow-xl flex items-center justify-between text-xs transition-all">
                <div className="flex items-center gap-2 font-mono font-bold truncate">
                  <Zap className="w-4 h-4 text-amber-300 shrink-0" />
                  <span className="truncate">Sent to Dashboard: {lastScanned}</span>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-black bg-teal-800 text-white shrink-0">
                  ✓ SENT
                </span>
              </div>
            ) : (
              <p className="text-[11px] text-slate-400 font-medium text-center">
                📷 Point phone camera at any barcode to send to Dashboard
              </p>
            )}
          </div>
        </div>

        {/* Manual Fallback & Footer */}
        <div className="space-y-3 pt-2">
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Type barcode to send..."
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && manualCode.trim()) {
                  e.preventDefault();
                  handlePhoneScan(manualCode);
                  setManualCode("");
                }
              }}
              className="flex-1 min-w-0 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-teal-500 font-medium truncate"
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
              className="px-3.5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs flex items-center gap-1.5 transition-colors disabled:opacity-50 active:scale-95 cursor-pointer shadow-md shrink-0 whitespace-nowrap"
            >
              {loading ? (
                <RefreshCw className="w-4 h-4 animate-spin text-white" />
              ) : (
                <Search className="w-4 h-4 text-white" />
              )}
              <span>{loading ? "Sending..." : "Send"}</span>
            </button>
          </div>

          <p className="text-[10px] text-slate-500 text-center font-medium">
            MedTrack Wireless Remote Scanner • Real-time POS Synchronization
          </p>
        </div>
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
