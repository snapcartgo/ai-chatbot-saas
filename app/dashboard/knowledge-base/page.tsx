"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

const PLAN_LIMITS: Record<string, number> = {
  free: 45,
  starter: 10,
  pro: 45,
  growth: 100,
};

type KnowledgeItem = {
  id: string;
  chatbot_id: string | null;
  user_id: string | null;
  channel: string | null;
  question: string | null;
  answer: string | null;
  content: string | null;
  source: string | null;
  file_size: number | null;
  file_size_kb: number | null;
  created_at: string;
};

type ChatbotOption = {
  id: string;
  name: string;
};

export default function KnowledgeBasePage() {
  const [items, setItems] = useState<KnowledgeItem[]>([]);
  const [chatbots, setChatbots] = useState<ChatbotOption[]>([]);
  const [selectedSource, setSelectedSource] = useState("");
  const [userId, setUserId] = useState("");
  const [loading, setLoading] = useState(true);

  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");

  const [userPlan, setUserPlan] = useState("free");
  const [totalUsageMB, setTotalUsageMB] = useState(0);

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (selectedSource && userId) {
      loadKnowledge();
    }
  }, [selectedSource, userId]);

  useEffect(() => {
    const totalBytes = items.reduce((acc, item) => {
      const size = item.file_size || (item.file_size_kb ? item.file_size_kb * 1024 : 0);
      return acc + size;
    }, 0);

    setTotalUsageMB(totalBytes / (1024 * 1024));
  }, [items]);

  const loadInitialData = async () => {
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setLoading(false);
      return;
    }

    setUserId(user.id);

    const [{ data: botData }, { data: subData }] = await Promise.all([
      supabase
        .from("chatbots")
        .select("id, name")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true }),
      supabase.from("subscriptions").select("plan").eq("user_id", user.id).maybeSingle(),
    ]);

    const websiteBots = (botData || []) as ChatbotOption[];
    setChatbots(websiteBots);

    if (websiteBots.length > 0) {
      setSelectedSource(websiteBots[0].id);
    } else {
      setSelectedSource("whatsapp");
    }

    if (subData?.plan) {
      setUserPlan(String(subData.plan).toLowerCase());
    }

    setLoading(false);
  };

  const loadKnowledge = async () => {
  if (!selectedSource || !userId) return;

  const isWhatsApp = selectedSource === "whatsapp";

  let query = supabase
    .from("knowledge_base")
    .select("*")
    .order("created_at", { ascending: false });

  if (isWhatsApp) {
    query = query
      .eq("user_id", userId)
      .eq("channel", "whatsapp");
  } else {
    query = query
      .eq("chatbot_id", selectedSource);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Load knowledge error:", error);
    alert(error.message);
    return;
  }

  console.log("Selected source:", selectedSource);
  console.log("Logged in user:", userId);
  console.log("Loaded knowledge:", data);

  setItems(data || []);
};


  const addKnowledge = async () => {
    if (!question.trim() || !answer.trim()) {
      alert("Please fill question and answer");
      return;
    }

    if (!selectedSource) {
      alert("Please select Website Chatbot or WhatsApp Channel");
      return;
    }

    if (totalUsageMB >= PLAN_LIMITS[userPlan]) {
      alert(`Storage limit reached for ${userPlan} plan.`);
      return;
    }

    const isWhatsApp = selectedSource === "whatsapp";
    const byteSize = new TextEncoder().encode(question + answer).length;

    const { error } = await supabase.from("knowledge_base").insert({
      chatbot_id: isWhatsApp ? null : selectedSource,
      user_id: userId,
      channel: isWhatsApp ? "whatsapp" : "website",
      question,
      answer,
      content: question + " " + answer,
      source: "manual",
      file_size: byteSize,
      file_size_kb: Math.round(byteSize / 1024),
    });

    if (error) {
      console.error("Add knowledge error:", error);
      alert(error.message);
      return;
    }

    setQuestion("");
    setAnswer("");
    loadKnowledge();
  };

  const deleteKnowledge = async (id: string) => {
    const { error } = await supabase.from("knowledge_base").delete().eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

    loadKnowledge();
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!selectedSource) {
      alert("Please select Website Chatbot or WhatsApp Channel");
      e.target.value = "";
      return;
    }

    const fileSizeMB = file.size / (1024 * 1024);
    const currentLimit = PLAN_LIMITS[userPlan] || 10;

    if (totalUsageMB + fileSizeMB > currentLimit) {
      alert(`Exceeds ${userPlan} plan limit.`);
      e.target.value = "";
      return;
    }

    const isWhatsApp = selectedSource === "whatsapp";

    const formData = new FormData();
    formData.append("file", file);
    formData.append("chatbotId", isWhatsApp ? "" : selectedSource);
    formData.append("userId", userId);
    formData.append("channel", isWhatsApp ? "whatsapp" : "website");

    try {
      const res = await fetch("/api/upload-pdf", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        alert(data.error || "Upload failed");
        return;
      }

      alert("Document uploaded successfully");
      e.target.value = "";
      loadKnowledge();
    } catch (err) {
      console.error("Upload error:", err);
      alert("Upload error");
    }
  };

  if (loading) {
    return <div style={{ padding: 30 }}>Loading...</div>;
  }

  const currentLimit = PLAN_LIMITS[userPlan] || 10;
  const usagePercentage = Math.min((totalUsageMB / currentLimit) * 100, 100);

  return (
    <div style={{ padding: 30, maxWidth: 900 }}>
      <h1 style={{ fontSize: 28, marginBottom: 10 }}>Knowledge Base</h1>

      <div style={{ marginBottom: 30, padding: 15, border: "1px solid #ddd", borderRadius: 8 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
          <span>
            Plan: <b>{userPlan.toUpperCase()}</b>
          </span>
          <span>
            {totalUsageMB.toFixed(2)} MB / {currentLimit} MB
          </span>
        </div>

        <div style={{ width: "100%", height: 10, background: "#e5e7eb", borderRadius: 5 }}>
          <div
            style={{
              width: `${usagePercentage}%`,
              height: "100%",
              background: usagePercentage > 90 ? "#ef4444" : "#2563eb",
              borderRadius: 5,
            }}
          />
        </div>
      </div>

      <div style={{ marginBottom: 20 }}>
        <label style={{ display: "block", marginBottom: 6 }}>Select Source</label>
        <select
          value={selectedSource}
          onChange={(e) => setSelectedSource(e.target.value)}
          style={{ width: "100%", padding: 12, border: "1px solid #ccc", borderRadius: 6 }}
        >
          {chatbots.map((bot) => (
            <option key={bot.id} value={bot.id}>
              Website Chatbot: {bot.name}
            </option>
          ))}

          <option value="whatsapp">WhatsApp Channel</option>
        </select>
      </div>

      <div style={{ marginBottom: 20, padding: 20, border: "2px dashed #ccc", borderRadius: 8 }}>
        <p style={{ marginBottom: 10 }}>Upload PDF or DOCX</p>
        <input type="file" accept=".pdf,.docx" onChange={handleFileUpload} />
      </div>

      <div style={{ marginBottom: 30, padding: 20, border: "1px solid #ddd", borderRadius: 8 }}>
        <h3 style={{ marginBottom: 15 }}>Manual Q&A</h3>

        <input
          placeholder="Question"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          style={{ width: "100%", padding: 12, marginBottom: 12, border: "1px solid #ccc", borderRadius: 6 }}
        />

        <textarea
          placeholder="Answer"
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          style={{ width: "100%", padding: 12, marginBottom: 12, border: "1px solid #ccc", borderRadius: 6, minHeight: 100 }}
        />

        <button
          onClick={addKnowledge}
          style={{ width: "100%", padding: 12, background: "#2563eb", color: "#fff", border: "none", borderRadius: 6 }}
        >
          Add Knowledge
        </button>
      </div>

      <h3 style={{ marginBottom: 15 }}>Stored Knowledge</h3>

      {items.length === 0 ? (
        <p>No knowledge added yet.</p>
      ) : (
        items.map((item) => (
          <div key={item.id} style={{ border: "1px solid #ddd", padding: 15, marginBottom: 12, borderRadius: 8 }}>
            {item.question ? (
              <>
                <p>
                  <b>Q:</b> {item.question}
                </p>
                <p>
                  <b>A:</b> {item.answer}
                </p>
              </>
            ) : (
              <p>
                <b>Document:</b> {item.source}
              </p>
            )}

            <p style={{ fontSize: 12, color: "#666" }}>
              Channel: {item.channel || "website"}
            </p>

            <button
              onClick={() => deleteKnowledge(item.id)}
              style={{ marginTop: 10, color: "#ef4444", border: "1px solid #ef4444", background: "transparent", padding: "6px 10px" }}
            >
              Delete
            </button>
          </div>
        ))
      )}
    </div>
  );
}
