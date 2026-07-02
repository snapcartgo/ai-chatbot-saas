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

    // ⚡ STEP 1: If ANY of the three required fields are missing, ask for all of them together immediately!
    if (!rawId || rawId === "null" || !customer_name || !phone) {
      return NextResponse.json({
        success: false,
        requires_selection: true,
        message: "To cancel your order, please provide your **Order ID**, the **Name**, and the **Phone Number** associated with the order all in one message so I can securely verify and delete your record."
      });
    }

    // Clean formatting characters like hashtags
    const cleanId = rawId.replace(/#/g, "").trim();

    // 2. Database Row Lookup
    let { data: order, error: fetchError } = await supabase
      .from("orders")
      .select("id, name, phone")
      .eq("id", cleanId)
      .maybeSingle();

    // Fallback logic for variations in trailing characters
    if (!order && cleanId.length >= 24) {
      const idBase = cleanId.substring(0, 24);
      const { data: fallbackOrder, error: fallbackError } = await supabase
        .from("orders")
        .select("id, name, phone")
        .ilike("id", `${idBase}%`)
        .maybeSingle();
      
      if (!fallbackError && fallbackOrder) {
        order = fallbackOrder;
      }
    }

    if (!order) {
      return NextResponse.json({
        success: false,
        requires_selection: true,
        message: `I couldn't find an order matching ID # ${cleanId}. Please check the ID and try again.`
      });
    }

    // 3. Security Verification Checks
    const dbName = String(order.name || "").toLowerCase().trim();
    const inputName = String(customer_name).toLowerCase().trim();
    if (!dbName.includes(inputName) && !inputName.includes(dbName)) {
      return NextResponse.json({
        success: false,
        requires_selection: true,
        message: "Security Verification Failed: The name provided does not match our records."
      });
    }

    const dbPhone = String(order.phone || "").replace(/\D/g, "");
    const inputPhone = String(phone).replace(/\D/g, "");
    if (dbPhone.substring(dbPhone.length - 10) !== inputPhone.substring(inputPhone.length - 10)) {
      return NextResponse.json({
        success: false,
        requires_selection: true,
        message: "Security Verification Failed: The phone number provided does not match our records."
      });
    }

    // 4. EXECUTE CANCELLATION DELETION
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