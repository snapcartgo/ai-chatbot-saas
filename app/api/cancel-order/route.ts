import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

// Initialize Supabase with strict options to ensure RLS bypass works locally
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    const rawId = typeof body.order_id === "string" ? body.order_id.trim() : "";
    const customer_name = body.customer_name?.trim() || null;
    const phone = body.phone?.trim() || null;

    const idMatch = rawId.match(/ORD_[a-zA-Z0-9]+_[0-9]+/i);
    let sanitizedId = idMatch ? idMatch[0].trim() : rawId.replace(/#/g, "").trim();

    // Standardize length format matching your Supabase row string 
    const cleanIdForDb = sanitizedId.length === 25 ? sanitizedId.substring(0, 24) : sanitizedId;

    // 🔍 DEBUG LOGS: Print out connection parameters to your VS Code Terminal
    console.log("--- SUPABASE CONNECTION DIAGNOSTICS ---");
    console.log("Connecting to Supabase URL:", supabaseUrl);
    console.log("Using Key (First 10 characters):", supabaseServiceKey.substring(0, 15) + "...");
    console.log("Searching for Order ID:", cleanIdForDb);
    console.log("---------------------------------------");

    // Test a wide open lookup without column constraints
    const { data: order, error: fetchError } = await supabase
      .from("orders")
      .select("*")
      .eq("id", cleanIdForDb)
      .maybeSingle();

    if (fetchError) {
      console.error("Database Query Error:", fetchError.message);
      return NextResponse.json({ success: false, message: fetchError.message });
    }

    if (!order) {
      return NextResponse.json({
        success: false,
        requires_selection: true,
        message: `Database Mismatch: The database at ${supabaseUrl.substring(0, 25)}... contains 0 rows matching ID: ${cleanIdForDb}`
      });
    }

    // Security field verifications
    const dbName = String(order.customer_name || "").toLowerCase().trim();
    const inputName = String(customer_name || "").toLowerCase().trim();
    if (customer_name && !dbName.includes(inputName)) {
      return NextResponse.json({ success: false, message: "Name mismatch verification failed." });
    }

    // Execute direct table removal action
    const { error: deleteError } = await supabase
      .from("orders")
      .delete()
      .eq("id", order.id);

    if (deleteError) {
      return NextResponse.json({ success: false, message: deleteError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: `Verification Successful! Order #${order.id} deleted from database.`
    });

  } catch (err: any) {
    return NextResponse.json({ success: false, message: err?.message || "Server Error" }, { status: 500 });
  }
}