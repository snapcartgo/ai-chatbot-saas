import ChatWidget from "@/app/components/ChatWidget";
import { createClient } from "@supabase/supabase-js";

// This tells Vercel NOT to cache this page so every Client ID works
export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function ChatEmbed({
  params,
}: {
  params: Promise<{ chatbotId: string }>; // Updated to Promise for Next.js 15
}) {
  // ✅ IMPORTANT: We must await params to get the ID from the URL
  const resolvedParams = await params;
  const chatbotId = resolvedParams.chatbotId;

  let plan = "free";

  try {
    // Fetch chatbot details to determine the plan
    const { data: chatbot } = await supabase
      .from("chatbots")
      .select("user_id, is_system")
      .eq("id", chatbotId)
      .single();

    if (chatbot?.is_system) {
      plan = "pro";
    } else if (chatbot?.user_id) {
      const { data: subscription } = await supabase
        .from("subscriptions")
        .select("plan")
        .eq("user_id", chatbot.user_id)
        .single();
      plan = subscription?.plan || "free";
    }
  } catch (err) {
    console.error("Error fetching bot data:", err);
  }

  return (
    <main className="fixed inset-0 bg-white overflow-hidden">
      {/* CRITICAL: We pass the chatbotId we got from the URL here. 
         If this is empty, the widget will use your fallback Admin ID.
      */}
      <ChatWidget chatbotId={chatbotId} isEmbed={true} plan={plan} />
    </main>
  );
}