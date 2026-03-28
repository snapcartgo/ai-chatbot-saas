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
    return <p style={{ padding: 40 }}>Loading orders...</p>;
  }

  return (
    <div style={{ padding: 40 }}>
      <h1>Orders</h1>

      <table
        style={{
          width: "100%",
          marginTop: 20,
          borderCollapse: "collapse"
        }}
      >
        <thead>
          <tr style={{ background: "#f3f4f6" }}>
            <th style={{ padding: 10 }}>Order ID</th>
            <th style={{ padding: 10 }}>Name</th>
            <th style={{ padding: 10 }}>Email</th>
            <th style={{ padding: 10 }}>Phone</th>
            <th style={{ padding: 10 }}>Product</th>
            <th style={{ padding: 10 }}>Price</th>
            <th style={{ padding: 10 }}>Status</th>
            <th style={{ padding: 10 }}>Payment ID</th>
            <th style={{ padding: 10 }}>Date</th>
          </tr>
        </thead>

        <tbody>
          {orders.map((order) => (
            <tr key={order.id} style={{ borderTop: "1px solid #eee" }}>
              <td style={{ padding: 10 }}>{order.id}</td>
              <td style={{ padding: 10 }}>{order.name}</td>
              <td style={{ padding: 10 }}>{order.customer_email}</td>
              <td style={{ padding: 10 }}>{order.phone}</td>
              <td style={{ padding: 10 }}>{order.product_name}</td>
              <td style={{ padding: 10 }}>${order.price}</td>
              <td style={{ padding: 10 }}>{order.payment_status}</td>
              <td style={{ padding: 10 }}>{order.payment_id || "-"}</td>
              <td style={{ padding: 10 }}>
                {new Date(order.created_at).toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}