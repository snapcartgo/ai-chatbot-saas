"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function KnowledgeBasePage() {

  const [items, setItems] = useState<any[]>([]);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(true);

  // Load knowledge when page opens
  useEffect(() => {
    loadKnowledge();
  }, []);

  const loadKnowledge = async () => {

    setLoading(true);

    // Get current user
    const { data: userData } = await supabase.auth.getUser();
    const user = userData?.user;

    if (!user) {
      console.error("User not found");
      setLoading(false);
      return;
    }

    // Get chatbot for this user
    const { data: bot } = await supabase
      .from("chatbots")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (!bot) {
      console.error("Chatbot not found");
      setLoading(false);
      return;
    }

    // Load knowledge for this chatbot
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

    // Get current user
    const { data: userData } = await supabase.auth.getUser();
    const user = userData?.user;

    if (!user) {
      alert("User not found");
      return;
    }

    // Get chatbot
    const { data: bot, error: botError } = await supabase
      .from("chatbots")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (botError || !bot) {
      alert("Chatbot not found");
      return;
    }

    // Insert knowledge
    const { error } = await supabase
      .from("knowledge_base")
      .insert([
        {
          chatbot_id: bot.id,
          question: question,
          answer: answer,
          content: question + " " + answer,
          source: "manual"
        }
      ]);

    if (error) {
      console.error(error);
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