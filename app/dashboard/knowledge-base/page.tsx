"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

const PLAN_LIMITS: Record<string, number> = {
  free: 45,
  starter: 10,
  pro: 45,
  growth: 100,
};

export default function KnowledgeBasePage() {
  const [items, setItems] = useState<any[]>([]);
  const [chatbots, setChatbots] = useState<any[]>([]);
  const [selectedBot, setSelectedBot] = useState("");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(true);

  const [userPlan, setUserPlan] = useState("starter");
  const [totalUsageMB, setTotalUsageMB] = useState(0);

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (selectedBot) {
      loadKnowledge();
    }
  }, [selectedBot]);

  useEffect(() => {
    const totalBytes = items.reduce((acc, item) => {
      const size = item.file_size || (item.file_size_kb ? item.file_size_kb * 1024 : 0);
      return acc + size;
    }, 0);

    setTotalUsageMB(totalBytes / (1024 * 1024));
  }, [items]);

  // =========================
  // ✅ LOAD BOTH BOTS
  // =========================
  const loadInitialData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // 🌐 Website bots
    const { data: webBots } = await supabase
      .from("chatbots")
      .select("id,name")
      .eq("user_id", user.id);

    // 📱 WhatsApp bots
    const { data: waBots } = await supabase
      .from("whatsapp_configs")
      .select("id, phone_number")
      .eq("user_id", user.id);

    const formattedWebBots = (webBots || []).map((bot: any) => ({
      id: bot.id,
      name: `🌐 ${bot.name}`,
      type: "web",
    }));

    const formattedWaBots = (waBots || []).map((bot: any) => ({
      id: `wa_${bot.id}`, // 🔥 IMPORTANT PREFIX
      name: `📱 WhatsApp (${bot.phone_number})`,
      type: "whatsapp",
    }));

    const allBots = [...formattedWebBots, ...formattedWaBots];

    setChatbots(allBots);

    if (allBots.length > 0) {
      setSelectedBot(allBots[0].id);
    }

    // Load Plan
    const { data: sub } = await supabase
      .from("subscriptions")
      .select("plan")
      .eq("user_id", user.id)
      .single();

    if (sub) setUserPlan(sub.plan.toLowerCase());

    setLoading(false);
  };

  // =========================
  // LOAD KNOWLEDGE
  // =========================
  const loadKnowledge = async () => {
    const isWhatsApp = selectedBot.startsWith("wa_");
    const realId = isWhatsApp ? selectedBot.replace("wa_", "") : selectedBot;

    const { data, error } = await supabase
      .from("knowledge_base")
      .select("*")
      .eq("chatbot_id", realId)
      .order("created_at", { ascending: false });

    if (error) console.error(error);
    setItems(data || []);
  };

  // =========================
  // ADD KNOWLEDGE
  // =========================
  const addKnowledge = async () => {
    if (!question || !answer) {
      alert("Please fill question and answer");
      return;
    }

    if (totalUsageMB >= PLAN_LIMITS[userPlan]) {
      alert(`Storage limit reached for ${userPlan} plan.`);
      return;
    }

    const isWhatsApp = selectedBot.startsWith("wa_");
    const realId = isWhatsApp ? selectedBot.replace("wa_", "") : selectedBot;

    const byteSize = new TextEncoder().encode(question + answer).length;

    const { error } = await supabase.from("knowledge_base").insert({
      chatbot_id: realId,
      question,
      answer,
      content: question + " " + answer,
      source: isWhatsApp ? "whatsapp_manual" : "manual",
      file_size: byteSize,
      file_size_kb: Math.round(byteSize / 1024),
    });

    if (error) {
      alert("Error saving knowledge");
      return;
    }

    setQuestion("");
    setAnswer("");
    loadKnowledge();
  };

  // =========================
  // FILE UPLOAD
  // =========================
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isWhatsApp = selectedBot.startsWith("wa_");
    const realId = isWhatsApp ? selectedBot.replace("wa_", "") : selectedBot;

    const fileSizeMB = file.size / (1024 * 1024);

    if (totalUsageMB + fileSizeMB > PLAN_LIMITS[userPlan]) {
      alert("Storage limit exceeded");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("chatbotId", realId);
    formData.append("fileSize", file.size.toString());

    await fetch("/api/upload-pdf", {
      method: "POST",
      body: formData,
    });

    setTimeout(() => loadKnowledge(), 1000);
  };

  // =========================
  if (loading) return <div style={{ padding: 30, color: '#fff', background: '#000' }}>Loading...</div>;

  return (
    <div style={{ padding: 30, color: '#fff', background: '#000', minHeight: '100vh' }}>
      <h1>Knowledge Base</h1>

      {/* BOT SELECT */}
      <select
        value={selectedBot}
        onChange={(e) => setSelectedBot(e.target.value)}
        style={{ width: "100%", padding: 10, marginBottom: 20 }}
      >
        {chatbots.map((bot: any) => (
          <option key={bot.id} value={bot.id}>
            {bot.name}
          </option>
        ))}
      </select>

      {/* FILE UPLOAD */}
      <input type="file" onChange={handleFileUpload} />

      {/* Q&A */}
      <input
        placeholder="Question"
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
      />

      <textarea
        placeholder="Answer"
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
      />

      <button onClick={addKnowledge}>Add</button>

      {/* LIST */}
      {items.map((item) => (
        <div key={item.id}>
          <p>{item.question}</p>
          <p>{item.answer}</p>
        </div>
      ))}
    </div>
  );
}