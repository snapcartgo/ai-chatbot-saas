"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import PartnerRegistrationForm from "./PartnerRegistrationForm";

export default function PartnerDashboard() {

  const [user, setUser] = useState<any>(null);
  const [partner, setPartner] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const router = useRouter();

  useEffect(() => {
    checkUser();
  }, []);

  const checkUser = async () => {
    const { data, error } = await supabase.auth.getUser();

    console.log("USER DEBUG:", data?.user);

    if (!data?.user) {
      router.push("/login");
      return;
    }

    setUser(data.user);

    const { data: partnerData } = await supabase
      .from("partners")
      .select("*")
      .eq("user_id", data.user.id)
      .single();

    setPartner(partnerData);
    setLoading(false);
  };

  

  if (loading) return <p>Loading...</p>;

  if (partner) {
  return (
    <div>
      <h1>Partner Dashboard</h1>

      <p>Welcome {partner.business_name}</p>

      {/* 🔥 ADD THIS PART BELOW */}
      <div style={{ marginTop: "20px" }}>
        <p>Your Referral Link:</p>
        <code>
          {`http://localhost:3000?ref=${partner.referral_code}`}
        </code>
      </div>

    </div>
  );
}

  return <PartnerRegistrationForm userId={user.id} />;
}