"use client";

export const dynamic = "force-dynamic";

export default function OrderFailed() {
  return (
    <div style={{ textAlign: "center", marginTop: "80px" }}>
      <h1>❌ Payment Failed</h1>
      <p>Your payment was not completed.</p>
      <p>Please try again.</p>

      <a
        href="/"
        style={{
          display: "inline-block",
          marginTop: "20px",
          padding: "10px 20px",
          background: "#2563eb",
          color: "#fff",
          borderRadius: "6px",
          textDecoration: "none",
        }}
      >
        Go Back
      </a>
    </div>
  );
}