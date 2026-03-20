'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase'; // Fixed import based on your file structure

// This line prevents the Vercel build error you saw
export const dynamic = 'force-dynamic';

export default function PayUPage() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get('order_id');
  const [payuData, setPayuData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchOrder() {
      if (!orderId) {
        setError("No Order ID found in URL.");
        setLoading(false);
        return;
      }

      // Fetch the order from Supabase
      const { data, error: sbError } = await supabase
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .single();

      if (sbError || !data) {
        console.error("Supabase Error:", sbError);
        setError("Order not found in database.");
      } else {
        // Look for the payu_data field you saved from n8n
        setPayuData(data.payu_data);
      }
      setLoading(false);
    }

    fetchOrder();
  }, [orderId]);

  if (loading) return <div className="p-10">Loading payment details...</div>;
  
  if (error || !payuData) return <div className="p-10 text-red-500">{error || "Invalid Order Data."}</div>;

  return (
    <div className="p-10 flex flex-col items-center">
      <h1 className="text-2xl font-bold mb-4">Complete Your Payment</h1>
      <p className="mb-6">Order ID: {orderId}</p>
      
      {/* This is the hidden form that sends the user to PayU */}
      <form action="https://secure.payu.in/_payment" method="POST">
        <input type="hidden" name="key" value={payuData.key} />
        <input type="hidden" name="txnid" value={payuData.txnid} />
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
          className="bg-blue-600 text-white px-8 py-3 rounded-lg font-bold hover:bg-blue-700 transition"
        >
          Pay Now ₹{payuData.amount}
        </button>
      </form>
    </div>
  );
}