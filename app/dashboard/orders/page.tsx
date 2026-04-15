"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function OrdersPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

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

  // ✅ New function to verify manual payments
  const handleApprove = async (orderId: string) => {
  const confirmApprove = confirm("Have you verified this payment in your bank/UPI app?");
  if (!confirmApprove) return;

  setUpdatingId(orderId);

  // ✅ FIX: Removed 'status' because it doesn't exist in your Supabase table
  const { error } = await supabase
    .from("orders")
    .update({ 
      payment_status: "Paid" 
    })
    .eq("id", orderId); 

  if (error) {
    alert(`Error: ${error.message}`);
    console.error("Supabase Error:", error);
  } else {
    // Update local state so the UI refreshes immediately
    setOrders(orders.map(order => 
      order.id === orderId 
        ? { ...order, payment_status: "Paid" } 
        : order
    ));
    alert("Payment verified successfully!");
  }
  setUpdatingId(null);
};

  if (loading) {
    return <p className="p-6 text-gray-500">Loading your orders...</p>;
  }

  return (
    <div className="p-4 md:p-6 w-full max-w-[1200px] mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-xl md:text-2xl font-bold text-gray-800">
          Order Management
        </h1>
        <button 
          onClick={loadOrders} 
          className="text-sm bg-gray-100 hover:bg-gray-200 px-3 py-1 rounded transition"
        >
          Refresh Data
        </button>
      </div>

      <div className="overflow-x-auto rounded-lg shadow-sm border border-gray-200">
        <table className="min-w-[1000px] w-full bg-white">
          <thead className="bg-gray-50 border-b border-gray-200 text-xs uppercase text-gray-500 font-semibold">
            <tr>
              <th className="p-4 text-left">Order ID</th>
              <th className="p-4 text-left">Customer</th>
              <th className="p-4 text-left">Product</th>
              <th className="p-4 text-left">Amount</th>
              <th className="p-4 text-left">Status</th>
              <th className="p-4 text-left">Payment ID</th>
              <th className="p-4 text-left">Action</th>
              <th className="p-4 text-left">Date</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-100 text-sm">
            {orders.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-8 text-center text-gray-400">No orders found.</td>
              </tr>
            ) : (
              orders.map((order) => (
                <tr key={order.id} className="hover:bg-gray-50 transition">
                  <td className="p-4 font-mono text-xs text-blue-600">{order.order_id || order.id}</td>
                  <td className="p-4">
                    <div className="font-medium text-gray-900">{order.name || "N/A"}</div>
                    <div className="text-xs text-gray-500">{order.customer_email}</div>
                  </td>
                  <td className="p-4 text-gray-700">{order.product_name}</td>
                  <td className="p-4 font-semibold text-gray-900">${order.price}</td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${
                      order.payment_status === "Paid" 
                        ? "bg-green-100 text-green-700" 
                        : "bg-yellow-100 text-yellow-700"
                    }`}>
                      {order.payment_status || "Pending"}
                    </span>
                  </td>
                  <td className="p-4 text-gray-500 text-xs">{order.payment_id || "-"}</td>
                  <td className="p-4">
                    {order.payment_status !== "Paid" ? (
                      <button
                        onClick={() => handleApprove(order.id)}
                        disabled={updatingId === order.id}
                        className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-3 py-1.5 rounded shadow-sm disabled:opacity-50 transition"
                      >
                        {updatingId === order.id ? "Verifying..." : "Approve"}
                      </button>
                    ) : (
                      <span className="text-gray-400 text-xs italic">Verified ✓</span>
                    )}
                  </td>
                  <td className="p-4 text-gray-400 text-xs">
                    {new Date(order.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}