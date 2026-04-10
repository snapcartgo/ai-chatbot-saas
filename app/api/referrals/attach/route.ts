import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const ref = String(body.ref || "").trim();
    const userId = String(body.userId || "").trim();
    const email = String(body.email || "").toLowerCase().trim();

    if (!ref || !userId || !email) {
      return NextResponse.json(
        { error: "Missing ref, userId or email" },
        { status: 400 }
      );
    }

    const { data: partner } = await supabase
      .from("partners")
      .select("id, referral_code")
      .eq("referral_code", ref)
      .maybeSingle();

    if (!partner?.id) {
      return NextResponse.json({ error: "Invalid referral code" }, { status: 404 });
    }

    const { data: existing } = await supabase
      .from("referrals")
      .select("id")
      .eq("referred_user_id", userId)
      .maybeSingle();

    if (!existing) {
      const { error: insertError } = await supabase.from("referrals").insert([
        {
          partner_id: partner.id, // stored as text in your schema
          source_referral_code: partner.referral_code,
          referred_email: email,
          referred_user_id: userId,
          status: "pending",
          payment_status: "pending",
        },
      ]);

      if (insertError) {
        return NextResponse.json(
          { error: insertError.message, details: insertError },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Server error" },
      { status: 500 }
    );
  }
}
