"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function KnowledgeBasePage() {
  const [items, setItems] = useState<any[]>([]);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(true);
  const [chatbotId, setChatbotId] = useState<string | null>(null);

  useEffect(() => {
    loadKnowledge();
  }, []);

  const loadKnowledge = async () => {
    setLoading(true);

    const { data: bot } = await supabase
      .from("chatbots")
      .select("id")
      .limit(1)
      .maybeSingle();

    if (!bot) {
      console.error("No chatbot found in database");
      setLoading(false);
      return;
    }

    setChatbotId(bot.id);

    const { data, error } = await supabase
      .from("knowledge_base")
      .select("*")
      .eq("chatbot_id", bot.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
    }

    setItems(data || []);
    setLoading(false);
  };

  const addKnowledge = async () => {
    if (!question || !answer) {
      alert("Please fill question and answer");
      return;
    }

    if (!chatbotId) {
      alert("Chatbot not found");
      return;
    }

    const { error } = await supabase
      .from("knowledge_base")
      .insert([
        {
          chatbot_id: chatbotId,
          question: question,
          answer: answer,
          content: question + " " + answer,
          source: "manual"
        }
      ]);

    if (error) {
      console.error("Supabase insert error:", error);
      alert("Error saving knowledge");
      return;
    }

    setQuestion("");
    setAnswer("");
    loadKnowledge();
  };

  const deleteKnowledge = async (id: string) => {
    const { error } = await supabase
      .from("knowledge_base")
      .delete()
      .eq("id", id);

    if (error) {
      console.error(error);
      alert("Error deleting knowledge");
    }

    loadKnowledge();
  };

  // CORRECTED: Single function, no duplicates, sends chatbotId to API
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!chatbotId) {
      alert("Chatbot ID not loaded yet. Please wait.");
      return;
    }

    setLoading(true);

    const formData = new FormData();
    formData.append("file", file);
    // CRITICAL: We pass the ID so the API knows which bot this PDF belongs to
    formData.append("chatbotId", chatbotId);

    try {
      const res = await fetch("/api/upload-pdf", {
        method: "POST",
        body: formData
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        alert(data.error || "Upload failed");
      } else {
        alert("Document uploaded and processed successfully!");
        e.target.value = ""; // Clear the file input
        loadKnowledge(); // Refresh the list
      }
    } catch (err) {
      console.error("Upload error:", err);
      alert("An error occurred during upload.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: "30px", maxWidth: "900px" }}>
      <h1 style={{ fontSize: "26px", marginBottom: "20px" }}>
        Knowledge Base
      </h1>

      <div style={{ marginBottom: "20px", padding: "15px", border: "1px dashed #ccc", borderRadius: "8px" }}>
        <p style={{ marginBottom: "10px", fontWeight: "bold" }}>Upload PDF or Docx</p>
        <input
          type="file"
          accept=".pdf,.docx"
          onChange={handleFileUpload}
          disabled={loading}
        />
      </div>

      <div style={{ marginBottom: "30px" }}>
        <input
          placeholder="Question"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          style={{
            width: "100%",
            padding: "10px",
            marginBottom: "10px",
            border: "1px solid #ddd",
            borderRadius: "6px"
          }}
        />

        <textarea
          placeholder="Answer"
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          style={{
            width: "100%",
            padding: "10px",
            marginBottom: "10px",
            border: "1px solid #ddd",
            borderRadius: "6px",
            minHeight: "80px"
          }}
        />

        <button
          onClick={addKnowledge}
          disabled={loading}
          style={{
            padding: "10px 20px",
            background: loading ? "#94a3b8" : "#2563eb",
            color: "#fff",
            border: "none",
            borderRadius: "6px",
            cursor: loading ? "not-allowed" : "pointer"
          }}
        >
          {loading ? "Processing..." : "Add Knowledge"}
        </button>
      </div>

      {loading && <p>Working on it...</p>}

      {!loading && items.length === 0 && (
        <p>No knowledge added yet.</p>
      )}

      {items.map((item) => (
        <div
          key={item.id}
          style={{
            border: "1px solid #ddd",
            padding: "15px",
            marginBottom: "10px",
            borderRadius: "6px",
            background: "#fafafa"
          }}
        >
          {item.question && <p><strong>Q:</strong> {item.question}</p>}
          {item.answer && <p><strong>A:</strong> {item.answer}</p>}
          {item.content && !item.question && (
            <p><strong>Document:</strong> {item.content.substring(0, 150)}...</p>
          )}

          <button
            onClick={() => deleteKnowledge(item.id)}
            style={{
              background: "#ef4444",
              color: "#fff",
              border: "none",
              padding: "6px 12px",
              marginTop: "10px",
              borderRadius: "5px",
              cursor: "pointer"
            }}
          >
            Delete
          </button>
        </div>
      ))}
    </div>
  );
}