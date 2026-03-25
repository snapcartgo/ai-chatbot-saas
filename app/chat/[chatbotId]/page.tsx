import ChatWidget from "@/app/components/ChatWidget";

export default async function ChatEmbed({ params }: { params: { chatbotId: string } }) {
  // Use await for params in Next.js 14/15
  const { chatbotId } = await params;

  return (
    <main className="fixed inset-0 bg-white overflow-hidden">
      <ChatWidget chatbotId={chatbotId} isEmbed={true} />
    </main>
  );
}