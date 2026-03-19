'use client';

import { useEffect, useRef, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';

// 1. Move the logic into a sub-component
function PayUContent() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get('id');
  const [payuData, setPayuData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    async function fetchOrder() {
      if (!orderId) {
        setLoading(false);
        return;
      }
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('order_id', orderId)
        .single();

      if (!error && data) {
        setPayuData(data.payu_data);
      }
      setLoading(false);
    }
    fetchOrder();
  }, [orderId]);

  useEffect(() => {
    if (payuData && formRef.current) {
      formRef.current.submit();
    }
  }, [payuData]);

  if (loading) return <div className="p-10 text-center">Loading payment details...</div>;
  if (!payuData) return <div className="p-10 text-center">Invalid Order.</div>;

  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <h1 className="text-xl font-semibold">Redirecting to PayU...</h1>
      <form ref={formRef} action="https://secure.payu.in/_payment" method="POST">
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
      </form>
    </div>
  );
}

// 2. Export the page wrapped in Suspense
export default function PayUPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <PayUContent />
    </Suspense>
  );
}