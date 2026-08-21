import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
const Razorpay = require("razorpay");

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const body = await req.json();

    console.log("Incoming Razorpay Body:", body); // Debugging

    const {
      id,
      bot_id,
      user_id,
      product_name,
      price,
      customer_email,
      phone,
      name,
      // Address & Quantity Fields
      address,
      city,
      state,
      pincode,
      quantity,
      selected_attributes,
    } = body;

    const cleanOrderId = id?.trim();
    const cleanUserId = user_id?.trim();

    if (!cleanOrderId || !cleanUserId) {
      return NextResponse.json(
        { error: "Order ID and User ID are required" },
        { status: 400 }
      );
    }

    // 1. Fetch Razorpay merchant keys from profiles table
    const { data: profile, error: profileErr } = await supabase
      .from("profiles")
      .select("razorpay_key_id, razorpay_key_secret, razorpay_is_active")
      .eq("id", cleanUserId)
      .single();

    if (
      profileErr ||
      !profile?.razorpay_key_id ||
      !profile?.razorpay_key_secret
    ) {
      return NextResponse.json(
        { error: "Razorpay merchant keys not found or inactive" },
        { status: 400 }
      );
    }

    const key_id = profile.razorpay_key_id;
    const key_secret = profile.razorpay_key_secret;

    // 2. Prepare order values
    const amountInRupees = Number(price);
    const amountInPaise = Math.round(amountInRupees * 100);
    const firstname = name || customer_email?.split("@")[0] || "Customer";
    const email = customer_email || "customer@example.com";
    const productinfo = product_name || "Product";
    const phoneNumber = String(phone || "9999999999").replace(/\D/g, "");
    const orderQuantity = Number(quantity) || 1;

    // 3. Initialize Razorpay Client
    const instance = new Razorpay({
      key_id,
      key_secret,
    });

    const host = req.headers.get("host") || "woodpetra.in";
    const protocol = host.includes("localhost") ? "http" : "https";

    // 4. Create Razorpay Payment Link
    const paymentLink = await instance.paymentLink.create({
      amount: amountInPaise,
      currency: "INR",
      accept_partial: false,
      reference_id: cleanOrderId,
      description: `Payment for ${productinfo} #${cleanOrderId}`,
      customer: {
        name: firstname,
        email: email,
        contact: phoneNumber,
      },
      notify: {
        sms: true,
        email: true,
      },
      reminder_enable: true,
      callback_url: `${protocol}://${host}/order-success/razorpay?order_id=${cleanOrderId}`,
      callback_method: "get",
    });

    // 5. Upsert Order to Supabase (exact schema match with PayU)
    const { error: dbError } = await supabase.from("orders").upsert(
      [
        {
          id: cleanOrderId,
          bot_id: bot_id || null,
          user_id: cleanUserId,
          product_name: productinfo,
          price: amountInRupees,
          customer_email: customer_email || null,
          phone: phoneNumber ? Number(phoneNumber) : null,
          phone_number: phoneNumber || null,
          name: firstname,
          // Address & Quantity Fields
          address: address || null,
          city: city || null,
          state: state || null,
          pincode: pincode ? String(pincode) : null,
          quantity: orderQuantity,
          selected_attributes: selected_attributes || null,
          // Payment & Status Metadata
          payment_status: "pending",
          payment_id: paymentLink.id,
          payment_link: paymentLink.short_url,
          payment_method: "Razorpay",
          order_status: "Active",
          shipment_status: "NOT_CREATED",
        },
      ],
      { onConflict: "id" }
    );

    if (dbError) {
      console.error("Supabase Order Insert Error:", dbError);
      throw dbError;
    }

    // 6. Return response matching PayU & n8n requirements
    return NextResponse.json({
      success: true,
      payUrl: paymentLink.short_url,
      payment_url: paymentLink.short_url,
      order_id: cleanOrderId,
    });
  } catch (err: any) {
    console.error("RAZORPAY API ERROR:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}