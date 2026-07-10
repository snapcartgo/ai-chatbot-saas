"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function OrdersPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [channelFilter, setChannelFilter] = useState("all");

  useEffect(() => {
    loadOrders();
  }, []);

  const loadOrders = async () => {
    const { data } = await supabase.auth.getSession();
    const user = data.session?.user;

    if (!user) {
      console.error("User not found");
      return;
    }

    const { data: ordersData, error } = await supabase
      .from("orders")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      return;
    }

    setOrders(ordersData || []);
    setLoading(false);
  };

  const handleApprove = async (orderId: string) => {
    const confirmApprove = confirm("Mark this order as Paid?");
    if (!confirmApprove) return;

    setUpdatingId(orderId);

    const { error } = await supabase
      .from("orders")
      .update({
        payment_status: "Paid",
      })
      .eq("id", orderId);

    if (error) {
      alert(`Supabase Error: ${error.message}`);
      console.error(error);
    } else {
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, payment_status: "Paid" } : o))
      );
      alert("Database updated successfully!");
    }
    setUpdatingId(null);
  };

  const filteredOrders =
    channelFilter === "all"
      ? orders
      : orders.filter((order) => (order.channel || "website") === channelFilter);

  // Helper styling for Payment Status Badges
  const getPaymentStyles = (status: string) => {
    switch (status?.toLowerCase()) {
      case "paid":
        return "bg-green-100 text-green-700 border border-green-200";
      case "refunded":
        return "bg-purple-100 text-purple-700 border border-purple-200";
      default:
        return "bg-yellow-100 text-yellow-700 border border-yellow-200";
    }
  };

  // Helper styling for Order Status Badges
  const getOrderStatusStyles = (status: string) => {
    switch (status?.toLowerCase()) {
      case "canceled":
      case "cancelled":
        return "bg-red-100 text-red-700 border border-red-200";
      default:
        return "bg-blue-100 text-blue-700 border border-blue-200";
    }
  };

  if (loading) return <p className="p-6">Loading orders...</p>;

  return (
    <div className="p-4 md:p-6 w-full max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Order Management</h1>
        <div className="flex gap-3 items-center">
          <select
            value={channelFilter}
            onChange={(e) => setChannelFilter(e.target.value)}
            className="border rounded px-3 py-2"
          >
            <option value="all">All Channels</option>
            <option value="website">Website</option>
            <option value="whatsapp">WhatsApp</option>
          </select>
          <button onClick={loadOrders} className="text-sm text-blue-600 hover:underline">
            Refresh Data
          </button>
        </div>
      </div>

      <div className="overflow-x-auto border rounded-lg">
        <table className="min-w-[1200px] w-full text-sm text-left">
          <thead className="bg-gray-50 text-gray-600 font-medium border-b">
            <tr>
              <th className="p-4">Order ID</th>
              <th className="p-4">Customer</th>
              <th className="p-4">Phone</th>
              <th className="p-4">Product</th>
              <th className="p-4">Amount</th>
              <th className="p-4">Payment Status</th>
              <th className="p-4">Order Status</th>
              <th className="p-4">Channel</th>
              <th className="p-4">Action</th>
              <th className="p-4">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filteredOrders.map((order) => {
              const payStatus = order.payment_status || "Pending";
              const orderStatus = order.order_status || "Active";

              const isPaid = payStatus.toLowerCase() === "paid";
              const isCanceled = orderStatus.toLowerCase() === "canceled" || orderStatus.toLowerCase() === "cancelled";

              // Safely extract the raw phone number value from your db column
              const displayPhone = order.phone !== undefined && order.phone !== null ? String(order.phone) : (order.phone_number || "—");

              return (
                <tr key={order.id} className="hover:bg-gray-50">
                  <td className="p-4 font-mono text-xs text-blue-600">{order.id}</td>
                  <td className="p-4">
                    <div className="font-medium">{order.name}</div>
                    <div className="text-gray-500 text-xs">{order.customer_email}</div>
                  </td>
                  
                  {/* Dynamic Phone Column Fixed */}
                  <td className="p-4 text-gray-700 font-mono text-xs">
                    {displayPhone}
                  </td>

                  <td className="p-4">{order.product_name}</td>
                  <td className="p-4 font-bold">${order.price}</td>
                  
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

                  <td className="p-4">
                    <span className="px-2 py-1 rounded bg-gray-100 text-xs">
                      {order.channel || "website"}
                    </span>
                  </td>

                  {/* Conditional Action Output */}
                  <td className="p-4">
                    {isCanceled && isPaid ? (
                      <div className="text-purple-600 font-bold flex flex-col leading-tight">
                        <span>✕ Canceled</span>
                        <span className="text-[10px] text-gray-500 font-normal mt-0.5">(Needs Refund)</span>
                      </div>
                    ) : isCanceled ? (
                      <span className="text-red-500 font-medium italic">✕ Canceled</span>
                    ) : isPaid ? (
                      <span className="text-green-600 font-medium">✓ Verified</span>
                    ) : (
                      <button
                        onClick={() => handleApprove(order.id)}
                        disabled={updatingId === order.id}
                        className="bg-blue-600 text-white px-3 py-1 rounded text-xs disabled:opacity-50 hover:bg-blue-700 transition"
                      >
                        {updatingId === order.id ? "Updating..." : "Approve"}
                      </button>
                    )}
                  </td>

                  <td className="p-4 text-gray-500">
                    {new Date(order.created_at).toLocaleDateString()}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}