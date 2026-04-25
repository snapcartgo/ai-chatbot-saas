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
  const [loading, setLoading] = useState(true);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");

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

  const loadInitialData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // 1. Fetch Website Bots, WhatsApp Bots, and Subscription in parallel
    const [webRes, waRes, subRes] = await Promise.all([
      supabase.from("chatbots").select("id, name").eq("user_id", user.id),
      supabase.from("whatsapp_configs").select("id, bot_name").eq("user_id", user.id),
      supabase.from("subscriptions").select("plan").eq("user_id", user.id).single()
    ]);

    // 2. Format Website Bots
    const websiteBots = (webRes.data || []).map(bot => ({
      id: bot.id,
      name: `🌐 ${bot.name}`,
      source: 'website'
    }));

    // 3. Format WhatsApp Bots
    const whatsappBots = (waRes.data || []).map(bot => ({
      id: bot.id,
      name: `💬 ${bot.bot_name || 'WhatsApp Bot'}`,
      source: 'whatsapp'
    }));

    // 4. Merge into single list
    const combinedBots = [...websiteBots, ...whatsappBots];
    setChatbots(combinedBots);

    if (combinedBots.length > 0) {
      setSelectedBot(combinedBots[0].id);
    }

    if (subRes.data) {
      setUserPlan(subRes.data.plan.toLowerCase());
    }

    setLoading(false);
  };

  const loadKnowledge = async () => {
    const { data, error } = await supabase
      .from("knowledge_base")
      .select("*")
      .eq("chatbot_id", selectedBot)
      .order("created_at", { ascending: false });

    if (error) console.error(error);
    setItems(data || []);
  };

  const addKnowledge = async () => {
    if (!question || !answer) {
      alert("Please fill question and answer");
      return;
    }

    if (totalUsageMB >= PLAN_LIMITS[userPlan]) {
      alert(`Storage limit reached for ${userPlan} plan.`);
      return;
    }

    const byteSize = new TextEncoder().encode(question + answer).length;

    const { error } = await supabase
      .from("knowledge_base")
      .insert({
        chatbot_id: selectedBot,
        question,
        answer,
        content: question + " " + answer,
        source: "manual",
        file_size: byteSize,
        file_size_kb: Math.round(byteSize / 1024)
      });

    if (error) {
      alert("Error saving knowledge");
      return;
    }

    setQuestion("");
    setAnswer("");
    loadKnowledge();
  };

  const deleteKnowledge = async (id: string) => {
    const { error } = await supabase.from("knowledge_base").delete().eq("id", id);
    if (error) alert("Error deleting knowledge");
    loadKnowledge();
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileSizeMB = file.size / (1024 * 1024);

    if (totalUsageMB + fileSizeMB > PLAN_LIMITS[userPlan]) {
      alert(`Exceeds ${userPlan} plan limit.`);
      e.target.value = ""; 
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("chatbotId", selectedBot);
    formData.append("fileSize", file.size.toString());

    try {
      const res = await fetch("/api/upload-pdf", {
        method: "POST",
        body: formData
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        alert(data.error || "Upload failed");
      } else {
        alert("Document uploaded successfully");
        setTimeout(() => loadKnowledge(), 1000);
      }
    } catch (err) {
      alert("Upload error");
    }
  };

  if (loading) return <div style={{ padding: 30, color: '#fff', background: '#000' }}>Loading...</div>;

  const currentLimit = PLAN_LIMITS[userPlan] || 10;
  const usagePercentage = Math.min((totalUsageMB / currentLimit) * 100, 100);

  return (
    <div style={{ padding: 30, maxWidth: 900, color: '#fff', background: '#000', minHeight: '100vh', fontFamily: 'sans-serif' }}>
      <h1 style={{ fontSize: 28, marginBottom: 10 }}>Knowledge Base</h1>
      <p style={{ color: '#888', marginBottom: 20 }}>Manage training data for Website and WhatsApp bots</p>

      {/* STORAGE USAGE BAR */}
      <div style={{ marginBottom: 30, padding: 15, background: '#111', borderRadius: 8, border: '1px solid #333' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <span>Plan: <b>{userPlan.toUpperCase()}</b></span>
          <span>{totalUsageMB.toFixed(2)} MB / {currentLimit} MB</span>
        </div>
        <div style={{ width: '100%', height: 10, background: '#333', borderRadius: 5, overflow: 'hidden' }}>
          <div style={{ 
            width: `${usagePercentage}%`, 
            height: '100%', 
            background: usagePercentage > 90 ? '#ef4444' : '#2563eb',
            transition: 'width 0.5s ease-in-out'
          }} />
        </div>
      </div>

      <div style={{ marginBottom: 20 }}>
        <label style={{ display: 'block', marginBottom: 5 }}>Select Source (Website or WhatsApp)</label>
        <select
          value={selectedBot}
          onChange={(e) => setSelectedBot(e.target.value)}
          style={{ width: "100%", padding: 12, border: "1px solid #333", borderRadius: 6, background: '#111', color: '#fff' }}
        >
          {chatbots.map((bot: any) => (
            <option key={bot.id} value={bot.id}>{bot.name}</option>
          ))}
        </select>
      </div>

      <div style={{ marginBottom: 20, padding: 20, border: "2px dashed #333", borderRadius: 8, textAlign: 'center' }}>
        <p style={{ marginBottom: 15 }}>Upload PDF or DOCX</p>
        <input type="file" accept=".pdf,.docx" onChange={handleFileUpload} style={{ color: '#888' }} />
      </div>

      <div style={{ marginBottom: 30, padding: 20, background: '#111', borderRadius: 8 }}>
        <h3 style={{ marginBottom: 15 }}>Manual Q&A</h3>
        <input
          placeholder="Question"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          style={{ width: "100%", padding: 12, marginBottom: 12, border: "1px solid #333", borderRadius: 6, background: '#000', color: '#fff' }}
        />
        <textarea
          placeholder="Answer"
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          style={{ width: "100%", padding: 12, marginBottom: 12, border: "1px solid #333", borderRadius: 6, background: '#000', color: '#fff', minHeight: 100 }}
        />
        <button
          onClick={addKnowledge}
          style={{ width: '100%', padding: "12px", background: "#2563eb", color: "#fff", border: "none", borderRadius: 6, cursor: 'pointer', fontWeight: 'bold' }}
        >
          Add Knowledge
        </button>
      </div>

      <h3 style={{ marginBottom: 15 }}>Stored Knowledge</h3>
      {items.length === 0 ? <p style={{ color: '#666' }}>No knowledge added yet.</p> : (
        items.map((item) => (
          <div key={item.id} style={{ border: "1px solid #333", padding: 15, marginBottom: 12, borderRadius: 8, background: "#0a0a0a" }}>
            {item.question && <p style={{ marginBottom: 5 }}><b>Q:</b> {item.question}</p>}
            {item.answer && <p style={{ color: '#ccc' }}><b>A:</b> {item.answer}</p>}
            {!item.question && (
              <div>
                <p><b>📄 Document:</b> {item.source}</p>
                <small style={{ color: '#666' }}>
                   Size: {item.file_size ? (item.file_size / 1024).toFixed(1) : (item.file_size_kb || 0)} KB
                </small>
              </div>
            )}
            <button
              onClick={() => deleteKnowledge(item.id)}
              style={{ background: "transparent", color: "#ef4444", border: "1px solid #ef4444", padding: "5px 10px", marginTop: 10, borderRadius: 4, cursor: 'pointer', fontSize: 12 }}
            >
              Delete
            </button>
          </div>
        ))
      )}
    </div>
  );
}