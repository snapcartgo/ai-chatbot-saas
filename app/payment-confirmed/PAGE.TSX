export default function PaymentConfirmed() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-6">
      <div className="bg-white p-10 rounded-3xl shadow-lg text-center max-w-sm">
        <div className="text-6xl mb-4">✅</div>
        <h1 className="text-3xl font-bold text-gray-800">Paid Successfully!</h1>
        <p className="mt-4 text-gray-600">
          Your order has been confirmed. You can now return to the chat.
        </p>
        <button 
          onClick={() => window.close()} 
          className="mt-8 bg-blue-600 text-white px-8 py-3 rounded-xl font-semibold"
        >
          Done
        </button>
      </div>
    </div>
  );
}