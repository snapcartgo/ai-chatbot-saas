import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  console.log("===== SECURE CANCELLATION & DELETE API =====");
  try {
    const body = await req.json();
    
    // ⚡ BULLETPROOF REGEX SANITIZER: Strips hashtag (#), spaces, or text around the ID
    const rawMessage = String(body.order_id || "").trim();
    const idMatch = rawMessage.match(/ORD_[a-zA-Z0-9]+_[0-9]+/i);
    
    const order_id = idMatch ? idMatch[0].trim() : (rawMessage === "" ? null : rawMessage);
    const customer_name = body.customer_name?.trim() || null;
    const phone = body.phone?.trim() || null;

    // Step 1: Request Order ID if missing
    if (!order_id) {
      return NextResponse.json({
        success: false,
        requires_selection: true,
        message: "Please provide your Order ID so I can look up your record."
      });
    }

    // Step 2: Fetch the order row from Supabase to verify details
    const { data: order, error: fetchError } = await supabase
      .from("orders")
      .select("customer_name, phone, verification_status")
      .eq("id", order_id)
      .maybeSingle();

    if (fetchError || !order) {
      return NextResponse.json({
        success: false,
        requires_selection: true,
        message: `I couldn't find an order matching ID #${order_id}. Please check the ID and try again.`
      });
    }

    // Step 3: Verify Customer Name (Case-Insensitive check)
    const dbName = String(order.customer_name || "").toLowerCase().trim();
    const inputName = String(customer_name || "").toLowerCase().trim();

    if (!customer_name || !dbName.includes(inputName)) {
      return NextResponse.json({
        success: false,
        requires_selection: true,
        message: "For security verification, please share the Name used to place this order."
      });
    }

    // Step 4: Verify Phone Number (Matches last 10 digits safely)
    const dbPhone = String(order.phone || "").replace(/\D/g, "");
    const inputPhone = String(phone || "").replace(/\D/g, "");

    const cleanDbPhone = dbPhone.substring(dbPhone.length - 10);
    const cleanInputPhone = inputPhone.substring(inputPhone.length - 10);

    if (!phone || cleanDbPhone !== cleanInputPhone) {
      return NextResponse.json({
        success: false,
        requires_selection: true,
        message: "Almost done! Please confirm the Phone Number associated with this order."
      });
    }

    // ⚡ Step 5: SUCCESS PATH! Row verification complete. DELETE row from table.
    const { error: deleteError } = await supabase
      .from("orders")
      .delete()
      .eq("id", order_id);

    if (deleteError) {
      console.error("Supabase Row Delete Error:", deleteError.message);
      return NextResponse.json({ success: false, message: "Could not drop order record at this moment." }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: `Verification Successful! Your order #${order_id} has been completely removed from our records.`
    });

  } catch (err: any) {
    return NextResponse.json({ success: false, message: err?.message || "Server error encountered." }, { status: 500 });
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