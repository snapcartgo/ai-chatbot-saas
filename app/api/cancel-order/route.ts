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

    if (!rawId || rawId === "null") {
      return NextResponse.json({
        success: false,
        requires_selection: true,
        message: "Please provide your Order ID so I can look up your record."
      });
    }

    const cleanId = rawId.replace(/#/g, "").trim();

    // 1. Database Row Lookup
    let { data: order, error: fetchError } = await supabase
      .from("orders")
      .select("id, name, phone")
      .eq("id", cleanId)
      .maybeSingle();

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

    // 2. Validate Name if provided
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

    // 3. Validate Phone if provided
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

    // 4. SUCCESS PATH: If BOTH have been submitted and verified, execute row delete action
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

    // ⚡ 5. COMBINED PROMPT: Ask for Name and Phone together at the same time
    return NextResponse.json({
      success: false,
      requires_selection: true,
      message: "Order found! For security verification, please provide the full Name and Phone Number associated with this order."
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