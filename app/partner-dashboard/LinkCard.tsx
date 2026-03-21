export default function PartnerLink({ referralCode }: { referralCode: string }) {
  const shareUrl = `${window.location.origin}?ref=${referralCode}`;

  return (
    <div className="p-6 bg-gray-900 border border-blue-500 rounded-xl">
      <h3 className="text-white font-bold mb-2">Your Partner Referral Link</h3>
      <div className="flex gap-2">
        <input 
          readOnly 
          value={shareUrl} 
          className="bg-black text-gray-300 p-2 flex-grow rounded border border-gray-700"
        />
        <button 
          onClick={() => navigator.clipboard.writeText(shareUrl)}
          className="bg-blue-600 px-4 py-2 text-white rounded hover:bg-blue-700"
        >
          Copy
        </button>
      </div>
      <p className="text-sm text-gray-400 mt-2 italic">
        Share this with your clients. You earn 20% on every successful payment.
      </p>
    </div>
  );
}