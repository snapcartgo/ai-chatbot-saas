"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

// Define limits based on your billing plans
const PLAN_LIMITS: Record<string, number> = {
  free: 1,      // 1MB for testing
  starter: 10,  // 10MB
  pro: 50,     // 50MB
  growth: 100, // 100MB
};

export default function KnowledgeBasePage() {
  const [items, setItems] = useState<any[]>([]);
  const [chatbots, setChatbots] = useState<any[]>([]);
  const [selectedBot, setSelectedBot] = useState("");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(true);

  // New states for Plan Management
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

  // Calculate usage whenever items (knowledge base) change
  useEffect(() => {
    const totalBytes = items.reduce((acc, item) => acc + (item.file_size || 0), 0);
    setTotalUsageMB(totalBytes / (1024 * 1024)); // Convert Bytes to MB
  }, [items]);

  const loadInitialData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // 1. Load Chatbots
    const { data: bots } = await supabase
      .from("chatbots")
      .select("id,name")
      .eq("user_id", user.id);
    setChatbots(bots || []);
    if (bots && bots.length > 0) setSelectedBot(bots[0].id);

    // 2. Load User Plan from Subscriptions table
    const { data: sub } = await supabase
      .from("subscriptions")
      .select("plan")
      .eq("user_id", user.id)
      .single();
    if (sub) setUserPlan(sub.plan.toLowerCase());

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

    // CHECK LIMIT
    if (totalUsageMB >= PLAN_LIMITS[userPlan]) {
      alert(`Storage limit reached for ${userPlan} plan. Please upgrade to add more.`);
      return;
    }

    const { error } = await supabase
      .from("knowledge_base")
      .insert({
        chatbot_id: selectedBot,
        question,
        answer,
        content: question + " " + answer,
        source: "manual",
        file_size: (question.length + answer.length) // Rough byte size for text
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

    // CHECK LIMIT
    if (totalUsageMB + fileSizeMB > PLAN_LIMITS[userPlan]) {
      alert(`Adding this file (${fileSizeMB.toFixed(2)}MB) would exceed your ${userPlan} plan limit of ${PLAN_LIMITS[userPlan]}MB.`);
      e.target.value = ""; // Reset input
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("chatbotId", selectedBot);
    // Send file size so your API can save it to the DB
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
        loadKnowledge();
      }
    } catch (err) {
      alert("Upload error");
    }
  };

  if (loading) return <div style={{ padding: 30 }}>Loading...</div>;

  const currentLimit = PLAN_LIMITS[userPlan] || 10;
  const usagePercentage = Math.min((totalUsageMB / currentLimit) * 100, 100);

  return (
    <div style={{ padding: 30, maxWidth: 900, color: '#fff', background: '#000', minHeight: '100vh' }}>
      <h1 style={{ fontSize: 28, marginBottom: 20 }}>Knowledge Base</h1>

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
            transition: 'width 0.3s ease'
          }} />
        </div>
      </div>

      <div style={{ marginBottom: 20 }}>
        <label>Select Chatbot</label>
        <select
          value={selectedBot}
          onChange={(e) => setSelectedBot(e.target.value)}
          style={{ width: "100%", padding: 10, marginTop: 5, border: "1px solid #333", borderRadius: 6, background: '#111', color: '#fff' }}
        >
          {chatbots.map((bot: any) => (
            <option key={bot.id} value={bot.id}>{bot.name}</option>
          ))}
        </select>
      </div>

      {/* FILE UPLOAD */}
      <div style={{ marginBottom: 20, padding: 15, border: "1px dashed #444", borderRadius: 8 }}>
        <p style={{ marginBottom: 10 }}>Upload PDF or DOCX</p>
        <input type="file" accept=".pdf,.docx" onChange={handleFileUpload} />
      </div>

      {/* MANUAL QA */}
      <div style={{ marginBottom: 30 }}>
        <input
          placeholder="Question"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          style={{ width: "100%", padding: 10, marginBottom: 10, border: "1px solid #333", borderRadius: 6, background: '#111', color: '#fff' }}
        />
        <textarea
          placeholder="Answer"
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          style={{ width: "100%", padding: 10, marginBottom: 10, border: "1px solid #333", borderRadius: 6, background: '#111', color: '#fff', minHeight: 80 }}
        />
        <button
          onClick={addKnowledge}
          style={{ padding: "10px 20px", background: "#2563eb", color: "#fff", border: "none", borderRadius: 6, cursor: 'pointer' }}
        >
          Add Knowledge
        </button>
      </div>

      {/* KNOWLEDGE LIST */}
      {items.length === 0 ? <p>No knowledge added yet.</p> : (
        items.map((item) => (
          <div key={item.id} style={{ border: "1px solid #333", padding: 15, marginBottom: 10, borderRadius: 6, background: "#111" }}>
            {item.question && <p><b>Q:</b> {item.question}</p>}
            {item.answer && <p><b>A:</b> {item.answer}</p>}
            {!item.question && <p><b>Document:</b> {item.content?.substring(0, 150)}...</p>}
            <button
              onClick={() => deleteKnowledge(item.id)}
              style={{ background: "#ef4444", color: "#fff", border: "none", padding: "6px 12px", marginTop: 10, borderRadius: 5, cursor: 'pointer' }}
            >
              Delete
            </button>
          </div>
        ))
      )}
    </div>
  );
}