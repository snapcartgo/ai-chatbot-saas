"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";

export default function OrdersPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [channelFilter, setChannelFilter] = useState("all");

  // Modals & form state
  const [trackingModal, setTrackingModal] = useState<any | null>(null);
  const [manualModalOrder, setManualModalOrder] = useState<any | null>(null);
  const [manualForm, setManualForm] = useState({
    courierName: "India Post / Speed Post",
    trackingNumber: "",
    trackingUrl: "",
  });
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const loadOrders = useCallback(async () => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData?.session?.user;

      let query = supabase.from("orders").select("*").order("created_at", { ascending: false });

      if (user?.id) {
        query = query.eq("user_id", user.id);
      }

      const { data: ordersData, error } = await query;

      if (error) {
        console.error("Error loading orders:", error);
        setErrorMsg(`Failed to fetch orders: ${error.message}`);
        return;
      }

      setOrders(ordersData || []);
    } catch (err: any) {
      console.error("Orders load exception:", err);
      setErrorMsg(err.message || "Failed to load orders");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const handleApprove = async (orderId: string) => {
    const confirmApprove = confirm("Mark this order as Paid / Approved?");
    if (!confirmApprove) return;

    setUpdatingId(orderId);
    setErrorMsg(null);
    setSuccessMsg(null);

    const { error } = await supabase
      .from("orders")
      .update({
        payment_status: "Paid",
        order_status: "Approved",
        updated_at: new Date().toISOString(),
      })
      .eq("id", orderId);

    if (error) {
      setErrorMsg(`Supabase Error: ${error.message}`);
    } else {
      setOrders((prev) =>
        prev.map((o) =>
          o.id === orderId
            ? { ...o, payment_status: "Paid", order_status: "Approved" }
            : o
        )
      );
      setSuccessMsg("Order marked as Paid & Approved successfully!");
    }
    setUpdatingId(null);
  };

  const handleShiprocketFulfill = async (orderId: string) => {
    setUpdatingId(orderId);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await fetch(`/api/orders/${orderId}/shiprocket`, {
        method: "POST",
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || "Failed to create shipment on Shiprocket");
      }

      const shipment = data.shipment;
      const awb = shipment?.awb_code || shipment?.shipment_id || shipment?.shiprocket_order_id;

      setOrders((prev) =>
        prev.map((o) =>
          o.id === orderId
            ? {
                ...o,
                delivery_partner: "Shiprocket",
                courier_name: shipment?.courier_name || "Shiprocket",
                shipment_id: shipment?.shipment_id || o.shipment_id,
                awb_number: shipment?.awb_code || o.awb_number,
                tracking_number: awb,
                shipment_status: "Shipment Created",
              }
            : o
        )
      );

      setSuccessMsg(`Shipment created successfully! AWB: ${awb || "Assigned"}`);
      await loadOrders();
    } catch (err: any) {
      setErrorMsg(err.message || "Error communicating with Shiprocket");
    } finally {
      setUpdatingId(null);
    }
  };

  const handleManualFulfillSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualModalOrder) return;

    setUpdatingId(manualModalOrder.id);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await fetch(
        `/api/orders/${manualModalOrder.id}/manual-fulfill`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(manualForm),
        }
      );
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || "Failed to update order fulfillment");
      }

      setOrders((prev) =>
        prev.map((o) =>
          o.id === manualModalOrder.id
            ? {
                ...o,
                delivery_partner: manualForm.courierName,
                courier_name: manualForm.courierName,
                tracking_number: manualForm.trackingNumber,
                awb_number: manualForm.trackingNumber,
                tracking_url: manualForm.trackingUrl,
                shipment_status: "Shipped",
              }
            : o
        )
      );

      setManualModalOrder(null);
      setManualForm({
        courierName: "India Post / Speed Post",
        trackingNumber: "",
        trackingUrl: "",
      });
      setSuccessMsg("Manual shipping details saved successfully!");
      await loadOrders();
    } catch (err: any) {
      setErrorMsg(err.message || "Error updating order");
    } finally {
      setUpdatingId(null);
    }
  };

  const handleTrack = async (order: any) => {
    const trackingCode = order.awb_number || order.tracking_number || order.shipment_id;

    if (order.delivery_partner?.toLowerCase() === "shiprocket") {
      setUpdatingId(order.id);
      try {
        const res = await fetch(`/api/orders/${order.id}/track`);
        const data = await res.json();
        if (data.success && data.tracking) {
          setTrackingModal(data.tracking);
        } else {
          window.open(
            order.tracking_url || `https://shiprocket.co/tracking/${trackingCode}`,
            "_blank"
          );
        }
      } catch {
        window.open(
          order.tracking_url || `https://shiprocket.co/tracking/${trackingCode}`,
          "_blank"
        );
      } finally {
        setUpdatingId(null);
      }
    } else {
      if (order.tracking_url) {
        window.open(order.tracking_url, "_blank");
      } else {
        alert(
          `Courier: ${order.courier_name || order.delivery_partner || "N/A"}\nTracking Number: ${trackingCode || "N/A"}`
        );
      }
    }
  };

  const filteredOrders =
    channelFilter === "all"
      ? orders
      : orders.filter((order) => (order.channel || "website") === channelFilter);

  const getPaymentStyles = (status: string) => {
    switch (status?.toLowerCase()) {
      case "paid":
        return "bg-green-100 text-green-700 border border-green-200";
      case "cod":
        return "bg-amber-100 text-amber-700 border border-amber-200";
      case "refunded":
        return "bg-purple-100 text-purple-700 border border-purple-200";
      default:
        return "bg-yellow-100 text-yellow-700 border border-yellow-200";
    }
  };

  const getOrderStatusStyles = (status: string) => {
    switch (status?.toLowerCase()) {
      case "canceled":
      case "cancelled":
        return "bg-red-100 text-red-700 border border-red-200";
      case "delivered":
        return "bg-emerald-100 text-emerald-700 border border-emerald-200";
      case "in_transit":
      case "shipped":
        return "bg-indigo-100 text-indigo-700 border border-indigo-200";
      default:
        return "bg-blue-100 text-blue-700 border border-blue-200";
    }
  };

  if (loading) return <p className="p-6 text-sm text-gray-600 bg-white">Loading orders...</p>;

  return (
    <div className="bg-white min-h-screen p-4 md:p-6 w-full max-w-7xl mx-auto text-gray-900">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Order Management</h1>
        <div className="flex gap-3 items-center">
          <select
            value={channelFilter}
            onChange={(e) => setChannelFilter(e.target.value)}
            className="border border-gray-300 rounded px-3 py-2 text-sm bg-white text-gray-900"
          >
            <option value="all">All Channels</option>
            <option value="website">Website</option>
            <option value="whatsapp">WhatsApp</option>
          </select>
          <button onClick={loadOrders} className="text-sm font-medium text-blue-600 hover:underline">
            Refresh Data
          </button>
        </div>
      </div>

      {successMsg && (
        <div className="mb-6 p-4 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg text-sm flex justify-between items-center">
          <span>{successMsg}</span>
          <button onClick={() => setSuccessMsg(null)} className="text-emerald-700 font-bold ml-4 text-base">
            ×
          </button>
        </div>
      )}

      {errorMsg && (
        <div className="mb-6 p-4 bg-red-50 text-red-700 border border-red-200 rounded-lg text-sm flex justify-between items-center">
          <div>
            <span className="font-semibold">Fulfillment Notice: </span>
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg(null)} className="text-red-500 font-bold ml-4 text-base">
            ×
          </button>
        </div>
      )}

      <div className="overflow-x-auto border border-gray-200 rounded-lg bg-white shadow-sm">
        <table className="min-w-[1300px] w-full text-sm text-left text-gray-900">
          <thead className="bg-gray-50 text-gray-600 font-medium border-b border-gray-200">
            <tr>
              <th className="p-4">Order ID</th>
              <th className="p-4">Customer</th>
              <th className="p-4">Phone</th>
              <th className="p-4">Address / Pincode</th>
              <th className="p-4">Product</th>
              <th className="p-4">Amount</th>
              <th className="p-4">Payment</th>
              <th className="p-4">Order Status</th>
              <th className="p-4">Delivery</th>
              <th className="p-4">Channel</th>
              <th className="p-4 text-center">Action</th>
              <th className="p-4">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {filteredOrders.map((order) => {
              const payStatus = order.payment_status || "Pending";
              const orderStatus = order.order_status || "Active";
              const isPaid = payStatus.toLowerCase() === "paid";
              const isCanceled =
                orderStatus.toLowerCase() === "canceled" ||
                orderStatus.toLowerCase() === "cancelled";

              const hasShipment = Boolean(
                order.delivery_partner ||
                  order.shipment_id ||
                  order.awb_number ||
                  order.tracking_number
              );

              const trackingCode =
                order.awb_number ||
                order.tracking_number ||
                order.shipment_id;

              const displayPhone =
                order.phone !== undefined && order.phone !== null
                  ? String(order.phone)
                  : order.phone_number || "—";

              const orderIdDisplay = order.id || order.session_id || "—";

              const fullAddress = [
                order.address || order.shipping_address,
                order.city,
                order.state,
                order.pincode
              ].filter(Boolean).join(", ");

              return (
                <tr key={order.id} className="hover:bg-gray-50 bg-white">
                  <td className="p-4 font-mono text-xs text-blue-600 font-medium whitespace-nowrap">
                    {orderIdDisplay}
                  </td>

                  <td className="p-4">
                    <div className="font-medium text-gray-900">{order.name || order.customer_name || "Customer"}</div>
                    <div className="text-gray-500 text-xs">{order.customer_email || order.email || "—"}</div>
                  </td>

                  <td className="p-4 text-gray-700 font-mono text-xs whitespace-nowrap">
                    {displayPhone}
                  </td>

                  {/* Shipping Address Column */}
                  {/* With this: */}
<td className="p-4 min-w-[220px] max-w-[320px]">
  <div className="text-xs text-gray-800 leading-relaxed break-words">
    {fullAddress ? (
      <>
        <span>{fullAddress}</span>
        {order.pincode && (
          <span className="block font-mono text-[11px] text-gray-500 font-semibold mt-0.5">
            PIN: {order.pincode}
          </span>
        )}
      </>
    ) : (
      <span className="text-gray-400 italic">Not Provided</span>
    )}
  </div>
</td>

                  <td className="p-4 text-gray-900">{order.product_name || "Store Item"}</td>
                  <td className="p-4 font-bold text-gray-900">₹{order.price || order.amount || 0}</td>

                  {/* Payment Status Badge */}
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${getPaymentStyles(payStatus)}`}>
                      {payStatus}
                    </span>
                  </td>

                  {/* Order Status Badge */}
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${getOrderStatusStyles(orderStatus)}`}>
                      {orderStatus}
                    </span>
                  </td>

                  {/* Delivery Status Column */}
                  <td className="p-4">
                    {!hasShipment ? (
                      <span className="text-xs text-gray-400 font-medium">Not Created</span>
                    ) : (
                      <div className="space-y-0.5">
                        <div className="text-xs font-semibold text-blue-600">
                          {order.delivery_partner || "Shiprocket"}
                        </div>
                        {trackingCode && (
                          <div className="text-[11px] font-mono text-gray-600">
                            AWB: <strong>{trackingCode}</strong>
                          </div>
                        )}
                        <div className="text-[11px] text-gray-400">
                          {order.shipment_status || "Created"}
                        </div>
                      </div>
                    )}
                  </td>

                  <td className="p-4">
                    <span className="px-2 py-1 rounded bg-gray-100 text-xs text-gray-700">
                      {order.channel || "whatsapp"}
                    </span>
                  </td>

                  {/* Action Column */}
                  <td className="p-4 text-center">
                    {isCanceled && isPaid ? (
                      <div className="text-purple-600 font-bold flex flex-col leading-tight text-xs">
                        <span>✕ Canceled</span>
                        <span className="text-[10px] text-gray-500 font-normal mt-0.5">(Needs Refund)</span>
                      </div>
                    ) : isCanceled ? (
                      <span className="text-red-500 font-medium italic text-xs">✕ Canceled</span>
                    ) : hasShipment ? (
                      <button
                        onClick={() => handleTrack(order)}
                        disabled={updatingId === order.id}
                        className="bg-gray-100 hover:bg-gray-200 text-gray-800 px-3 py-1.5 rounded text-xs font-medium transition"
                      >
                        {updatingId === order.id ? "Tracking..." : "Track Order"}
                      </button>
                    ) : (
                      <div className="flex items-center justify-center gap-1.5 flex-wrap">
                        {!isPaid && orderStatus.toLowerCase() !== "approved" && (
                          <button
                            onClick={() => handleApprove(order.id)}
                            disabled={updatingId === order.id}
                            className="bg-blue-600 text-white px-2.5 py-1 rounded text-xs hover:bg-blue-700 transition"
                          >
                            Approve
                          </button>
                        )}
                        <button
                          onClick={() => handleShiprocketFulfill(order.id)}
                          disabled={updatingId === order.id}
                          className="bg-purple-600 hover:bg-purple-700 text-white px-2.5 py-1 rounded text-xs font-medium transition disabled:opacity-50"
                        >
                          {updatingId === order.id ? "..." : "Shiprocket"}
                        </button>
                        <button
                          onClick={() => setManualModalOrder(order)}
                          disabled={updatingId === order.id}
                          className="bg-white hover:bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs transition border border-gray-300"
                        >
                          Self-Ship
                        </button>
                      </div>
                    )}
                  </td>

                  <td className="p-4 text-gray-500 text-xs whitespace-nowrap">
                    {order.created_at ? new Date(order.created_at).toLocaleDateString() : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Manual / Multi-Carrier Modal */}
      {manualModalOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl text-gray-900">
            <h3 className="text-lg font-bold text-gray-900 mb-1">
              Fulfill via Other Carrier / Dropshipper
            </h3>
            <p className="text-xs text-gray-500 mb-4">
              Select the courier or supplier you used to ship this order.
            </p>

            <form onSubmit={handleManualFulfillSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Delivery Platform / Courier
                </label>
                <select
                  value={manualForm.courierName}
                  onChange={(e) =>
                    setManualForm({ ...manualForm, courierName: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-gray-900"
                >
                  <option value="India Post / Speed Post">India Post / Speed Post</option>
                  <option value="Blue Dart">Blue Dart</option>
                  <option value="Delhivery">Delhivery Direct</option>
                  <option value="DTDC">DTDC</option>
                  <option value="External Dropshipper">External Dropshipper / Supplier</option>
                  <option value="Self Delivery">Self / Local Delivery</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Tracking / Consignment Number
                </label>
                <input
                  type="text"
                  required
                  value={manualForm.trackingNumber}
                  onChange={(e) =>
                    setManualForm({
                      ...manualForm,
                      trackingNumber: e.target.value,
                    })
                  }
                  placeholder="e.g. EM123456789IN or BLUEDART1234"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-gray-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Tracking URL (Optional)
                </label>
                <input
                  type="url"
                  value={manualForm.trackingUrl}
                  onChange={(e) =>
                    setManualForm({ ...manualForm, trackingUrl: e.target.value })
                  }
                  placeholder="https://..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-gray-900"
                />
              </div>

              <div className="flex space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setManualModalOrder(null)}
                  className="flex-1 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updatingId === manualModalOrder.id}
                  className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                >
                  Save & Fulfill
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Live Tracking Modal */}
      {trackingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl text-gray-900">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Shipment Tracking</h3>
            <div className="text-sm space-y-2 mb-4">
              <p>
                <span className="text-gray-500">AWB:</span>{" "}
                <span className="font-mono font-medium text-gray-900">{trackingModal.awb || trackingModal.tracking_number}</span>
              </p>
              <p>
                <span className="text-gray-500">Courier:</span>{" "}
                <span className="font-medium text-gray-900">{trackingModal.courier || trackingModal.courier_name || "Shiprocket"}</span>
              </p>
              <p>
                <span className="text-gray-500">Status:</span>{" "}
                <span className="inline-block px-2 py-0.5 rounded text-xs bg-blue-100 text-blue-800 font-semibold">
                  {trackingModal.status || "In Transit"}
                </span>
              </p>
            </div>
            {trackingModal.tracking_url && (
              <a
                href={trackingModal.tracking_url}
                target="_blank"
                rel="noreferrer"
                className="block text-center w-full py-2 bg-blue-600 text-white rounded-lg text-sm font-medium mb-2 hover:bg-blue-700 transition"
              >
                Open Official Tracking Page
              </a>
            )}
            <button
              onClick={() => setTrackingModal(null)}
              className="w-full py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}