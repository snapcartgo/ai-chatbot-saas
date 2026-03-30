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
  // ✅ FIX HERE
  const { chatbotId } = await params;

  let plan = "free";

  try {
    const { data: chatbot } = await supabase
      .from("chatbots")
      .select("user_id")
      .eq("id", chatbotId)
      .single();

    if (chatbot?.user_id) {
      const { data: subscription } = await supabase
        .from("subscriptions")
        .select("plan")
        .eq("user_id", chatbot.user_id)
        .single();

      plan = subscription?.plan || "free";
    }

    console.log("PLAN FROM SERVER:", plan); // ✅ debug
  } catch (err) {
    console.log("Error:", err);
  }

  return (
    <main className="fixed inset-0 bg-white overflow-hidden">
      <ChatWidget chatbotId={chatbotId} isEmbed={true} plan={plan} />
    </main>
  );
}