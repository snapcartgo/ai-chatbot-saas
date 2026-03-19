// app/payu/page.tsx (or your specific PayU route)
'use client';

import { useEffect, useRef } from 'react';

export default function PayUPage({ payuData }: { payuData: any }) {
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    // This is the logic I mentioned. 
    // Once payuData is present, it automatically clicks 'submit' for the user.
    if (payuData && formRef.current) {
      formRef.current.submit();
    }
  }, [payuData]);

  return (
    <div>
      <h1>Redirecting to Payment Gateway...</h1>
      
      {/* Hidden Form that sends the data to PayU */}
      <form 
        ref={formRef} 
        action="https://secure.payu.in/_payment" 
        method="POST"
      >
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
        
        <button type="submit" style={{ display: 'none' }}>Submit</button>
      </form>
    </div>
  );
}