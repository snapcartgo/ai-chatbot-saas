"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function KnowledgeBasePage() {

  const [items, setItems] = useState<any[]>([]);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(true);
  const chatbotId = "68d88301-949c-4b5d-a6a9-6d0b5ac8ce6b";

  useEffect(() => {
    loadKnowledge();
  }, []);

  const loadKnowledge = async () => {

    setLoading(true);

    const { data, error } = await supabase
      .from("knowledge_base")
      .select("*")
      .eq("chatbot_id", chatbotId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Load Knowledge Error:", error);
      alert(error.message);
    }

    setItems(data || []);
    setLoading(false);
  };

  const addKnowledge = async () => {

    if (!question || !answer) {
      alert("Please fill question and answer");
      return;
    }

    const { data, error } = await supabase
      .from("knowledge_base")
      .insert([
        {
          chatbot_id: chatbotId,
          question: question,
          answer: answer,
          content: question + " " + answer,
          source: "manual"
        }
      ])
      .select();

    if (error) {
      console.error("Insert Error:", error);
      alert(error.message);
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
      console.error("Delete Error:", error);
      alert(error.message);
    }

    loadKnowledge();
  };

  return (

    <div style={{ padding: "30px", maxWidth: "900px" }}>

      <h1 style={{ fontSize: "26px", marginBottom: "20px" }}>
        Knowledge Base
      </h1>

      {/* Add Knowledge */}

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
          style={{
            padding: "10px 20px",
            background: "#2563eb",
            color: "#fff",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer"
          }}
        >
          Add Knowledge
        </button>

      </div>

      {/* Knowledge List */}

      {loading && <p>Loading...</p>}

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

          <p><strong>Q:</strong> {item.question}</p>
          <p><strong>A:</strong> {item.answer}</p>

          <button
            onClick={() => deleteKnowledge(item.id)}
            style={{
              background: "red",
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