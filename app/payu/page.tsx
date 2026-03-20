'use client';
import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';

function PayUContent() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get('order_id');
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    if (orderId) {
      supabase.from('orders').select('*').eq('id', orderId).single()
        .then(({ data }) => setData(data));
    }
  }, [orderId]);

  if (!data) return <div className="p-10">Loading Order {orderId}...</div>;

  return (
    <div className="p-10">
      <h1>Pay for {data.product_name}</h1>
      <form action="https://secure.payu.in/_payment" method="POST">
        {/* All your hidden PayU inputs here */}
        <button type="submit" className="bg-blue-600 text-white p-3 rounded">
          Pay ₹{data.price}
        </button>
      </form>
    </div>
  );
}

export default function PayUPage() {
  return (
    <Suspense fallback={<div>Loading Page...</div>}>
      <PayUContent />
    </Suspense>
  );
}