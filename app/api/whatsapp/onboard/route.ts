import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import axios from "axios";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  console.log("===== NEW ONBOARD ROUTE V5 =====");
  try {
    const body = await req.json();

    const client_id = String(body.client_id || "").trim();
    const waba_id = String(body.waba_id || "").trim();
    const phone_number_id = String(body.phone_number_id || "").trim();
    const business_id = String(body.business_id || "").trim();

    // 1. Structural Validation Checks
    if (!client_id) {
      return NextResponse.json({ error: "Missing client_id" }, { status: 400 });
    }

    if (!waba_id || !phone_number_id) {
      return NextResponse.json({ error: "Missing waba_id or phone_number_id" }, { status: 400 });
    }

    // 2. CodeQL SSRF Security Fix: Enforce strictly numeric IDs before injection
    const isPureNumeric = /^\d+$/.test(phone_number_id);
    const isPureNumericWaba = /^\d+$/.test(waba_id);
    if (!isPureNumeric || !isPureNumericWaba) {
      return NextResponse.json({ error: "Invalid ID format" }, { status: 400 });
    }

    const whatsappToken = process.env.WHATSAPP_ACCESS_TOKEN;
    console.log("WHATSAPP_ACCESS_TOKEN =", whatsappToken);
    
    if (!whatsappToken) {
      return NextResponse.json(
        { error: "Server configuration error: Missing WhatsApp Access Token" }, 
        { status: 500 }
      );
    }
    let finalChatbotId = null;

// Check existing config
const { data: existingConfig } = await supabase
  .from("whatsapp_configs")
  .select("chatbot_id")
  .eq("user_id", client_id)
  .maybeSingle();

if (existingConfig?.chatbot_id) {
  const { data: existingBot } = await supabase
    .from("chatbots")
    .select("id,user_id")
    .eq("id", existingConfig.chatbot_id)
    .maybeSingle();

  if (existingBot?.user_id === client_id) {
    finalChatbotId = existingBot.id;
  }
}

// Find WhatsApp bot
if (!finalChatbotId) {
  const { data: workflowBot } = await supabase
    .from("chatbots")
    .select("id")
    .eq("user_id", client_id)
    .eq("workflow_type", "whatsapp_only")
    .maybeSingle();

  if (workflowBot?.id) {
    finalChatbotId = workflowBot.id;
  }
}

// Create bot if none exists
if (!finalChatbotId) {
  const { data: newBot, error: botError } = await supabase
    .from("chatbots")
    .insert({
      user_id: client_id,
      name: "WhatsApp AI Bot",
      welcome_message: "Hello! How can I help you today?",
      model: "gpt-4o-mini",
      temperature: 0.7,
      active: true,
      category: "booking",
      source: "whatsapp",
      is_system: true,
      workflow_type: "whatsapp_only",
    })
    .select("id")
    .single();

  if (botError || !newBot) {
    return NextResponse.json(
      { error: botError?.message || "Failed to create chatbot" },
      { status: 500 }
    );
  }

  finalChatbotId = newBot.id;
}

   console.log("=== BEFORE UPSERT ===");
console.log({
  whatsappToken,
  phone_number: body.phone_number,
  waba_id,
  phone_number_id,
  client_id,
});

    // 3. Update Database Configurations
    const { error: dbError } = await supabase
      .from("whatsapp_configs")
    
      
  .upsert(
    {
      user_id: client_id,
      chatbot_id: finalChatbotId,
      waba_id: waba_id,
      business_id: business_id || waba_id,
      wa_phone_number_id: phone_number_id,
      phone_number: body.phone_number || null,
      whatsapp_access_token: whatsappToken,
      status: "linking",
      automation_enabled: true,
      workflow_type: "whatsapp_only",
    },
    {
      onConflict: "user_id",
    }
  );

    if (dbError) {
      return NextResponse.json({ error: dbError.message }, { status: 400 });
    }

    // 4. STEP 2: Secure Phone Number Registration with Meta (Bypassed if test number)
    try {
      const sanitizedPhoneId = encodeURIComponent(phone_number_id);
      const targetUrl = `https://graph.facebook.com/v23.0/${sanitizedPhoneId}/register`;
      
      await axios.post(
        targetUrl,
        {
          messaging_product: "whatsapp",
          pin: "123456", 
        },
        {
          headers: {
            Authorization: `Bearer ${whatsappToken}`,
            "Content-Type": "application/json",
          },
        }
      );
      console.log("Successfully registered phone number with Meta gateway.");
    } catch (registerError: any) {
      // Safe Log: If it's a Meta test number, we catch the error and continue onboarding anyway
      console.warn(
        "Registration endpoint skipped or not supported for this specific ID. Proceeding to activate setup.",
        registerError?.response?.data || registerError.message
      );
    }
    
    
    // 5. Onboarding operations complete. Set status to active
    await supabase
      .from("whatsapp_configs")
      .update({ status: "active" } as any)
      .eq("user_id", client_id);

    return NextResponse.json({
      success: true,
    });
  } catch (err: any) {
    console.error("ONBOARD ERROR:", err);

    return NextResponse.json(
      {
        error: err.message || "Invalid request body",
      },
      {
        status: 400,
      }
    );
  }
}
