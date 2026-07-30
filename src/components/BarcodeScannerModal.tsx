"use client";

import { useEffect, useState, useRef } from "react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import {
  X,
  QrCode,
  Boxes,
  Search,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Smartphone,
  Camera,
  Keyboard,
  RefreshCw,
  Zap,
  PlusCircle,
} from "lucide-react";

interface BarcodeScannerModalProps {
  mode: "check" | "stockIn";
  onClose: () => void;
  onSelectMode: (mode: "check" | "stockIn") => void;
}

export default function BarcodeScannerModal({
  mode,
  onClose,
  onSelectMode,
}: BarcodeScannerModalProps) {
  // Input source choice: "webcam" (Direct Camera), "phone" (Method A QR Pair), "manual" (USB Gun/Type)
  const [inputSource, setInputSource] = useState<"webcam" | "phone" | "manual">("webcam");

  const [manualCode, setManualCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [cameraPermissionError, setCameraPermissionError] = useState(false);

  const [checkResult, setCheckResult] = useState<any>(null);
  const [stockInMedicine, setStockInMedicine] = useState<any>(null);

  const [batchNumber, setBatchNumber] = useState("");
  const [quantity, setQuantity] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [supplier, setSupplier] = useState("");
  const [costPrice, setCostPrice] = useState("");
  const [newMedicineName, setNewMedicineName] = useState("");

  // Phone Pairing State (Method A)
  const [phoneSessionId, setPhoneSessionId] = useState<string | null>(null);
  const [phoneQrUrl, setPhoneQrUrl] = useState<string | null>(null);
  const [phoneRemoteUrl, setPhoneRemoteUrl] = useState<string | null>(null);
  const [phonePaired, setPhonePaired] = useState(false);
  const [phoneSessionLoading, setPhoneSessionLoading] = useState(false);

  // Camera device selection state
  const [availableCameras, setAvailableCameras] = useState<{ deviceId: string; label: string }[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>("");

  const html5QrcodeRef = useRef<Html5Qrcode | null>(null);
  const isScanningRef = useRef<boolean>(false);
  const runningCameraIdRef = useRef<string>("");
  const lastScannedCodeRef = useRef<string>("");
  const manualInputRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

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

  // Auto focus manual input when manual/USB tab is active
  useEffect(() => {
    if (inputSource === "manual") {
      manualInputRef.current?.focus();
    }
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

  const handleBarcodeScanned = async (scannedCode: string) => {
    const code = scannedCode.trim();
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
          setNewMedicineName(data.medicine?.name || "");
          setBatchNumber(data.suggestedBatchNumber || "BATCH-001");
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
        setStockInMedicine(null);
        setNewMedicineName("");
        setBatchNumber("");
        setQuantity("");
        setExpiryDate("");
        setSupplier("");
        setCostPrice("");
      }
    } catch (err: any) {
      setErrorMsg("Failed to submit stock in entry.");
    } finally {
      setLoading(false);
    }
  };

  // Helper to safely stop the scanner/camera
  const stopAllStreams = async () => {
    runningCameraIdRef.current = "";
    isScanningRef.current = false;
    if (html5QrcodeRef.current) {
      const instance = html5QrcodeRef.current;
      html5QrcodeRef.current = null;
      try {
        await instance.stop();
      } catch (e) {}
      try {
        instance.clear();
      } catch (e) {}
    }
  };

  // Switch camera explicitly when selected in dropdown
  const handleCameraChange = (newCamId: string) => {
    setSelectedCameraId(newCamId);
    startWebcam(newCamId);
  };

  // 🎥 Direct Webcam Barcode Detection & Video Stream Setup
  const startWebcam = async (camIdToUse?: string) => {
    setCameraPermissionError(false);
    setErrorMsg("");

    await stopAllStreams();

    const readerContainer = document.getElementById("reader");
    if (!readerContainer) return;
    readerContainer.innerHTML = "";

    try {
      // Initialize Html5Qrcode with explicit 1D + 2D barcode format support
      const html5Qrcode = new Html5Qrcode("reader", {
        formatsToSupport: [
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
          Html5QrcodeSupportedFormats.QR_CODE,
          Html5QrcodeSupportedFormats.DATA_MATRIX,
        ],
        experimentalFeatures: {
          useBarCodeDetectorIfSupported: true,
        },
        verbose: false,
      } as any);

      html5QrcodeRef.current = html5Qrcode;

      const activeId = camIdToUse || selectedCameraId;
      const cameraTarget: any =
        activeId && activeId.trim().length > 0 ? activeId.trim() : { facingMode: "environment" };

      await html5Qrcode.start(
        cameraTarget,
        {
          fps: 25,
          qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
            const minDim = Math.min(viewfinderWidth || 320, viewfinderHeight || 240);
            const w = Math.max(Math.floor(minDim * 0.85), 250);
            return { width: Math.min(w, 340), height: Math.min(Math.floor(w * 0.5), 170) };
          },
          videoConstraints: {
            width: { ideal: 1920, min: 1280 },
            height: { ideal: 1080, min: 720 },
          },
          aspectRatio: 1.777778,
        },
        (decodedText: string) => {
          handleBarcodeScanned(decodedText);
        },
        () => {}
      );

      isScanningRef.current = true;
      if (typeof activeId === "string" && activeId) {
        runningCameraIdRef.current = activeId;
      }

      // Query available camera devices AFTER permission is granted & stream is running
      try {
        const cams = await Html5Qrcode.getCameras();
        if (cams && cams.length > 0) {
          setAvailableCameras(
            cams.map((c) => ({ deviceId: c.id, label: c.label || `Camera (${c.id.slice(0, 6)})` }))
          );
          if (!selectedCameraId) {
            const integratedCam = cams.find((c) =>
              /integrated|internal|built-in|facetime|webcam|front/i.test(c.label)
            );
            const defaultId = integratedCam ? integratedCam.id : cams[0].id;
            setSelectedCameraId(defaultId);
            runningCameraIdRef.current = defaultId;
          }
        }
      } catch (e) {}
    } catch (err: any) {
      console.warn("Webcam start error:", err);
      isScanningRef.current = false;
      const errStr = String(err?.message || err);
      if (
        errStr.includes("NotAllowedError") ||
        errStr.includes("Permission") ||
        err?.name === "NotAllowedError"
      ) {
        setCameraPermissionError(true);
        setErrorMsg("Camera access denied. Please click the lock icon 🔒 in your browser address bar to allow camera access.");
      } else if (errStr.includes("NotReadableError") || err?.name === "NotReadableError") {
        setErrorMsg("Webcam is currently in use by another application (Zoom/Teams/Skype). Please close other apps using your camera.");
      } else {
        setCameraPermissionError(true);
      }
    }
  };

  // Image File Upload Fallback Decoder
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setErrorMsg("");

    try {
      const html5Qrcode = html5QrcodeRef.current || new Html5Qrcode("reader");
      const result = await html5Qrcode.scanFileV2(file, true);
      if (result && result.decodedText) {
        handleBarcodeScanned(result.decodedText);
      } else {
        setErrorMsg("No barcode detected in the uploaded image. Please ensure the barcode is clear.");
      }
    } catch (err) {
      setErrorMsg("Could not decode barcode from image file. Try a clearer image or click quick test barcodes below.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (inputSource !== "webcam") {
      stopAllStreams();
      return;
    }

    const timer = setTimeout(() => {
      startWebcam();
    }, 150);

    return () => {
      clearTimeout(timer);
      stopAllStreams();
    };
  }, [inputSource]);

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

  // Poll phone pairing session for remote scans
  useEffect(() => {
    if (inputSource !== "phone" || !phoneSessionId) return;

    let lastSeen = 0;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(
          `/api/scanner/session?sessionId=${phoneSessionId}&since=${lastSeen}`
        );
        if (res.ok) {
          const data = await res.json();
          setPhonePaired(data.paired);
          if (data.newScan) {
            lastSeen = data.newScan.timestamp;
            handleBarcodeScanned(data.newScan.barcode);
          }
        }
      } catch (e) {
        console.warn("Phone scan poll error:", e);
      }
    }, 800);

    return () => clearInterval(interval);
  }, [inputSource, phoneSessionId]);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white border border-slate-200 text-slate-800 rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden my-8">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
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
              stopAllStreams();
              onClose();
            }}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Switcher Tabs */}
        <div className="grid grid-cols-2 p-2 gap-2 bg-slate-100 border-b border-slate-200">
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

        <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
          {/* Scanner Input Device Choice Selector */}
          <div className="space-y-2">
            <label className="text-xs font-extrabold text-[#1E3A5F] uppercase tracking-wider block">
              Choose Scanner Input Device:
            </label>
            <div className="grid grid-cols-3 gap-2 bg-slate-100 p-1 rounded-2xl border border-slate-200">
              <button
                type="button"
                onClick={() => setInputSource("webcam")}
                className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  inputSource === "webcam"
                    ? "bg-white text-[#1E3A5F] shadow-xs border border-slate-200 font-extrabold"
                    : "text-slate-600 hover:bg-white/60"
                }`}
              >
                <Camera className="w-3.5 h-3.5 text-teal-600" />
                <span>Direct Camera</span>
              </button>

              <button
                type="button"
                onClick={() => setInputSource("phone")}
                className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  inputSource === "phone"
                    ? "bg-white text-teal-700 shadow-xs border border-slate-200 font-extrabold"
                    : "text-slate-600 hover:bg-white/60"
                }`}
              >
                <Smartphone className="w-3.5 h-3.5 text-teal-600" />
                <span>Pair Phone (QR)</span>
              </button>

              <button
                type="button"
                onClick={() => setInputSource("manual")}
                className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  inputSource === "manual"
                    ? "bg-white text-[#1E3A5F] shadow-xs border border-slate-200 font-extrabold"
                    : "text-slate-600 hover:bg-white/60"
                }`}
              >
                <Keyboard className="w-3.5 h-3.5 text-slate-500" />
                <span>USB / Manual</span>
              </button>
            </div>
          </div>

          {/* Option 1: Direct HTML5 Laptop Webcam Stream */}
          {inputSource === "webcam" && (
            <div className="space-y-3">
              <div
                className={
                  availableCameras.length > 1
                    ? "flex items-center justify-between gap-2 px-3.5 py-2 rounded-xl bg-slate-100 border border-slate-200 text-xs font-bold text-slate-700"
                    : "hidden"
                }
              >
                <span className="shrink-0 flex items-center gap-1.5 text-[#1E3A5F]">
                  <Camera className="w-3.5 h-3.5 text-teal-600" />
                  <span>Select Webcam:</span>
                </span>
                <select
                  value={selectedCameraId}
                  onChange={(e) => handleCameraChange(e.target.value)}
                  className="bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-slate-800 font-medium text-xs focus:outline-none focus:border-teal-600 max-w-[240px] truncate"
                >
                  {availableCameras.map((cam) => (
                    <option key={cam.deviceId} value={cam.deviceId}>
                      {cam.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="relative rounded-2xl overflow-hidden bg-slate-900 border border-slate-700 h-[240px] flex items-center justify-center shadow-inner">
                <div
                  id="reader"
                  className="w-full h-full [&_video]:!w-full [&_video]:!h-full [&_video]:!object-cover [&_video]:!rounded-2xl [&_canvas]:!hidden [&_img]:!hidden"
                ></div>

                {/* Viewfinder Target Overlay */}
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  <div className="w-[280px] h-[140px] border-2 border-teal-400/80 rounded-xl bg-teal-500/5 shadow-[0_0_15px_rgba(45,212,191,0.2)] flex items-center justify-center relative">
                    <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-teal-300"></div>
                    <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-teal-300"></div>
                    <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-teal-300"></div>
                    <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-teal-300"></div>
                    <div className="w-full h-0.5 bg-teal-400/60 animate-pulse"></div>
                  </div>
                </div>

                {cameraPermissionError && (
                  <div className="absolute inset-0 bg-slate-900/95 p-6 text-center text-amber-300 text-xs font-semibold flex flex-col items-center justify-center gap-3.5 z-10">
                    <AlertCircle className="w-8 h-8 text-amber-400" />
                    <span className="max-w-xs leading-relaxed">
                      Camera access is pending or blocked. Please allow camera access in your browser address bar 🔒 or click below.
                    </span>
                    <button
                      type="button"
                      onClick={() => startWebcam()}
                      className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-xl font-bold text-xs flex items-center gap-2 cursor-pointer shadow-md transition-all"
                    >
                      <Camera className="w-4 h-4" />
                      <span>Request / Retry Webcam</span>
                    </button>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between px-1">
                <span className="text-[11px] text-slate-500 font-medium">Or scan barcode photo file:</span>
                <label className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs">
                  <span>📁 Select Image File</span>
                  <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                </label>
              </div>
            </div>
          )}

          {/* Option 2: Method A - Pair Store Smartphone Scanner */}
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

          {/* Option 3: Manual / USB Scanner Input */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
              <span>Or Type / Paste / USB Scanner Input</span>
              <span className="text-[10px] text-slate-500 font-normal">Press Enter or Search</span>
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
            <div className="p-4 rounded-xl bg-teal-50 border border-teal-200 text-teal-800 text-xs font-semibold flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
              <span>{successMsg}</span>
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
          {mode === "stockIn" && stockInMedicine && (
            <form onSubmit={handleStockInSubmit} className="space-y-4 pt-2 border-t border-slate-200">
              <div className="p-3 rounded-xl bg-teal-50 border border-teal-200 flex items-center justify-between text-xs">
                <div className="flex-1 pr-2">
                  <p className="text-slate-500 font-medium">
                    {stockInMedicine.isNew ? "✨ New Barcoded Item Detected - Name Medicine:" : "Matched Medicine:"}
                  </p>
                  {stockInMedicine.isNew ? (
                    <input
                      type="text"
                      value={newMedicineName}
                      onChange={(e) => setNewMedicineName(e.target.value)}
                      placeholder="e.g. Ozenoxacin Lotion 2% W/V"
                      required
                      className="w-full mt-1 bg-white border border-teal-300 rounded-lg px-3 py-1.5 text-slate-800 font-bold text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                  ) : (
                    <p className="font-bold text-teal-800 text-sm">{stockInMedicine.name}</p>
                  )}
                </div>
                <span className="text-slate-600 text-[11px] font-semibold shrink-0">Barcode: {stockInMedicine.barcode}</span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block text-slate-700 mb-1 font-bold">Batch Number (Auto-Suggested)</label>
                  <input
                    type="text"
                    value={batchNumber}
                    onChange={(e) => setBatchNumber(e.target.value)}
                    placeholder="e.g. BATCH-004"
                    required
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 font-mono focus:border-teal-600"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 mb-1 font-bold">Quantity Received</label>
                  <input
                    type="number"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    placeholder="e.g. 100"
                    min="1"
                    required
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:border-teal-600"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 mb-1 font-bold">Expiry Date (YYYY-MM-DD)</label>
                  <input
                    type="date"
                    value={expiryDate}
                    onChange={(e) => setExpiryDate(e.target.value)}
                    required
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:border-teal-600"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 mb-1 font-bold">Supplier Name</label>
                  <input
                    type="text"
                    value={supplier}
                    onChange={(e) => setSupplier(e.target.value)}
                    placeholder="e.g. Apex Pharma Wholesaler"
                    required
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:border-teal-600 font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 mb-1 font-bold text-xs">Cost Price Per Unit (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  value={costPrice}
                  onChange={(e) => setCostPrice(e.target.value)}
                  placeholder="e.g. 45.50"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 text-xs focus:border-teal-600 font-medium"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer disabled:opacity-50"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Complete Stock In & Register</span>
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
