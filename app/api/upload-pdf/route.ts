import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Manually define the polyfill to stop the DOMMatrix crash
if (typeof (global as any).DOMMatrix === "undefined") {
  (global as any).DOMMatrix = class DOMMatrix {};
}

const pdf = require("pdf-parse-fork");

// Use the Service Role Key to bypass RLS for your Knowledge Base
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("CRITICAL: Supabase keys are missing from process.env!");
}

const supabase = createClient(supabaseUrl || '', supabaseServiceKey || '');

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const chatbotId = formData.get("chatbotId"); 

    if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });
    if (!chatbotId) return NextResponse.json({ error: "No chatbot ID provided" }, { status: 400 });

    // --- FIX: CAPTURE FILE SIZE ---
    // We get the size in bytes directly from the file object
    const sizeInBytes = file.size; 
    const sizeInKB = Math.round(sizeInBytes / 1024);

    const buffer = Buffer.from(await file.arrayBuffer());
    const data = await pdf(buffer);

    // --- FIX: INCLUDE SIZE IN THE INSERT ---
    const { error: dbError } = await supabase
      .from("knowledge_base")
      .insert([{ 
        source: file.name,
        content: data.text,
        chatbot_id: chatbotId,
        file_size: sizeInBytes,    // Updates your 'file_size' column
        file_size_kb: sizeInKB     // Updates your 'file_size_kb' column
      }]);

    if (dbError) {
      console.error("Database Insert Error:", dbError);
      throw dbError;
    }

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error("Upload Route Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}