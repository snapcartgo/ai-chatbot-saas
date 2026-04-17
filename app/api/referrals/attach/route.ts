import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import * as Sentry from "@sentry/nextjs";

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

    // ✅ 1. Validate input
    if (!ref || !userId || !email) {
      return NextResponse.json(
        { error: "Missing ref, userId or email" },
        { status: 400 }
      );
    }

    // ✅ 2. Check if referral code exists
    const { data: partner, error: partnerError } = await supabase
      .from("partners")
      .select("id, referral_code")
      .eq("referral_code", ref)
      .maybeSingle();

    if (partnerError) {
      Sentry.captureException(partnerError);
      return NextResponse.json(
        { error: "Error checking referral code" },
        { status: 500 }
      );
    }

    if (!partner?.id) {
      return NextResponse.json(
        { error: "Invalid referral code" },
        { status: 404 }
      );
    }

    // ✅ 3. Prevent duplicate referral (IMPORTANT)
    const { data: existing, error: existingError } = await supabase
      .from("referrals")
      .select("id, partner_id")
      .eq("referred_user_id", userId)
      .maybeSingle();

    if (existingError) {
      Sentry.captureException(existingError);
      return NextResponse.json(
        { error: "Error checking existing referral" },
        { status: 500 }
      );
    }

    if (existing) {
      return NextResponse.json(
        { error: "Referral already applied" },
        { status: 400 }
      );
    }

    // ✅ 4. Insert referral
    const { error: insertError } = await supabase
      .from("referrals")
      .insert([
        {
          partner_id: partner.id,
          source_referral_code: partner.referral_code,
          referred_email: email,
          referred_user_id: userId,
          status: "pending",
          payment_status: "pending",
        },
      ]);

    if (insertError) {
      Sentry.captureException(insertError);

      return NextResponse.json(
        { error: insertError.message },
        { status: 500 }
      );
    }

    // ✅ 5. Success (optional Sentry log)
    Sentry.captureMessage("Referral attached successfully", {
      extra: {
        userId,
        email,
        ref,
        partnerId: partner.id,
      },
    });

    return NextResponse.json({ ok: true });

  } catch (err: any) {
    Sentry.captureException(err);

    return NextResponse.json(
      { error: err.message || "Server error" },
      { status: 500 }
    );
  }
}