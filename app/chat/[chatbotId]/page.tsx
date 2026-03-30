import ChatWidget from "@/app/components/ChatWidget";
import { createClient } from "@supabase/supabase-js";

// Ensure the page is never cached so different Bot IDs always load correctly
export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function ChatEmbed({
  params,
}: {
  params: { chatbotId: string }; // ✅ Matches your capital 'I' folder name
}) {
  // Extract the ID from params
  const { chatbotId } = params;

  let plan = "free";

  try {
    console.log("LOG: Loading Chatbot ID:", chatbotId);

    // Fetch chatbot details
    const { data: chatbot, error: chatbotError } = await supabase
      .from("chatbots")
      .select("user_id, is_system")
      .eq("id", chatbotId)
      .single();

    if (chatbotError || !chatbot) {
      console.log("LOG: Chatbot fetch error or not found:", chatbotError);
    } else {
      // Handle System vs User Bot Plan Logic
      if (chatbot.is_system) {
        plan = "pro";
        console.log("LOG: SYSTEM BOT → FORCED PRO");
      } else if (chatbot.user_id) {
        const { data: subscription } = await supabase
          .from("subscriptions")
          .select("plan")
          .eq("user_id", chatbot.user_id)
          .single();

        plan = subscription?.plan || "free";
      }
    }

    console.log("LOG: FINAL PLAN:", plan);
  } catch (err) {
    console.log("LOG: UNEXPECTED ERROR:", err);
  }

  return (
    <main className="fixed inset-0 bg-white overflow-hidden">
      {/* Passing the dynamic chatbotId to the widget.
         This ensures the widget uses the Client's ID from the URL 
         instead of falling back to your Admin ID.
      */}
      <ChatWidget chatbotId={chatbotId} isEmbed={true} plan={plan} />
    </main>
  );
}