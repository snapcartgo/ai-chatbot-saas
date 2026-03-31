"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function OrdersPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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

  if (loading) {
    return <p className="p-6">Loading orders...</p>;
  }

  return (
    <div className="p-4 md:p-6 w-full">

      {/* TITLE */}
      <h1 className="text-xl md:text-2xl font-semibold mb-4">
        Orders
      </h1>

      {/* 🔥 TABLE SCROLL FIX */}
      <div className="overflow-x-auto">

        <table className="min-w-[900px] w-full border">

          {/* HEADER */}
          <thead className="bg-gray-100 text-sm">
            <tr>
              <th className="p-3 text-left">Order ID</th>
              <th className="p-3 text-left">Name</th>
              <th className="p-3 text-left">Email</th>
              <th className="p-3 text-left">Phone</th>
              <th className="p-3 text-left">Product</th>
              <th className="p-3 text-left">Price</th>
              <th className="p-3 text-left">Status</th>
              <th className="p-3 text-left">Payment ID</th>
              <th className="p-3 text-left">Date</th>
            </tr>
          </thead>

          {/* BODY */}
          <tbody>
            {orders.map((order) => (
              <tr key={order.id} className="border-t text-sm">

                <td className="p-3">{order.id}</td>
                <td className="p-3">{order.name}</td>
                <td className="p-3">{order.customer_email}</td>
                <td className="p-3">{order.phone}</td>
                <td className="p-3">{order.product_name}</td>
                <td className="p-3 font-medium">${order.price}</td>
                <td className="p-3">{order.payment_status}</td>
                <td className="p-3">{order.payment_id || "-"}</td>
                <td className="p-3">
                  {new Date(order.created_at).toLocaleString()}
                </td>

              </tr>
            ))}
          </tbody>

        </table>

      </div>

    </div>
  );
}