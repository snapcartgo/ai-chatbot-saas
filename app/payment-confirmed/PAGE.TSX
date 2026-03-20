export default function PaymentConfirmed() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen text-center">
      <h1 className="text-4xl font-bold text-green-600">Payment Successful!</h1>
      <p className="mt-4 text-gray-600">Your order has been processed. You can close this window now.</p>
    </div>
  );
}