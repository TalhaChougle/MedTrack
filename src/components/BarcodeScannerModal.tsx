"use client";

import { useEffect, useState, useRef } from "react";
import { Html5Qrcode } from "html5-qrcode";
import {
  X,
  QrCode,
  Boxes,
  Search,
  CheckCircle2,
  AlertTriangle,
  Smartphone,
  Keyboard,
  RefreshCw,
  Zap,
  PlusCircle,
  Usb,
  Wifi,
  Radio,
  Printer,
  Camera,
} from "lucide-react";
import { autoClassifySchedule } from "@/lib/scheduleClassifier";

interface BarcodeScannerModalProps {
  mode: "check" | "stockIn";
  onClose: () => void;
  onSelectMode: (mode: "check" | "stockIn") => void;
}

const checkIsMobileDevice = () => {
  if (typeof window === "undefined") return false;
  const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera || "";
  const isTouchScreen = "ontouchstart" in window || navigator.maxTouchPoints > 0;
  const isMobileScreen = window.innerWidth < 768;
  const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
  return (isMobileUA || isMobileScreen) && isTouchScreen;
};

export default function BarcodeScannerModal({
  mode,
  onClose,
  onSelectMode,
}: BarcodeScannerModalProps) {
  const [isMobile, setIsMobile] = useState(false);
  // Default to "wired" USB scanner on Desktop PC, "camera" on Mobile Phone/Tablet
  const [inputSource, setInputSource] = useState<"camera" | "wired" | "wireless_dongle" | "phone" | "manual">("wired");

  useEffect(() => {
    const mobile = checkIsMobileDevice();
    setIsMobile(mobile);
    if (mobile) {
      setInputSource("camera");
    } else {
      setInputSource("wired");
    }
  }, []);

  const [manualCode, setManualCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const [checkResult, setCheckResult] = useState<any>(null);
  const [stockInMedicine, setStockInMedicine] = useState<any>(null);

  const [batchNumber, setBatchNumber] = useState("");
  const [quantity, setQuantity] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [supplier, setSupplier] = useState("");
  const [costPrice, setCostPrice] = useState("");
  const [newMedicineName, setNewMedicineName] = useState("");
  const [newMedicineSchedule, setNewMedicineSchedule] = useState("OTC");
  const [existingMeds, setExistingMeds] = useState<any[]>([]);

  useEffect(() => {
    fetch("/api/medicines")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setExistingMeds(data);
      })
      .catch(() => {});
  }, []);

  // Phone Pairing State (Method A)
  const [phoneSessionId, setPhoneSessionId] = useState<string | null>(null);
  const [phoneQrUrl, setPhoneQrUrl] = useState<string | null>(null);
  const [phoneRemoteUrl, setPhoneRemoteUrl] = useState<string | null>(null);
  const [phonePaired, setPhonePaired] = useState(false);
  const [phoneSessionLoading, setPhoneSessionLoading] = useState(false);

  const [lastStockedLabelInfo, setLastStockedLabelInfo] = useState<{
    barcode: string;
    medicineName: string;
    batchNumber: string;
    expiryDate: string;
  } | null>(null);

  const lastScannedCodeRef = useRef<string>("");
  const manualInputRef = useRef<HTMLInputElement | null>(null);
  const wiredInputRef = useRef<HTMLInputElement | null>(null);

  // Buffer ref for hardware scanners (Wired USB & Wireless 2.4GHz/Bluetooth Dongle guns)
  const keystrokeBufferRef = useRef<string>("");
  const lastKeyTimeRef = useRef<number>(0);

  // Prevent background body & window scroll when modal is open
  useEffect(() => {
    const origBodyOverflow = document.body.style.overflow;
    const origHtmlOverflow = document.documentElement.style.overflow;

    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    const handlePreventScroll = (e: Event) => {
      const target = e.target as HTMLElement | null;
      if (!target?.closest(".modal-scrollable-content")) {
        e.preventDefault();
      }
    };

    window.addEventListener("wheel", handlePreventScroll, { passive: false });
    window.addEventListener("touchmove", handlePreventScroll, { passive: false });

    return () => {
      document.body.style.overflow = origBodyOverflow;
      document.documentElement.style.overflow = origHtmlOverflow;
      window.removeEventListener("wheel", handlePreventScroll);
      window.removeEventListener("touchmove", handlePreventScroll);
    };
  }, []);

  // Auto focus appropriate input box when Wired or Manual tabs are selected
  useEffect(() => {
    if (inputSource === "wired") {
      wiredInputRef.current?.focus();
    } else if (inputSource === "manual") {
      manualInputRef.current?.focus();
    }
  }, [inputSource]);

  // Direct Device Camera Scanner Engine
  const cameraScannerRef = useRef<Html5Qrcode | null>(null);
  const cameraActiveRef = useRef<boolean>(false);

  useEffect(() => {
    if (inputSource !== "camera") {
      if (cameraScannerRef.current && cameraActiveRef.current) {
        cameraScannerRef.current
          .stop()
          .catch(() => {})
          .then(() => {
            cameraScannerRef.current = null;
            cameraActiveRef.current = false;
          });
      }
      return;
    }

    let isMounted = true;
    const startCameraScanner = async () => {
      try {
        const container = document.getElementById("direct-device-camera-reader");
        if (container) container.innerHTML = "";

        const html5Qrcode = new Html5Qrcode("direct-device-camera-reader");
        cameraScannerRef.current = html5Qrcode;

        const config = {
          fps: 20,
          qrbox: (viewfinderWidth: number, viewfinderHeight: number) => ({
            width: Math.min(viewfinderWidth - 10, Math.floor(viewfinderWidth * 0.90)),
            height: Math.min(viewfinderHeight - 10, Math.floor(viewfinderHeight * 0.60)),
          }),
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
              (scannedText) => {
                if (scannedText) {
                  if (typeof window !== "undefined" && "vibrate" in navigator) {
                    try { navigator.vibrate(100); } catch (e) {}
                  }
                  handleBarcodeScanned(scannedText);
                }
              },
              () => {}
            )
            .catch(() => {});
          if (isMounted) cameraActiveRef.current = true;
        } else {
          await html5Qrcode
            .start(
              { facingMode: "environment" },
              config,
              (scannedText) => {
                if (scannedText) {
                  if (typeof window !== "undefined" && "vibrate" in navigator) {
                    try { navigator.vibrate(100); } catch (e) {}
                  }
                  handleBarcodeScanned(scannedText);
                }
              },
              () => {}
            )
            .catch(() => {});
          if (isMounted) cameraActiveRef.current = true;
        }
      } catch (err) {
        console.warn("Direct camera scanner init warning:", err);
      }
    };

    const timer = setTimeout(() => {
      startCameraScanner();
    }, 200);

    return () => {
      isMounted = false;
      clearTimeout(timer);
      if (cameraScannerRef.current && cameraActiveRef.current) {
        cameraScannerRef.current
          .stop()
          .catch(() => {})
          .then(() => {
            cameraScannerRef.current = null;
            cameraActiveRef.current = false;
          });
      }
    };
  }, [inputSource]);

  const playBeep = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.12);
    } catch (e) {
      // Audio Context blocked or unsupported
    }
  };

  const parsePharmaceuticalBarcode = (rawCode: string) => {
    const clean = rawCode.trim();
    if (!clean) return { barcode: "" };

    let barcode = clean;
    let batchNumber: string | undefined = undefined;
    let expiryDate: string | undefined = undefined;

    // 1. Check parenthesized GS1 format e.g. (01)08901296060667(10)BATCH123(17)261231
    if (clean.includes("(") && clean.includes(")")) {
      const gtinMatch = clean.match(/\(01\)(\d{13,14})/);
      if (gtinMatch) barcode = gtinMatch[1];

      const batchMatch = clean.match(/\(10\)([A-Za-z0-9_-]+)/);
      if (batchMatch) batchNumber = batchMatch[1];

      const expMatch = clean.match(/\(17\)(\d{6})/);
      if (expMatch) {
        const yy = expMatch[1].slice(0, 2);
        const mm = expMatch[1].slice(2, 4);
        const dd = expMatch[1].slice(4, 6);
        const year = parseInt(yy) > 50 ? `19${yy}` : `20${yy}`;
        expiryDate = `${year}-${mm}-${dd}`;
      }

      return { barcode, batchNumber, expiryDate };
    }

    // 2. Check GS1 AI string formats e.g. 01089012960606671726123110BATCH123
    const expMatch2 = clean.match(/17(\d{6})/);
    if (expMatch2) {
      const yy = expMatch2[1].slice(0, 2);
      const mm = expMatch2[1].slice(2, 4);
      const dd = expMatch2[1].slice(4, 6);
      const year = parseInt(yy) > 50 ? `19${yy}` : `20${yy}`;
      expiryDate = `${year}-${mm}-${dd}`;
    }

    const batchMatch2 = clean.match(/10([A-Za-z0-9_-]{3,15})/);
    if (batchMatch2) {
      batchNumber = batchMatch2[1];
    }

    return { barcode, batchNumber, expiryDate };
  };

  // Barcode scanned event handler with GS1 Batch/Expiry parsing
  const handleBarcodeScanned = async (scannedCode: string) => {
    const parsed = parsePharmaceuticalBarcode(scannedCode);
    const code = parsed.barcode || scannedCode.trim();
    if (!code || loading) return;

    if (
      lastScannedCodeRef.current === code &&
      Date.now() - (handleBarcodeScanned as any).lastTime < 2000
    ) {
      return;
    }
    (handleBarcodeScanned as any).lastTime = Date.now();
    lastScannedCodeRef.current = code;

    playBeep();
    setLoading(true);
    setErrorMsg("");
    setSuccessMsg("");

    // Trigger dashboard & inventory refresh in background
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("medtrack:refresh"));
    }

    try {
      if (mode === "check") {
        const res = await fetch(`/api/medicines/by-code/${encodeURIComponent(code)}`);
        const data = await res.json();
        if (!res.ok) {
          setErrorMsg(data.error || "Barcode not registered in live stock yet.");
          setCheckResult({ notFound: true, barcode: code });
        } else {
          setCheckResult(data);
        }
      } else {
        const res = await fetch(`/api/batches/by-code?barcode=${encodeURIComponent(code)}`);
        const data = await res.json();
        if (!res.ok) {
          setErrorMsg(data.error || "No medicine registered with this barcode.");
          setStockInMedicine(null);
        } else {
          setStockInMedicine({
            ...data.medicine,
            barcode: code,
            isNew: data.isNew,
          });
          const medName = data.medicine?.name || "";
          setNewMedicineName(medName);
          setNewMedicineSchedule(data.medicine?.schedule || autoClassifySchedule(medName));
          
          // Auto-fill extracted Batch Number or suggested batch number
          setBatchNumber(parsed.batchNumber || data.suggestedBatchNumber || "BATCH-001");
          
          // Auto-fill extracted Expiry Date if present in barcode (YYYY-MM-DD)
          if (parsed.expiryDate) {
            setExpiryDate(parsed.expiryDate);
          }
        }
      }
    } catch (err: any) {
      setErrorMsg("Network or lookup error occurred.");
    } finally {
      setLoading(false);
    }
  };

  const handleStockInSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stockInMedicine || !batchNumber || !quantity || !expiryDate || !supplier) {
      setErrorMsg("Please fill in all required fields.");
      return;
    }

    if (stockInMedicine.isNew && !newMedicineName.trim()) {
      setErrorMsg("Please enter a medicine name.");
      return;
    }

    setLoading(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      const res = await fetch("/api/batches/by-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          barcode: stockInMedicine.barcode,
          medicineName: stockInMedicine.isNew ? newMedicineName.trim() : stockInMedicine.name,
          schedule: stockInMedicine.isNew ? newMedicineSchedule : stockInMedicine.schedule,
          batchNumber,
          quantity: parseInt(quantity),
          expiryDate,
          supplier,
          costPrice: parseFloat(costPrice) || 0,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data.error || "Failed to stock in batch.");
      } else {
        setSuccessMsg(`Successfully stocked in Batch ${data.batch.batchNumber} for ${data.medicine.name}!`);
        setLastStockedLabelInfo({
          barcode: data.medicine.barcode,
          medicineName: data.medicine.name,
          batchNumber: data.batch.batchNumber,
          expiryDate: data.batch.expiryDate,
        });
        setStockInMedicine(null);
        setNewMedicineName("");
        setBatchNumber("");
        setQuantity("");
        setExpiryDate("");
        setSupplier("");
        setCostPrice("");

        // Auto-refresh dashboard & inventory state across the app
        if (typeof window !== "undefined") {
          window.dispatchEvent(new Event("medtrack:refresh"));
        }
      }
    } catch (err: any) {
      setErrorMsg("Failed to submit stock in entry.");
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateInternalBarcode = () => {
    const randomDigits = Math.floor(1000000 + Math.random() * 9000000).toString();
    const internalBarcode = `890999${randomDigits}`;
    onSelectMode("stockIn");
    setSuccessMsg(`✨ Generated Internal Barcode: ${internalBarcode}! Enter medicine name & batch details below.`);
    handleBarcodeScanned(internalBarcode);
    setTimeout(() => {
      const formEl = document.getElementById("stock-in-form-container");
      if (formEl) {
        formEl.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 150);
  };

  const handlePrintLabel = (labelData: { barcode: string; medicineName: string; batchNumber: string; expiryDate: string }) => {
    const printWindow = window.open("", "_blank", "width=400,height=300");
    if (!printWindow) return;
    printWindow.document.write(`
      <html>
        <head>
          <title>Print Barcode Label - ${labelData.medicineName}</title>
          <style>
            body { font-family: monospace, sans-serif; text-align: center; padding: 20px; }
            .label { border: 2px dashed #000; padding: 15px; border-radius: 12px; max-width: 320px; margin: auto; }
            .title { font-weight: bold; font-size: 16px; margin-bottom: 4px; font-family: sans-serif; }
            .meta { font-size: 12px; color: #444; font-family: sans-serif; }
            .barcode-box { background: #f4f4f4; padding: 10px; border-radius: 8px; margin: 10px 0; border: 1px solid #ccc; }
            .barcode-text { font-size: 18px; letter-spacing: 3px; font-weight: bold; margin-top: 4px; }
          </style>
        </head>
        <body>
          <div class="label">
            <div class="title">${labelData.medicineName}</div>
            <div class="meta">Batch: <strong>${labelData.batchNumber}</strong> | Exp: <strong>${labelData.expiryDate}</strong></div>
            <div class="barcode-box">
              <div style="font-size:24px; tracking: -2px;">||| | || |||| | ||| ||</div>
              <div class="barcode-text">${labelData.barcode}</div>
            </div>
            <div class="meta">MedTrack Internal Pharmacy Barcode</div>
          </div>
          <script>
            window.onload = function() { window.print(); window.close(); };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // 📱 Phone Pair Session Init & Polling (when inputSource === "phone")
  useEffect(() => {
    if (inputSource !== "phone") return;

    let isMounted = true;

    const initPhonePairing = async () => {
      setPhoneSessionLoading(true);
      try {
        const res = await fetch("/api/scanner/session", { method: "POST" });
        const data = await res.json();
        if (res.ok && isMounted) {
          setPhoneSessionId(data.sessionId);
          setPhoneQrUrl(data.qrUrl);
          setPhoneRemoteUrl(data.remoteUrl);
        }
      } catch (e) {
        console.warn("Failed to init phone pairing session:", e);
      } finally {
        if (isMounted) setPhoneSessionLoading(false);
      }
    };

    initPhonePairing();
  }, [inputSource]);

  const lastSeenTimestampRef = useRef<number>(0);

  // Real-time Instant SSE Stream Listener for phone pairing & remote scans
  useEffect(() => {
    if (inputSource !== "phone" || !phoneSessionId) return;

    let eventSource: EventSource | null = null;
    let fallbackInterval: any = null;

    const topic = `medtrack_session_${phoneSessionId.toLowerCase()}`;
    const sseUrl = `https://ntfy.sh/${topic}/sse`;

    try {
      eventSource = new EventSource(sseUrl);

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          const message = data.message?.trim();
          if (!message) return;

          if (message === "PAIRED") {
            setPhonePaired(true);
          } else if (message.length > 0) {
            setPhonePaired(true);
            handleBarcodeScanned(message);
          }
        } catch (e) {}
      };
    } catch (e) {}

    // Backup polling loop in case SSE is blocked by local proxy
    fallbackInterval = setInterval(async () => {
      try {
        const res = await fetch(
          `/api/scanner/session?sessionId=${phoneSessionId}&since=${lastSeenTimestampRef.current}`
        );
        if (res.ok) {
          const data = await res.json();
          if (data.paired) setPhonePaired(true);
          if (data.newScan && data.newScan.timestamp > lastSeenTimestampRef.current) {
            lastSeenTimestampRef.current = data.newScan.timestamp;
            handleBarcodeScanned(data.newScan.barcode);
          }
        }
      } catch (e) {}
    }, 1000);

    return () => {
      if (eventSource) eventSource.close();
      if (fallbackInterval) clearInterval(fallbackInterval);
    };
  }, [inputSource, phoneSessionId, mode]);

  // 🔌 📡 Hardware Scanner Listener for Wired USB & Wireless 2.4GHz / Bluetooth Guns
  useEffect(() => {
    if (inputSource !== "wired" && inputSource !== "wireless_dongle") return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = (document.activeElement?.tagName || "").toLowerCase();
      const isInputOrTextArea = activeTag === "input" || activeTag === "textarea";

      const now = Date.now();
      const timeDiff = now - lastKeyTimeRef.current;
      lastKeyTimeRef.current = now;

      if (e.key === "Enter") {
        if (keystrokeBufferRef.current.length >= 3) {
          const scanned = keystrokeBufferRef.current;
          keystrokeBufferRef.current = "";
          handleBarcodeScanned(scanned);
        } else {
          keystrokeBufferRef.current = "";
        }
        return;
      }

      if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
        if (timeDiff > 80 && isInputOrTextArea && document.activeElement !== wiredInputRef.current && document.activeElement !== manualInputRef.current) {
          keystrokeBufferRef.current = e.key;
        } else {
          keystrokeBufferRef.current += e.key;
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [inputSource]);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white border border-slate-200 text-slate-800 rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col my-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50 shrink-0">
          <div className="flex items-center gap-3">
            <div
              className={`p-2.5 rounded-xl ${
                mode === "check" ? "bg-[#1E3A5F] text-teal-400" : "bg-teal-700 text-white"
              }`}
            >
              {mode === "check" ? <QrCode className="w-5 h-5" /> : <Boxes className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="text-lg font-extrabold text-[#1E3A5F]">
                {mode === "check" ? "Check Stock Availability" : "Stock In New Delivery"}
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                {mode === "check"
                  ? "Scan barcode to view live total stock & batch expiry"
                  : "Scan delivery barcode to auto-fill medicine & stock in"}
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              onClose();
            }}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Switcher Tabs */}
        <div className="grid grid-cols-2 p-2 gap-2 bg-slate-100 border-b border-slate-200 shrink-0">
          <button
            onClick={() => {
              setCheckResult(null);
              setStockInMedicine(null);
              setErrorMsg("");
              onSelectMode("check");
            }}
            className={`py-2.5 px-4 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              mode === "check"
                ? "bg-[#1E3A5F] text-white shadow-xs"
                : "text-slate-600 hover:bg-slate-200"
            }`}
          >
            Mode 1: Check Availability
          </button>
          <button
            onClick={() => {
              setCheckResult(null);
              setStockInMedicine(null);
              setErrorMsg("");
              onSelectMode("stockIn");
            }}
            className={`py-2.5 px-4 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              mode === "stockIn"
                ? "bg-teal-700 text-white shadow-xs"
                : "text-slate-600 hover:bg-slate-200"
            }`}
          >
            Mode 2: Stock In Batch
          </button>
        </div>

        <div className="p-6 space-y-6 overflow-y-auto flex-1 modal-scrollable-content scroll-smooth-custom">
          {/* Scanner Input Device Choice Selector */}
          <div className="space-y-2">
            <label className="text-xs font-extrabold text-[#1E3A5F] uppercase tracking-wider block">
              Choose Scanner Input Device:
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
              {isMobile ? (
                <>
                  <button
                    type="button"
                    onClick={() => setInputSource("camera")}
                    className={`py-2 px-2.5 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      inputSource === "camera"
                        ? "bg-white text-emerald-700 shadow-xs border border-slate-200 font-extrabold"
                        : "text-slate-600 hover:bg-white/60"
                    }`}
                  >
                    <Camera className="w-3.5 h-3.5 text-emerald-600" />
                    <span>📷 Phone Camera</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setInputSource("manual")}
                    className={`py-2 px-2.5 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      inputSource === "manual"
                        ? "bg-white text-slate-800 shadow-xs border border-slate-200 font-extrabold"
                        : "text-slate-600 hover:bg-white/60"
                    }`}
                  >
                    <Keyboard className="w-3.5 h-3.5 text-slate-500" />
                    <span>⌨️ Manual</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setInputSource("wired")}
                    className={`py-2 px-2.5 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      inputSource === "wired"
                        ? "bg-white text-[#1E3A5F] shadow-xs border border-slate-200 font-extrabold"
                        : "text-slate-600 hover:bg-white/60"
                    }`}
                  >
                    <Usb className="w-3.5 h-3.5 text-blue-600" />
                    <span>🔌 Wired USB</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setInputSource("phone")}
                    className={`py-2 px-2.5 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      inputSource === "phone"
                        ? "bg-white text-teal-700 shadow-xs border border-slate-200 font-extrabold"
                        : "text-slate-600 hover:bg-white/60"
                    }`}
                  >
                    <Smartphone className="w-3.5 h-3.5 text-teal-600" />
                    <span>📱 Remote Pair</span>
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setInputSource("wired")}
                    className={`py-2 px-2.5 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      inputSource === "wired"
                        ? "bg-white text-[#1E3A5F] shadow-xs border border-slate-200 font-extrabold"
                        : "text-slate-600 hover:bg-white/60"
                    }`}
                  >
                    <Usb className="w-3.5 h-3.5 text-blue-600" />
                    <span>🔌 Wired USB</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setInputSource("wireless_dongle")}
                    className={`py-2 px-2.5 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      inputSource === "wireless_dongle"
                        ? "bg-white text-indigo-700 shadow-xs border border-slate-200 font-extrabold"
                        : "text-slate-600 hover:bg-white/60"
                    }`}
                  >
                    <Radio className="w-3.5 h-3.5 text-indigo-600" />
                    <span>📡 Wireless 2.4G/BT</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setInputSource("phone")}
                    className={`py-2 px-2.5 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      inputSource === "phone"
                        ? "bg-white text-teal-700 shadow-xs border border-slate-200 font-extrabold"
                        : "text-slate-600 hover:bg-white/60"
                    }`}
                  >
                    <Smartphone className="w-3.5 h-3.5 text-teal-600" />
                    <span>📱 Pair Phone (QR)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setInputSource("manual")}
                    className={`py-2 px-2.5 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      inputSource === "manual"
                        ? "bg-white text-slate-800 shadow-xs border border-slate-200 font-extrabold"
                        : "text-slate-600 hover:bg-white/60"
                    }`}
                  >
                    <Keyboard className="w-3.5 h-3.5 text-slate-500" />
                    <span>⌨️ Manual</span>
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Device Option 0: Direct Device Camera Scanner */}
          {inputSource === "camera" && (
            <div className="p-4 rounded-3xl bg-[#0F172A] border border-slate-800 text-white space-y-3 shadow-2xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                  <span className="text-xs font-bold text-emerald-400">Live Device Camera Active</span>
                </div>
                <span className="text-[10px] text-slate-400 font-medium">Point camera at medicine barcode</span>
              </div>

              <div className="relative rounded-2xl overflow-hidden bg-black aspect-4/3 flex items-center justify-center border border-slate-700 shadow-inner">
                <div id="direct-device-camera-reader" className="w-full h-full" />
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                <span>⚡ Auto-detects 1D, EAN-13, GS1 & 2D barcodes</span>
                <span className="text-emerald-400 font-bold">Touchless Instant Scan</span>
              </div>
            </div>
          )}

          {/* Device Option 1: Wired USB Cable Scanner */}
          {inputSource === "wired" && (
            <div className="p-5 rounded-2xl bg-blue-50/50 border border-blue-100 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-blue-900">
                  <Usb className="w-5 h-5 text-blue-600" />
                  <h4 className="font-extrabold text-sm">Wired USB Cable Scanner Mode</h4>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-blue-100 text-blue-800 text-[10px] font-extrabold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-ping" />
                  <span>🟢 Cable Active</span>
                </span>
              </div>
              <p className="text-xs text-slate-600 font-medium">
                Plug your wired USB barcode gun into your computer. Point the scanner red laser at any pharmaceutical barcode and trigger to scan.
              </p>

              <div className="space-y-2">
                <label className="text-[11px] font-extrabold text-slate-700 uppercase tracking-wider block">
                  Scan Input Target:
                </label>
                <div className="flex gap-2">
                  <input
                    ref={wiredInputRef}
                    type="text"
                    placeholder="Scan wired USB barcode here..."
                    value={manualCode}
                    onChange={(e) => setManualCode(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleBarcodeScanned(manualCode);
                      }
                    }}
                    className="flex-1 bg-white border border-blue-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono font-medium shadow-2xs"
                  />
                  <button
                    onClick={() => handleBarcodeScanned(manualCode)}
                    disabled={loading || !manualCode.trim()}
                    className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer shadow-2xs"
                  >
                    <Search className="w-4 h-4" />
                    Scan
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Device Option 2: Wireless 2.4GHz RF / Bluetooth Handheld Gun */}
          {inputSource === "wireless_dongle" && (
            <div className="p-5 rounded-2xl bg-indigo-50/50 border border-indigo-100 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-indigo-900">
                  <Radio className="w-5 h-5 text-indigo-600" />
                  <h4 className="font-extrabold text-sm">Wireless 2.4GHz / Bluetooth Scanner Gun</h4>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-indigo-100 text-indigo-800 text-[10px] font-extrabold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-pulse" />
                  <span>📡 Hands-Free Listening</span>
                </span>
              </div>
              <p className="text-xs text-slate-600 font-medium">
                Works with 2.4GHz RF USB receiver dongles or direct Bluetooth scanner guns. High-speed HID keystroke buffer captures wireless scans automatically hands-free!
              </p>

              <div className="space-y-2">
                <label className="text-[11px] font-extrabold text-slate-700 uppercase tracking-wider block">
                  Scanned Code Input:
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Wireless barcode payload buffer..."
                    value={manualCode}
                    onChange={(e) => setManualCode(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleBarcodeScanned(manualCode);
                      }
                    }}
                    className="flex-1 bg-white border border-indigo-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono font-medium shadow-2xs"
                  />
                  <button
                    onClick={() => handleBarcodeScanned(manualCode)}
                    disabled={loading || !manualCode.trim()}
                    className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer shadow-2xs"
                  >
                    <Search className="w-4 h-4" />
                    Process
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Device Option 3: Pair Store Smartphone Scanner */}
          {inputSource === "phone" && (
            <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 text-center space-y-4 shadow-xs">
              <div className="space-y-1">
                <div className="inline-flex p-3 rounded-2xl bg-teal-50 text-teal-700 border border-teal-200 mb-1">
                  <Smartphone className="w-6 h-6" />
                </div>
                <h4 className="font-extrabold text-[#1E3A5F] text-base">Pair Store Smartphone Scanner</h4>
                <p className="text-xs text-slate-500 font-medium max-w-sm mx-auto">
                  Scan the QR code below using your mobile phone camera to instantly pair your phone as a wireless barcode scanner!
                </p>
              </div>

              {phoneSessionLoading ? (
                <div className="py-8 text-xs font-bold text-slate-500 flex items-center justify-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin text-teal-600" />
                  Generating Pairing QR Code...
                </div>
              ) : phoneQrUrl ? (
                <div className="space-y-3 flex flex-col items-center">
                  <div className="p-3 bg-white border border-slate-200 rounded-2xl shadow-md">
                    <img src={phoneQrUrl} alt="Pairing QR Code" className="w-48 h-48 rounded-xl object-contain" />
                  </div>

                  <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-200 text-slate-700 text-xs font-bold font-mono">
                    <span>Session #{phoneSessionId}</span>
                    <span className="text-slate-400">•</span>
                    <span className={phonePaired ? "text-teal-700 font-black" : "text-amber-600 font-medium animate-pulse"}>
                      {phonePaired ? "🟢 Phone Connected" : "🟡 Waiting for Phone Scan..."}
                    </span>
                  </div>

                  {phoneRemoteUrl && (
                    <p className="text-[11px] text-slate-500">
                      Or open on phone:{" "}
                      <a href={phoneRemoteUrl} target="_blank" rel="noreferrer" className="text-teal-600 underline font-bold">
                        {phoneRemoteUrl}
                      </a>
                    </p>
                  )}
                </div>
              ) : null}
            </div>
          )}

          {/* Device Option 4: Manual / Keyboard Type */}
          {inputSource === "manual" && (
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                <span>Type or Paste Barcode Manually</span>
                <span className="text-[10px] text-slate-500 font-normal">Press Enter or Click Search</span>
              </label>
              <div className="flex gap-2">
                <input
                  ref={manualInputRef}
                  type="text"
                  placeholder="Enter barcode e.g. 8901296060667"
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleBarcodeScanned(manualCode);
                    }
                  }}
                  className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-teal-600 focus:bg-white font-medium"
                />
                <button
                  onClick={() => handleBarcodeScanned(manualCode)}
                  disabled={loading || !manualCode.trim()}
                  className="px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs flex items-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer"
                >
                  <Search className="w-4 h-4" />
                  Search
                </button>
              </div>
            </div>
          )}

          {/* Quick Demo Scan Buttons for Instant Presentation/Submission */}
          <div className="pt-3 border-t border-slate-200 space-y-2">
            <span className="text-[11px] font-extrabold text-[#1E3A5F] flex items-center gap-1.5 uppercase tracking-wider">
              <Zap className="w-3.5 h-3.5 text-amber-500" />
              <span>Quick Test Barcodes (1-Tap Instant Scan):</span>
            </span>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => handleBarcodeScanned("8901296060667")}
                className="px-3.5 py-2 rounded-xl bg-teal-50 hover:bg-teal-100 border border-teal-200 text-teal-800 text-xs font-extrabold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
              >
                <Zap className="w-3.5 h-3.5 text-amber-500 fill-amber-400" />
                <span>Ozenoxacin Lotion (8901296060667)</span>
              </button>

              <button
                type="button"
                onClick={() => handleBarcodeScanned("8901086001234")}
                className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Zap className="w-3.5 h-3.5 text-slate-400" />
                <span>Paracetamol 650mg (8901086001234)</span>
              </button>

              <button
                type="button"
                onClick={handleGenerateInternalBarcode}
                className="px-3.5 py-2 rounded-xl bg-purple-50 hover:bg-purple-100 border border-purple-200 text-purple-800 text-xs font-extrabold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
              >
                <PlusCircle className="w-3.5 h-3.5 text-purple-600" />
                <span>✨ Unbarcoded Item? Auto-Generate Code</span>
              </button>
            </div>
          </div>

          {/* Notifications */}
          {errorMsg && (
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-4 rounded-xl bg-teal-50 border border-teal-200 text-teal-800 text-xs font-semibold space-y-3">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
                <span>{successMsg}</span>
              </div>
              {lastStockedLabelInfo && (
                <div className="pt-2 border-t border-teal-200/60 flex items-center justify-between">
                  <span className="text-[11px] text-teal-700 font-medium">Need a barcode label for this box/drawer?</span>
                  <button
                    type="button"
                    onClick={() => handlePrintLabel(lastStockedLabelInfo)}
                    className="px-3 py-1.5 bg-teal-700 hover:bg-teal-800 text-white rounded-lg text-xs font-extrabold flex items-center gap-1.5 shadow-xs cursor-pointer transition-all"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Print Barcode Sticker</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Check Availability Result View */}
          {mode === "check" && checkResult && (
            <div className="space-y-4 pt-2 border-t border-slate-200">
              {checkResult.notFound ? (
                <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 space-y-3">
                  <div>
                    <h4 className="text-sm font-extrabold text-amber-900 flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-amber-600" />
                      <span>Barcode {checkResult.barcode} Not Registered Yet</span>
                    </h4>
                    <p className="text-xs text-amber-700 font-medium mt-1">
                      This medicine barcode is not in your live stock system yet. Click below to stock in a new delivery for it!
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setCheckResult(null);
                      onSelectMode("stockIn");
                      handleBarcodeScanned(checkResult.barcode);
                    }}
                    className="px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white rounded-xl font-bold text-xs flex items-center gap-2 cursor-pointer shadow-sm transition-all"
                  >
                    <PlusCircle className="w-4 h-4" />
                    <span>Stock In This Barcode Now</span>
                  </button>
                </div>
              ) : (
                <>
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                    <div>
                      <h4 className="text-base font-extrabold text-[#1E3A5F]">{checkResult.medicine.name}</h4>
                      <p className="text-xs text-slate-500 font-medium">
                        Manufacturer: {checkResult.medicine.manufacturer} • Schedule {checkResult.medicine.schedule}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-2xl font-black text-teal-700">{checkResult.totalStock}</span>
                      <span className="block text-[10px] text-slate-500 uppercase tracking-wider font-bold">Total Units</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h5 className="text-xs font-bold text-[#1E3A5F] uppercase tracking-wider">Active Batches Breakdown</h5>
                    {checkResult.batches.length === 0 ? (
                      <p className="text-xs text-slate-500 italic">No active batches available.</p>
                    ) : (
                      <div className="space-y-2">
                        {checkResult.batches.map((b: any) => (
                          <div
                            key={b.id}
                            className="p-3 rounded-xl bg-white border border-slate-200 flex items-center justify-between text-xs"
                          >
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-bold text-[#1E3A5F]">{b.batchNumber}</span>
                                <span className="text-slate-300">•</span>
                                <span className="text-slate-600">Supplier: {b.supplier}</span>
                              </div>
                              <p className="text-slate-500 mt-0.5">Expires: {b.expiryDate}</p>
                            </div>
                            <div className="text-right">
                              <span className="font-bold text-slate-800">{b.quantity} units</span>
                              <span className="block text-[10px] text-slate-500">₹{b.costPrice}/unit</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Stock In Form View */}
          {mode === "stockIn" && (
            <div id="stock-in-form-container" className="space-y-3 pt-2 border-t border-slate-200">
              {/* Select Existing Stock Medicine Dropdown */}
              {existingMeds.length > 0 && (
                <div className="p-3 rounded-2xl bg-white border border-teal-200 space-y-1.5 text-xs shadow-2xs">
                  <label className="block text-[#1E3A5F] font-extrabold text-xs">
                    Choose Existing Medicine from Stock (Auto-Fills All Details):
                  </label>
                  <select
                    value={stockInMedicine?.id || ""}
                    onChange={(e) => {
                      const selectedId = e.target.value;
                      const found = existingMeds.find((m) => m.id.toString() === selectedId);
                      if (found) {
                        setStockInMedicine({
                          id: found.id,
                          name: found.name,
                          manufacturer: found.manufacturer,
                          schedule: found.schedule,
                          barcode: found.barcode,
                          unitPrice: found.unitPrice,
                          isNew: false,
                        });
                      }
                    }}
                    className="w-full bg-slate-50 border border-teal-300 rounded-xl px-3 py-2 text-slate-800 font-bold text-xs focus:outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer"
                  >
                    <option value="">-- Or Choose Stock Medicine to Add Batch --</option>
                    {existingMeds.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} • {m.manufacturer} (Schedule {m.schedule})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Dedicated Stock In Details Popup Modal */}
      {stockInMedicine && (
        <div className="fixed inset-0 z-[60] bg-slate-900/70 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-lg p-6 space-y-5 shadow-2xl overflow-y-auto max-h-[90vh]">
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-teal-50 text-teal-700 border border-teal-200">
                  <Boxes className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-extrabold text-[#1E3A5F]">Enter Stock Batch Details</h3>
                  <p className="text-xs text-slate-500 font-medium font-mono">
                    Scanned Barcode: {stockInMedicine.barcode || "Manual Non-Barcoded"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setStockInMedicine(null)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleStockInSubmit} className="space-y-4">
              <div className="p-3.5 rounded-2xl bg-teal-50 border border-teal-200 space-y-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-teal-800 bg-teal-100 px-2 py-0.5 rounded border border-teal-200">
                    {stockInMedicine.isNew ? "✨ New Medicine Entry" : "✓ Existing Stock Medicine"}
                  </span>
                </div>
                <div>
                  {stockInMedicine.isNew ? (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <div className="sm:col-span-2">
                        <label className="block text-slate-700 font-bold text-xs mb-1">Enter Medicine Name *</label>
                        <input
                          type="text"
                          value={newMedicineName}
                          onChange={(e) => {
                            const val = e.target.value;
                            setNewMedicineName(val);
                            setNewMedicineSchedule(autoClassifySchedule(val));
                          }}
                          placeholder="e.g. Paracetamol 500mg, Amoxicillin..."
                          required
                          className="w-full bg-white border border-teal-300 rounded-lg px-3 py-1.5 text-slate-800 font-bold text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-700 font-bold text-xs mb-1">Drug Schedule</label>
                        <select
                          value={newMedicineSchedule}
                          onChange={(e) => setNewMedicineSchedule(e.target.value)}
                          className="w-full bg-white border border-teal-300 rounded-lg px-2 py-1.5 text-slate-800 font-bold text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
                        >
                          <option value="OTC">OTC (Over The Counter)</option>
                          <option value="H">Schedule H</option>
                          <option value="H1">Schedule H1</option>
                          <option value="X">Schedule X</option>
                        </select>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <p className="font-extrabold text-[#1E3A5F] text-base">{stockInMedicine.name}</p>
                      <p className="text-slate-500 text-[11px] font-medium">
                        Manufacturer: {stockInMedicine.manufacturer} • Schedule {stockInMedicine.schedule}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block text-slate-700 mb-1 font-bold">1. Batch Number *</label>
                  <input
                    type="text"
                    value={batchNumber}
                    onChange={(e) => setBatchNumber(e.target.value)}
                    placeholder="e.g. BATCH-001"
                    required
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 font-mono font-bold focus:border-teal-600"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 mb-1 font-bold">2. Quantity Received * (Units)</label>
                  <input
                    id="stock-in-quantity-input"
                    type="number"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    placeholder="Enter units e.g. 50"
                    min="1"
                    required
                    autoFocus
                    className="w-full bg-white border-2 border-teal-500 rounded-xl px-3 py-2 text-slate-900 focus:border-teal-600 font-extrabold shadow-xs"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 mb-1 font-bold">3. Expiry Date *</label>
                  <input
                    type="date"
                    value={expiryDate}
                    onChange={(e) => setExpiryDate(e.target.value)}
                    required
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:border-teal-600 font-medium"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 mb-1 font-bold">4. Supplier Name *</label>
                  <input
                    type="text"
                    list="scanner-supplier-list"
                    value={supplier}
                    onChange={(e) => setSupplier(e.target.value)}
                    placeholder="e.g. Apex Pharma Wholesaler"
                    required
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:border-teal-600 font-medium"
                  />
                  <datalist id="scanner-supplier-list">
                    <option value="Sun Pharma Wholesaler" />
                    <option value="Cipla Healthcare Wholesaler" />
                    <option value="Apex Pharma Distributors" />
                    <option value="Apollo Wholesale Agency" />
                    <option value="MedPlus Regional Distribution" />
                  </datalist>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 mb-1 font-bold text-xs">5. Cost Price Per Unit (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  value={costPrice}
                  onChange={(e) => setCostPrice(e.target.value)}
                  placeholder="e.g. 45.50"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 text-xs focus:border-teal-600 font-medium"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setStockInMedicine(null)}
                  className="w-1/3 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-2/3 py-3 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer disabled:opacity-50"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>{loading ? "Saving..." : "Complete Stock In & Save"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
