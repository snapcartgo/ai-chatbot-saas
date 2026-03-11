"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function KnowledgeBasePage() {

  const [items, setItems] = useState<any[]>([]);
  const [chatbots, setChatbots] = useState<any[]>([]);
  const [selectedBot, setSelectedBot] = useState("");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadChatbots();
  }, []);

  useEffect(() => {
    if (selectedBot) {
      loadKnowledge();
    }
  }, [selectedBot]);

  // Load user's chatbots
  const loadChatbots = async () => {

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return;

    const { data } = await supabase
      .from("chatbots")
      .select("id,name")
      .eq("user_id", user.id);

    setChatbots(data || []);

    if (data && data.length > 0) {
      setSelectedBot(data[0].id);
    }

    setLoading(false);
  };

  // Load knowledge for selected chatbot
  const loadKnowledge = async () => {

    const { data, error } = await supabase
      .from("knowledge_base")
      .select("*")
      .eq("chatbot_id", selectedBot)
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
    }

    setItems(data || []);
  };

  // Add manual knowledge
  const addKnowledge = async () => {

    if (!question || !answer) {
      alert("Please fill question and answer");
      return;
    }

    const { error } = await supabase
      .from("knowledge_base")
      .insert({
        chatbot_id: selectedBot,
        question,
        answer,
        content: question + " " + answer,
        source: "manual"
      });

    if (error) {
      console.error(error);
      alert("Error saving knowledge");
      return;
    }

    setQuestion("");
    setAnswer("");

    loadKnowledge();
  };

  // Delete knowledge
  const deleteKnowledge = async (id: string) => {

    const { error } = await supabase
      .from("knowledge_base")
      .delete()
      .eq("id", id);

    if (error) {
      console.error(error);
      alert("Error deleting knowledge");
      return;
    }

    loadKnowledge();
  };

  // Upload PDF
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {

    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();

    formData.append("file", file);
    formData.append("chatbotId", selectedBot);

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
      console.error(err);
      alert("Upload error");
    }
  };

  return (
    <div style={{ padding: 30, maxWidth: 900 }}>

      <h1 style={{ fontSize: 28, marginBottom: 20 }}>
        Knowledge Base
      </h1>

      {/* CHATBOT SELECTOR */}

      <div style={{ marginBottom: 20 }}>

        <label>Select Chatbot</label>

        <select
          value={selectedBot}
          onChange={(e) => setSelectedBot(e.target.value)}
          style={{
            width: "100%",
            padding: 10,
            marginTop: 5,
            border: "1px solid #ccc",
            borderRadius: 6
          }}
        >

          {chatbots.map((bot:any) => (
            <option key={bot.id} value={bot.id}>
              {bot.name}
            </option>
          ))}

        </select>

      </div>

      {/* FILE UPLOAD */}

      <div
        style={{
          marginBottom: 20,
          padding: 15,
          border: "1px dashed #ccc",
          borderRadius: 8
        }}
      >

        <p style={{ marginBottom: 10 }}>
          Upload PDF or DOCX
        </p>

        <input
          type="file"
          accept=".pdf,.docx"
          onChange={handleFileUpload}
        />

      </div>

      {/* MANUAL QA */}

      <div style={{ marginBottom: 30 }}>

        <input
          placeholder="Question"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          style={{
            width: "100%",
            padding: 10,
            marginBottom: 10,
            border: "1px solid #ddd",
            borderRadius: 6
          }}
        />

        <textarea
          placeholder="Answer"
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          style={{
            width: "100%",
            padding: 10,
            marginBottom: 10,
            border: "1px solid #ddd",
            borderRadius: 6,
            minHeight: 80
          }}
        />

        <button
          onClick={addKnowledge}
          style={{
            padding: "10px 20px",
            background: "#2563eb",
            color: "#fff",
            border: "none",
            borderRadius: 6
          }}
        >
          Add Knowledge
        </button>

      </div>

      {/* KNOWLEDGE LIST */}

      {items.length === 0 && (
        <p>No knowledge added yet.</p>
      )}

      {items.map((item) => (

        <div
          key={item.id}
          style={{
            border: "1px solid #ddd",
            padding: 15,
            marginBottom: 10,
            borderRadius: 6,
            background: "#fafafa"
          }}
        >

          {item.question && (
            <p><b>Q:</b> {item.question}</p>
          )}

          {item.answer && (
            <p><b>A:</b> {item.answer}</p>
          )}

          {!item.question && (
            <p>
              <b>Document:</b> {item.content?.substring(0,150)}...
            </p>
          )}

          <button
            onClick={() => deleteKnowledge(item.id)}
            style={{
              background: "#ef4444",
              color: "#fff",
              border: "none",
              padding: "6px 12px",
              marginTop: 10,
              borderRadius: 5
            }}
          >
            Delete
          </button>

        </div>

      ))}

    </div>
  );
}