import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

if (typeof (global as any).DOMMatrix === "undefined") {
  (global as any).DOMMatrix = class DOMMatrix {};
}

const pdf = require("pdf-parse-fork");

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("CRITICAL: Supabase keys are missing from process.env!");
}

const supabase = createClient(supabaseUrl || "", supabaseServiceKey || "");

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();

    const file = formData.get("file") as File | null;
    const chatbotId = (formData.get("chatbotId") as string | null) || "";
    const userId = (formData.get("userId") as string | null) || "";
    const channel = (formData.get("channel") as string | null) || "website";

    if (!file) {
      return NextResponse.json({ error: "No file" }, { status: 400 });
    }

    if (!userId) {
      return NextResponse.json({ error: "No user ID provided" }, { status: 400 });
    }

    const isWhatsApp = channel === "whatsapp";

    if (!isWhatsApp && !chatbotId) {
      return NextResponse.json({ error: "No chatbot ID provided" }, { status: 400 });
    }

    const sizeInBytes = file.size;
    const sizeInKB = Math.round(sizeInBytes / 1024);

    const buffer = Buffer.from(await file.arrayBuffer());
    const data = await pdf(buffer);

    const { error: dbError } = await supabase.from("knowledge_base").insert([
      {
        source: file.name,
        content: data.text,
        chatbot_id: isWhatsApp ? null : chatbotId,
        user_id: userId,
        channel: isWhatsApp ? "whatsapp" : "website",
        file_size: sizeInBytes,
        file_size_kb: sizeInKB,
      },
    ]);

    if (dbError) {
      console.error("Database Insert Error:", dbError);
      return NextResponse.json({ error: dbError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Upload Route Error:", error);
    return NextResponse.json({ error: error.message || "Upload failed" }, { status: 500 });
  }
}
