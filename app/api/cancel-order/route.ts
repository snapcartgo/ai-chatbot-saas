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

    // 🔍 CONNECTION DIAGNOSTIC LOGS:
    console.log("----------------------------------------");
    console.log("ACTIVE DB URL BEING QUERIED:", process.env.NEXT_PUBLIC_SUPABASE_URL);
    console.log("INCOMING RAW ORDER ID:", rawId);
    console.log("----------------------------------------");

    if (!rawId || rawId === "null") {
      return NextResponse.json({
        success: false,
        requires_selection: true,
        message: "Please provide your Order ID so I can look up your record."
      });
    }

    // Clean up formatting issues or hashtags from n8n inputs
    let cleanIdForDb = rawId.replace(/#/g, "").trim();

    // Safe string boundary adjustment (slices at 24 or 25 characters depending on storage string length)
    if (cleanIdForDb.startsWith("ORD_") && cleanIdForDb.length > 25) {
      cleanIdForDb = cleanIdForDb.substring(0, 24);
    } else if (cleanIdForDb.startsWith("ORD_") && cleanIdForDb.length === 26) {
      cleanIdForDb = cleanIdForDb.substring(0, 25);
    }

    // ⚡ STEP 1: Query matching your real column layout names: id, name, phone
    const { data: order, error: fetchError } = await supabase
      .from("orders")
      .select("id, name, phone")
      .eq("id", cleanIdForDb)
      .maybeSingle();

    if (fetchError || !order) {
      return NextResponse.json({
        success: false,
        requires_selection: true,
        message: `I couldn't find an order matching ID # ${cleanIdForDb}. Please check the ID and try again.`
      });
    }

    // ⚡ STEP 2: Validate against the correct table column key 'name'
    if (customer_name) {
      const dbName = String(order.name || "").toLowerCase().trim();
      const inputName = String(customer_name).toLowerCase().trim();
      if (!dbName.includes(inputName) && !inputName.includes(dbName)) {
        return NextResponse.json({
          success: false,
          requires_selection: true,
          message: "Security Verification Failed: The name provided does not match our records."
        });
      }
    }

    // ⚡ STEP 3: Validate against the correct table column key 'phone'
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

    // ⚡ STEP 4: Delete the row if BOTH verification steps are provided and pass
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

    // Step 5: If order is found but name/phone are missing, ask for Name first
    return NextResponse.json({
      success: false,
      requires_selection: true,
      message: "For security verification, please share the Name used to place this order."
    });

  } catch (err: any) {
    return NextResponse.json({ success: false, message: err?.message || "Server Error" }, { status: 500 });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
    },
  });
}