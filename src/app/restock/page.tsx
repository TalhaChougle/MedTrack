"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  RefreshCw,
  PlusCircle,
  CheckCircle2,
  AlertTriangle,
  Truck,
  X,
} from "lucide-react";

export default function RestockOrdersPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [restockItems, setRestockItems] = useState<any[]>([]);
  const [ordersList, setOrdersList] = useState<any[]>([]);
  const [medicinesList, setMedicinesList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Log Order Modal State
  const [createOrderOpen, setCreateOrderOpen] = useState(false);
  const [newOrderData, setNewOrderData] = useState({
    medicineId: "",
    expectedQuantity: "",
    expectedArrivalDate: "",
    supplier: "",
  });

  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    } else if (status === "authenticated") {
      fetchRestockData();
    }
  }, [status, router]);

  const fetchRestockData = async () => {
    setLoading(true);
    try {
      const [restockRes, ordersRes, medRes] = await Promise.all([
        fetch("/api/restock-status"),
        fetch("/api/incoming-orders"),
        fetch("/api/medicines"),
      ]);

      if (restockRes.ok) setRestockItems(await restockRes.json());
      if (ordersRes.ok) setOrdersList(await ordersRes.json());
      if (medRes.ok) setMedicinesList(await medRes.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // Submit new order
  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      const res = await fetch("/api/incoming-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newOrderData),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data.error || "Failed to log incoming order.");
      } else {
        setSuccessMsg("Incoming order logged successfully!");
        setCreateOrderOpen(false);
        setNewOrderData({
          medicineId: "",
          expectedQuantity: "",
          expectedArrivalDate: "",
          supplier: "",
        });
        fetchRestockData();
      }
    } catch (err: any) {
      setErrorMsg("Network error creating order.");
    } finally {
      setActionLoading(false);
    }
  };

  // Mark Order as Arrived or Delayed
  const handleUpdateStatus = async (orderId: number, newStatus: string) => {
    setActionLoading(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      const res = await fetch("/api/incoming-orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: orderId, status: newStatus }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data.error || "Failed to update order status.");
      } else {
        setSuccessMsg(`Order status updated to '${newStatus}'!`);
        fetchRestockData();
      }
    } catch (err: any) {
      setErrorMsg("Network error updating order status.");
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-8 pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#1E3A5F] tracking-tight flex items-center gap-3">
            <RefreshCw className="w-8 h-8 text-teal-600" />
            <span>Restock & Incoming Order Tracker</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 font-medium">
            Monitor low-stock items below threshold and track expected distributor shipments.
          </p>
        </div>

        <button
          onClick={() => {
            setErrorMsg("");
            setSuccessMsg("");
            setCreateOrderOpen(true);
          }}
          className="px-4 py-2.5 rounded-2xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer"
        >
          <PlusCircle className="w-4 h-4" />
          <span>Log Incoming Delivery Order</span>
        </button>
      </div>

      {/* Notifications */}
      {errorMsg && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-4 rounded-2xl bg-teal-50 border border-teal-200 text-teal-800 text-xs font-semibold flex items-start gap-2">
          <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Two Section Layout: Low Stock Medicines & Incoming Deliveries */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Section 1: Low Stock Alert Items */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-extrabold text-[#1E3A5F] flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
              <span>Low-Stock Medicines ({restockItems.length})</span>
            </h2>
            <span className="text-xs text-slate-500 font-medium">Stock &lt; Reorder Threshold</span>
          </div>

          <div className="bg-white border border-slate-200 rounded-3xl p-5 space-y-3 shadow-xs">
            {loading ? (
              <p className="text-xs text-slate-500 text-center py-6 font-bold">Checking stock levels...</p>
            ) : restockItems.length === 0 ? (
              <div className="py-8 text-center space-y-2">
                <CheckCircle2 className="w-10 h-10 text-teal-600 mx-auto" />
                <p className="text-sm font-bold text-[#1E3A5F]">Stock Levels Healthy!</p>
                <p className="text-xs text-slate-500">All registered medicines are above reorder thresholds.</p>
              </div>
            ) : (
              restockItems.map((item) => (
                <div
                  key={item.id}
                  className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2 text-xs"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-extrabold text-[#1E3A5F] text-sm">{item.name}</h3>
                      <p className="text-slate-500 font-medium">Manufacturer: {item.manufacturer}</p>
                    </div>

                    <span
                      className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                        item.status === "order_pending"
                          ? "bg-teal-100 text-teal-800 border border-teal-200"
                          : "bg-rose-100 text-rose-800 border border-rose-200"
                      }`}
                    >
                      {item.status === "order_pending" ? "Order Pending" : "Needs Reorder"}
                    </span>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-200 text-[11px] font-medium">
                    <div>
                      <span className="text-slate-500">Current Total Stock: </span>
                      <span className="font-bold text-rose-600 text-sm">{item.totalStock} units</span>
                    </div>
                    <div>
                      <span className="text-slate-500">Reorder Threshold: </span>
                      <span className="font-semibold text-slate-700">{item.reorderThreshold} units</span>
                    </div>
                  </div>

                  {item.pendingOrders.length > 0 && (
                    <div className="pt-2 border-t border-slate-200 space-y-1">
                      <p className="text-[10px] font-extrabold text-teal-800 uppercase">Pending Shipment:</p>
                      {item.pendingOrders.map((po: any) => (
                        <p key={po.id} className="text-[11px] text-slate-700 font-medium">
                          {po.expectedQuantity} units from {po.supplier} (ETA: {po.expectedArrivalDate})
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Section 2: All Incoming Deliveries */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-extrabold text-[#1E3A5F] flex items-center gap-2">
              <Truck className="w-5 h-5 text-teal-600" />
              <span>Incoming Distributor Shipments ({ordersList.length})</span>
            </h2>
          </div>

          <div className="bg-white border border-slate-200 rounded-3xl p-5 space-y-3 shadow-xs">
            {loading ? (
              <p className="text-xs text-slate-500 text-center py-6 font-bold">Loading orders...</p>
            ) : ordersList.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-8 font-medium">No incoming orders logged.</p>
            ) : (
              ordersList.map((order) => {
                const isPending = order.status === "pending";
                const isArrived = order.status === "arrived";
                const isDelayed = order.status === "delayed";

                return (
                  <div
                    key={order.id}
                    className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2 text-xs"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-extrabold text-[#1E3A5F] text-sm">{order.medicineName}</h3>
                        <p className="text-slate-500 font-medium">Supplier: {order.supplier}</p>
                      </div>

                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-extrabold ${
                          isArrived
                            ? "bg-teal-100 text-teal-800 border border-teal-200"
                            : isDelayed
                            ? "bg-rose-100 text-rose-800 border border-rose-200"
                            : "bg-amber-100 text-amber-800 border border-amber-200"
                        }`}
                      >
                        {order.status.toUpperCase()}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[11px] py-1 text-slate-700 font-medium">
                      <div>
                        <span className="text-slate-500">Expected Qty: </span>
                        <span className="font-bold text-slate-800">{order.expectedQuantity} units</span>
                      </div>
                      <div>
                        <span className="text-slate-500">Arrival Date: </span>
                        <span className="font-bold text-[#1E3A5F]">{order.expectedArrivalDate}</span>
                      </div>
                    </div>

                    {isPending && (
                      <div className="flex gap-2 pt-2 border-t border-slate-200">
                        <button
                          onClick={() => handleUpdateStatus(order.id, "arrived")}
                          disabled={actionLoading}
                          className="px-3 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-[11px] font-bold transition-colors cursor-pointer"
                        >
                          Mark as Arrived
                        </button>
                        <button
                          onClick={() => handleUpdateStatus(order.id, "delayed")}
                          disabled={actionLoading}
                          className="px-3 py-1.5 rounded-xl bg-rose-100 hover:bg-rose-200 text-rose-700 text-[11px] font-bold border border-rose-200 transition-colors cursor-pointer"
                        >
                          Mark Delayed
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Modal: Log New Order */}
      {createOrderOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-md p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-base font-extrabold text-[#1E3A5F]">Log Expected Distributor Delivery</h3>
              <button onClick={() => setCreateOrderOpen(false)} className="text-slate-400 hover:text-slate-700 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateOrder} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 font-bold mb-1">Select Medicine *</label>
                <select
                  required
                  value={newOrderData.medicineId}
                  onChange={(e) => setNewOrderData({ ...newOrderData, medicineId: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-800 focus:border-teal-600 font-semibold"
                >
                  <option value="">-- Choose Medicine --</option>
                  {medicinesList.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.manufacturer})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Expected Quantity *</label>
                <input
                  type="number"
                  required
                  min="1"
                  placeholder="e.g. 200"
                  value={newOrderData.expectedQuantity}
                  onChange={(e) => setNewOrderData({ ...newOrderData, expectedQuantity: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-800 focus:border-teal-600 font-bold"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Expected Arrival Date (YYYY-MM-DD) *</label>
                <input
                  type="date"
                  required
                  value={newOrderData.expectedArrivalDate}
                  onChange={(e) => setNewOrderData({ ...newOrderData, expectedArrivalDate: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-800 focus:border-teal-600 font-medium"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Distributor / Supplier Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Sun Pharma Wholesaler"
                  value={newOrderData.supplier}
                  onChange={(e) => setNewOrderData({ ...newOrderData, supplier: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-800 focus:border-teal-600 font-medium"
                />
              </div>

              <button
                type="submit"
                disabled={actionLoading}
                className="w-full py-3 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-md cursor-pointer"
              >
                Save Order Record
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
