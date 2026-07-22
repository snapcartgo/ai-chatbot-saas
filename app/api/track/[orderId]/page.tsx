// app/track/[orderId]/page.tsx
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default async function TrackPage({ params }: { params: { orderId: string } }) {
  const { data: order } = await supabase
    .from("orders")
    .select("*")
    .eq("id", params.orderId)
    .single();

  if (!order) return <div style={{ padding: 40 }}>Order not found.</div>;

  return (
    <div style={{ padding: 40, fontFamily: "sans-serif", maxWidth: 600, margin: "auto" }}>
      <h2>📦 Shipment Status</h2>
      <hr />
      <p><strong>Order ID:</strong> {order.id}</p>
      <p><strong>Customer:</strong> {order.name}</p>
      <p><strong>Items:</strong> {order.product_name}</p>
      <p><strong>Status:</strong> <span style={{ color: "green" }}>{order.order_status}</span></p>
      <p><strong>Courier:</strong> {order.courier_name || "Assigned"}</p>
      <p><strong>Tracking Number:</strong> {order.tracking_number || "Pending"}</p>
    </div>
  );
}