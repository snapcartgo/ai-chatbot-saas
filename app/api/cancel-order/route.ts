import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    const rawId = typeof body.order_id === "string" ? body.order_id.trim() : "";
    const customer_name = body.customer_name?.trim() || null;
    const phone = body.phone?.trim() || null;

    // ⚡ STEP 1: If order_id is missing or null, IMMEDIATELY stop and ask for it!
    if (!rawId || rawId === "null") {
      return NextResponse.json({
        success: false,
        requires_selection: true,
        message: "Please provide your Order ID so I can look up your record."
      });
    }

    const idMatch = rawId.match(/ORD_[a-zA-Z0-9]+_[0-9]+/i);
    let sanitizedId = idMatch ? idMatch[0].trim() : rawId.replace(/#/g, "").trim();
    const cleanIdForDb = sanitizedId.length === 25 ? sanitizedId.substring(0, 24) : sanitizedId;

    // Step 2: Query Supabase cleanly
    const { data: order, error: fetchError } = await supabase
      .from("orders")
      .select("id, customer_name, phone")
      .eq("id", cleanIdForDb)
      .maybeSingle();

    if (fetchError || !order) {
      return NextResponse.json({
        success: false,
        requires_selection: true,
        message: `I couldn't find an order matching ID # ${cleanIdForDb}. Please check the ID and try again.`
      });
    }

    // Step 3: Security checks (Only validate if fields are actually sent by n8n)
    if (customer_name) {
      const dbName = String(order.customer_name || "").toLowerCase().trim();
      const inputName = String(customer_name).toLowerCase().trim();
      if (!dbName.includes(inputName) && !inputName.includes(dbName)) {
        return NextResponse.json({
          success: false,
          requires_selection: true,
          message: "Security Verification Failed: The name provided does not match our records."
        });
      }
    }

    if (phone) {
      const dbPhone = String(order.phone || "").replace(/\D/g, "");
      const inputPhone = String(phone).replace(/\D/g, "");
      if (dbPhone.substring(dbPhone.length - 10) !== inputPhone.substring(inputPhone.length - 10)) {
        return NextResponse.json({
          success: false,
          requires_selection: true,
          message: "Security Verification Failed: The phone number provided does not match our records."
        });
      }
    }

    // Step 4: Delete order record if both Name and Phone have already been verified
    if (customer_name && phone) {
      const { error: deleteError } = await supabase
        .from("orders")
        .delete()
        .eq("id", order.id);

      if (deleteError) {
        return NextResponse.json({ success: false, message: deleteError.message }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        message: `Verification Successful! Your order #${order.id} has been completely removed from our records.`
      });
    }

    // Fallback response if more details are needed
    return NextResponse.json({
      success: false,
      requires_selection: true,
      message: "Order found. For verification, please confirm your Name or Phone number."
    });

  } catch (err: any) {
    return NextResponse.json({ success: false, message: err?.message || "Server Error" }, { status: 500 });
  }
}