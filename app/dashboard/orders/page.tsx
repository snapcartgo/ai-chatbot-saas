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

  const handleApprove = async (orderId: string) => {
  const confirmApprove = confirm("Mark this order as Paid?");
  if (!confirmApprove) return;

  setUpdatingId(orderId);

  // 1. UPDATE SUPABASE
  const { error } = await supabase
    .from("orders")
    .update({ 
      payment_status: "Paid" 
    })
    .eq("id", orderId); // ✅ FIXED: Changed from 'order_id' to 'id'

  if (error) {
    alert(`Supabase Error: ${error.message}`);
    console.error(error);
  } else {
    // 2. UPDATE LOCAL STATE (Only if DB update succeeded)
    setOrders((prev) => 
      prev.map((o) => (o.id === orderId ? { ...o, payment_status: "Paid" } : o))
    );
    alert("Database updated successfully!");
  }
  setUpdatingId(null);
};

  if (loading) return <p className="p-6">Loading orders...</p>;

  return (
    <div className="p-4 md:p-6 w-full max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Order Management</h1>
        <button onClick={loadOrders} className="text-sm text-blue-600 hover:underline">
          Refresh Data
        </button>
      </div>

      <div className="overflow-x-auto border rounded-lg">
        <table className="min-w-[1000px] w-full text-sm text-left">
          <thead className="bg-gray-50 text-gray-600 font-medium border-b">
            <tr>
              <th className="p-4">Order ID</th>
              <th className="p-4">Customer</th>
              <th className="p-4">Product</th>
              <th className="p-4">Amount</th>
              <th className="p-4">Status</th>
              <th className="p-4">Action</th>
              <th className="p-4">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {orders.map((order) => (
              <tr key={order.id} className="hover:bg-gray-50">
                <td className="p-4 font-mono text-xs text-blue-600">{order.id}</td>
                <td className="p-4">
                  <div className="font-medium">{order.name}</div>
                  <div className="text-gray-500 text-xs">{order.customer_email}</div>
                </td>
                <td className="p-4">{order.product_name}</td>
                <td className="p-4 font-bold">${order.price}</td>
                <td className="p-4">
                  <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${
                    order.payment_status === "Paid" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"
                  }`}>
                    {order.payment_status || "Pending"}
                  </span>
                </td>
                <td className="p-4">
                  {order.payment_status !== "Paid" ? (
                    <button
                      onClick={() => handleApprove(order.id)}
                      disabled={updatingId === order.id}
                      className="bg-blue-600 text-white px-3 py-1 rounded text-xs disabled:opacity-50"
                    >
                      {updatingId === order.id ? "Updating..." : "Approve"}
                    </button>
                  ) : (
                    <span className="text-green-600 font-medium">✓ Verified</span>
                  )}
                </td>
                <td className="p-4 text-gray-500">
                  {new Date(order.created_at).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}