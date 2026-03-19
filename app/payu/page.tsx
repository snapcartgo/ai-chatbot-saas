"use client";

import { useEffect } from "react";

export default function PayUPage() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const order_id = params.get("order_id");

    if (!order_id) return;

    const fetchData = async () => {
      const res = await fetch(`/api/get-order?order_id=${order_id}`);
      const data = await res.json();

      if (!data?.payu_data) return;

      const payu = data.payu_data;

      const form = document.createElement("form");
      form.method = "POST";
      form.action = "https://secure.payu.in/_payment";

      Object.keys(payu).forEach((key) => {
        const input = document.createElement("input");
        input.type = "hidden";
        input.name = key;
        input.value = payu[key];
        form.appendChild(input);
      });

      document.body.appendChild(form);
      form.submit();
    };

    fetchData();
  }, []);

  return <div>Redirecting to payment...</div>;
}