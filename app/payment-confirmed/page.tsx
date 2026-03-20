"use client";

export default function PaymentConfirmed() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      backgroundColor: '#f9fafb',
      fontFamily: 'sans-serif',
      padding: '20px',
      textAlign: 'center'
    }}>
      <div style={{
        backgroundColor: 'white',
        padding: '40px',
        borderRadius: '20px',
        boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
        maxWidth: '400px'
      }}>
        <div style={{ fontSize: '60px', marginBottom: '20px' }}>✅</div>
        <h1 style={{ color: '#111827', fontSize: '24px', fontWeight: 'bold', margin: '0' }}>
          Payment Successful!
        </h1>
        <p style={{ color: '#4b5563', marginTop: '15px', lineHeight: '1.5' }}>
          Your order has been confirmed and updated in our system.
        </p>
        <p style={{ color: '#6b7280', fontSize: '14px', marginTop: '10px' }}>
          You can now safely close this tab and return to the chat.
        </p>
        <div style={{
          marginTop: '30px',
          padding: '12px',
          backgroundColor: '#eff6ff',
          borderRadius: '10px',
          color: '#1d4ed8',
          fontWeight: '600'
        }}>
          Order Status: PAID
        </div>
      </div>
    </div>
  );
}