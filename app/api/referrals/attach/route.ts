import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import * as Sentry from "@sentry/nextjs";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const BLOCKED_REFERRAL_EMAILS = new Set(["iamshubhambukam@gmail.com"]);

function normalizeEmail(value: string) {
  return value.toLowerCase().trim();
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const ref = String(body.ref || "").trim();
    const userId = String(body.userId || "").trim();
    const email = normalizeEmail(String(body.email || ""));

    if (!ref || !userId || !email) {
      return NextResponse.json(
        { error: "Missing ref, userId or email" },
        { status: 400 }
      );
    }

    const { data: partner, error: partnerError } = await supabase
      .from("partners")
      .select("id, referral_code, user_id")
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

    // Block this specific email completely
    if (BLOCKED_REFERRAL_EMAILS.has(email)) {
      return NextResponse.json(
        { error: "This email is blocked for referral signup" },
        { status: 403 }
      );
    }

    // Block self-referral by account id
    if (partner.user_id === userId) {
      return NextResponse.json(
        { error: "You cannot refer yourself" },
        { status: 400 }
      );
    }

    // Block self-referral by email match
    const { data: partnerProfile } = await supabase
      .from("profiles")
      .select("email")
      .eq("id", partner.user_id)
      .maybeSingle();

    const partnerEmail = normalizeEmail(String(partnerProfile?.email || ""));
    if (partnerEmail && partnerEmail === email) {
      return NextResponse.json(
        { error: "You cannot use your own referral link with same email" },
        { status: 400 }
      );
    }

    // Prevent duplicates by user OR email
    const { data: existing, error: existingError } = await supabase
      .from("referrals")
      .select("id")
      .or(`referred_user_id.eq.${userId},referred_email.eq.${email}`)
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
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    Sentry.captureException(err);
    return NextResponse.json(
      { error: err.message || "Server error" },
      { status: 500 }
    );
  }
}
