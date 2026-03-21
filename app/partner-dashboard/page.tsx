import { createClient } from '@supabase/supabase-js';
import PartnerRegistrationForm from "./PartnerRegistrationForm";

export default async function PartnerDashboardPage() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: { user } } = await supabase.auth.getUser();

  // 1. If no user, the middleware handles the login redirect.
  // 2. Check if they exist in the 'partners' table
  const { data: partner } = await supabase
    .from('partners')
    .select('*')
    .eq('user_id', user?.id)
    .single();

  // 3. IF NO PARTNER FOUND -> Show the Form (This is what's missing!)
  if (!partner) {
    return (
      <div style={{ 
        backgroundColor: "#000", 
        minHeight: "100vh", 
        display: "flex", 
        flexDirection: "column", 
        alignItems: "center", 
        justifyContent: "center",
        color: "#fff" 
      }}>
        <h1 style={{ fontSize: "2rem", marginBottom: "10px" }}>Partner Registration</h1>
        <p style={{ color: "#888", marginBottom: "30px" }}>Enter your business details to start earning 20% commission.</p>
        
        {/* This is the form component we created earlier */}
        <PartnerRegistrationForm userId={user?.id || ''} />
      </div>
    );
  }

  // 4. IF PARTNER EXISTS -> Show the actual stats dashboard
  return (
    <div style={{ padding: "40px", color: "#fff", backgroundColor: "#000" }}>
      <h1>Welcome, {partner.business_name}</h1>
      <p>Referral Link: https://your-site.com?ref={partner.referral_code}</p>
      {/* Your stats cards here */}
    </div>
  );
}