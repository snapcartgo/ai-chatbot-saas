'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase'; // Using the path from your folder structure

// This helps Vercel understand this page needs to be dynamic
export const dynamic = 'force-dynamic';

function PayUContent() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get('order_id');
  const [payuData, setPayuData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchOrder() {
      if (!orderId) {
        setError("Missing Order ID.");
        setLoading(false);
        return;
      }

      // Fetch the order using the 'id' column which is now 'text'
      const { data, error: sbError } = await supabase
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .single();

      if (sbError || !data) {
        console.error("Supabase Error:", sbError);
        setError("Order not found in database.");
      } else if (!data.payu_data) {
        setError("Payment details (payu_data) are missing for this order.");
      } else {
        setPayuData(data.payu_data);
      }
      setLoading(false);
    }

    fetchOrder();
  }, [orderId]);

  if (loading) return <div className="p-10 text-center">Loading payment details...</div>;
  
  if (error || !payuData) {
    return (
      <div className="p-10 text-center">
        <p className="text-red-500 font-bold">{error || "Invalid Order."}</p>
        <p className="text-sm text-gray-500 mt-2">ID: {orderId}</p>
      </div>
    );
  }

  return (
    <div className="p-10 flex flex-col items-center">
      <h1 className="text-2xl font-bold mb-4">Complete Your Payment</h1>
      <p className="mb-6 text-gray-600">Order ID: {orderId}</p>
      
      {/* PayU Production URL */}
      <form action="https://secure.payu.in/_payment" method="POST">
        <input type="hidden" name="key" value={payuData.key} />
        <input type="hidden" name="txid" value={payuData.txnid} />
        <input type="hidden" name="amount" value={payuData.amount} />
        <input type="hidden" name="productinfo" value={payuData.productinfo} />
        <input type="hidden" name="firstname" value={payuData.firstname} />
        <input type="hidden" name="email" value={payuData.email} />
        <input type="hidden" name="phone" value={payuData.phone} />
        <input type="hidden" name="surl" value={payuData.surl} />
        <input type="hidden" name="furl" value={payuData.furl} />
        <input type="hidden" name="hash" value={payuData.hash} />
        <input type="hidden" name="service_provider" value="payu_paisa" />
        
        <button 
          type="submit" 
          className="bg-blue-600 text-white px-10 py-4 rounded-xl font-bold hover:bg-blue-700 shadow-lg transition-all"
        >
          Pay Now ₹{payuData.amount}
        </button>
      </form>
    </div>
  );
}

// The main page component must wrap the content in Suspense
export default function PayUPage() {
  return (
    <Suspense fallback={<div className="p-10 text-center">Initializing...</div>}>
      <PayUContent />
    </Suspense>
  );
}