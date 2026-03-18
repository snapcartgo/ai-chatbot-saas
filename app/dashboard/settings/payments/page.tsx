"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function PaymentsPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOrders = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      // ✅ IMPORTANT: do not break page if no session
      if (!user) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching orders:", error);
      } else {
        setOrders(data || []);
      }

      setLoading(false);
    };

    fetchOrders();
  }, []);

  if (loading) {
    return <p style={{ padding: 20 }}>Loading payments...</p>;
  }

  return (
    <div style={{ padding: 20 }}>
      <h1 style={{ fontSize: 22, marginBottom: 20 }}>Payments</h1>

      {orders.length === 0 ? (
        <p>No payments found.</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={th}>Product</th>
              <th style={th}>Price</th>
              <th style={th}>Email</th>
              <th style={th}>Status</th>
              <th style={th}>Date</th>
            </tr>
          </thead>

          <tbody>
            {orders.map((order) => (
              <tr key={order.id}>
                <td style={td}>{order.product_name}</td>
                <td style={td}>₹{order.price}</td>
                <td style={td}>{order.customer_email}</td>
                <td style={td}>
                  {order.payment_status === "success" ? (
                    <span style={{ color: "green" }}>Success</span>
                  ) : (
                    <span style={{ color: "orange" }}>Pending</span>
                  )}
                </td>
                <td style={td}>
                  {new Date(order.created_at).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// styles
const th = {
  borderBottom: "1px solid #ccc",
  textAlign: "left" as const,
  padding: "10px",
};

const td = {
  borderBottom: "1px solid #eee",
  padding: "10px",
};