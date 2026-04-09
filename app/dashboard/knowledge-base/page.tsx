"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

// Define limits based on your billing plans
const PLAN_LIMITS: Record<string, number> = {
  free: 1,      // 1MB for testing
  starter: 10,  // 10MB
  pro: 50,      // 50MB
  growth: 100,  // 100MB
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

  // FIX 1: Calculate usage correctly from the database columns
  useEffect(() => {
    // We check file_size first, then fallback to file_size_kb * 1024
    const totalBytes = items.reduce((acc, item) => {
      const size = item.file_size || (item.file_size_kb ? item.file_size_kb * 1024 : 0);
      return acc + size;
    }, 0);
    
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

    const byteSize = new TextEncoder().encode(question + answer).length;

    const { error } = await supabase
      .from("knowledge_base")
      .insert({
        chatbot_id: selectedBot,
        question,
        answer,
        content: question + " " + answer,
        source: "manual",
        file_size: byteSize, // Actual byte size
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

  // FIX 2: Ensure your API actually saves the fileSize sent in formData
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileSizeMB = file.size / (1024 * 1024);

    // CHECK LIMIT
    if (totalUsageMB + fileSizeMB > PLAN_LIMITS[userPlan]) {
      alert(`Adding this file (${fileSizeMB.toFixed(2)}MB) would exceed your ${userPlan} plan limit of ${PLAN_LIMITS[userPlan]}MB.`);
      e.target.value = ""; 
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("chatbotId", selectedBot);
    // CRITICAL: Ensure your /api/upload-pdf route uses this value to update the 'file_size' column
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
        // We wait a second to allow the DB to finish processing before reloading
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
            transition: 'width 0.5s ease-in-out'
          }} />
        </div>
      </div>

      <div style={{ marginBottom: 20 }}>
        <label style={{ display: 'block', marginBottom: 5 }}>Select Chatbot</label>
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