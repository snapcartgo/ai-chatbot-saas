import ChatWidget from "@/app/components/ChatWidget";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function ChatEmbed({
  params,
}: {
  params: { chatbotId: string };
}) {
  // ✅ FIXED (no await)
  const { chatbotId } = params;

  let plan = "free";

  try {
    console.log("CHATBOT ID:", chatbotId);

    // ✅ Fetch chatbot with is_system
    const { data: chatbot, error: chatbotError } = await supabase
      .from("chatbots")
      .select("user_id, is_system")
      .eq("id", chatbotId)
      .single();

    if (chatbotError) {
      console.log("Chatbot fetch error:", chatbotError);
    }

    console.log("CHATBOT DATA:", chatbot);

    // ✅ SaaS/System bot logic
    if (chatbot?.is_system) {
      plan = "pro";
      console.log("SYSTEM BOT → FORCED PRO");
    }

    // ✅ Normal user chatbot
    else if (chatbot?.user_id) {
      const { data: subscription, error: subError } = await supabase
        .from("subscriptions")
        .select("plan")
        .eq("user_id", chatbot.user_id)
        .single();

      if (subError) {
        console.log("Subscription fetch error:", subError);
      }

      plan = subscription?.plan || "free";
    }

    console.log("FINAL PLAN:", plan);
  } catch (err) {
    console.log("UNEXPECTED ERROR:", err);
  }

  return (
    <main className="fixed inset-0 bg-white overflow-hidden">
      <ChatWidget chatbotId={chatbotId} isEmbed={true} plan={plan} />
    </main>
  );
}