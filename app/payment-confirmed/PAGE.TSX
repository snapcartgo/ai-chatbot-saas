export default function PaymentConfirmed() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-6 text-center">
      <div className="bg-white p-10 rounded-3xl shadow-lg max-w-sm">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path>
          </svg>
        </div>
        <h1 className="text-3xl font-black text-gray-800">Success!</h1>
        <p className="mt-4 text-gray-600 font-medium">
          Your payment was processed successfully. You can now close this tab and return to the chat.
        </p>
        <button 
          onClick={() => window.close()}
          className="mt-8 w-full bg-gray-900 text-white py-3 rounded-xl font-bold hover:bg-black transition-colors"
        >
          Close Window
        </button>
      </div>
    </div>
  );
}