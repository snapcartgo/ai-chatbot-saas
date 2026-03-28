"use client";

import { useSearchParams } from "next/navigation";

export default function PaymentSuccess() {
  const params = useSearchParams();

  const orderId = params.get("order_id");
  const amount = params.get("amount");

  return (
    <div style={{ textAlign: "center", marginTop: "60px" }}>
      <h1>✅ Payment Successful</h1>

      <p>Your order has been confirmed.</p>

      {orderId && (
        <p>
          <strong>Order ID:</strong> {orderId}
        </p>
      )}

      {amount && (
        <p>
          <strong>Amount Paid:</strong> ₹{amount}
        </p>
      )}

      <p>Thank you for your purchase 🙌</p>
    </div>
  );
}