'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase'; //

// 1. Move the logic into a content component
function PayUContent() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get('order_id');
  const [payuData, setPayuData] = useState<any>(null);

  useEffect(() => {
    async function fetchOrder() {
      if (!orderId) return;
      const { data } = await supabase
        .from('orders')
        .select('payu_data')
        .eq('id', orderId)
        .single();
      
      if (data) setPayuData(data.payu_data);
    }
    fetchOrder();
  }, [orderId]);

  if (!payuData) return <div className="p-10">Loading payment details for {orderId}...</div>;

  return (
    <div className="p-10 text-center">
      <h1 className="text-2xl font-bold mb-4">Confirm Payment</h1>
      <form action="https://secure.payu.in/_payment" method="POST">
        <input type="hidden" name="key" value={payuData.key} />
        {/* ... add all other hidden PayU inputs here ... */}
        <button type="submit" className="bg-blue-600 text-white px-6 py-2 rounded">
          Pay Now ₹{payuData.amount}
        </button>
      </form>
    </div>
  );
}

// 2. Wrap everything in Suspense to fix the Vercel Build Error
export default function PayUPage() {
  return (
    <Suspense fallback={<div>Loading Page...</div>}>
      <PayUContent />
    </Suspense>
  );
}