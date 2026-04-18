import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const body = await req.json(); // 🔥 MISSING LINE
    const { title, content } = body;

    if (!title || !content) {
      return NextResponse.json(
        { error: "Missing title or content" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("blogs")
      .insert([
        {
          title,
          content,
          slug: title.toLowerCase().replace(/\s+/g, "-"),
        },
      ])
      .select();

    if (error) {
      return NextResponse.json({ error }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });

  } catch (err) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}