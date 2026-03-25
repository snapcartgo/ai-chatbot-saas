import ChatWidget from "@/app/components/ChatWidget"; // Adjust this path to your actual chat component

export default async function ChatEmbed({ params }: { params: { chatbotId: string } }) {
  const { chatbotId } = await params;

  return (
    // This div forces the chat to fill the entire browser window/iframe
    <main className="w-screen h-screen bg-white">
      <ChatWidget chatbotId={chatbotId} isEmbed={true} />
    </main>
  );
}