import ChatWidget from "@/app/components/ChatWidget";

export default async function ChatEmbed({ params }: { params: { chatbotId: string } }) {
  const { chatbotId } = await params;

  return (
    // 'fixed inset-0' ensures it fills the iframe perfectly without gaps
    <main className="fixed inset-0 bg-white overflow-hidden">
      <ChatWidget chatbotId={chatbotId} isEmbed={true} />
    </main>
  );
}