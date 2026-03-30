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
  const { chatbotId } = params;

  let plan = "free"; // default fallback

  try {
    // ✅ Step 1: Get chatbot
    const { data: chatbot, error: chatbotError } = await supabase
      .from("chatbots")
      .select("user_id")
      .eq("id", chatbotId)
      .single();

    if (chatbotError) {
      console.log("Chatbot error:", chatbotError);
    }

    // ✅ Step 2: Get subscription (ONLY if chatbot exists)
    if (chatbot?.user_id) {
      const { data: subscription, error: subError } = await supabase
        .from("subscriptions")
        .select("plan")
        .eq("user_id", chatbot.user_id)
        .single();

      if (subError) {
        console.log("Subscription error:", subError);
      }

      plan = subscription?.plan || "free";
    }
  } catch (err) {
    console.log("Unexpected error:", err);
  }

  // ✅ Step 3: Pass plan
  return (
    <main className="fixed inset-0 bg-white overflow-hidden">
      <ChatWidget chatbotId={chatbotId} isEmbed={true} plan={plan} />
    </main>
  );
}