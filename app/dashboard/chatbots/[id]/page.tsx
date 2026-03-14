"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";

export default function ChatbotSettings() {

  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [loading, setLoading] = useState(true);
  const [bot, setBot] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {

    const loadBot = async () => {

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      const { data, error } = await supabase
        .from("chatbots")
        .select("*")
        .eq("id", id)
        .eq("user_id", user.id)
        .single();

      if (error) {
        console.error("Load bot error:", error);
        return;
      }

      // IMPORTANT FIX: ensure category is never null
      setBot({
        ...data,
        category: data?.category || "booking",
      });

      setLoading(false);
    };

    loadBot();

  }, [id, router]);



  const handleSave = async () => {

    setSaving(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      alert("User not logged in");
      return;
    }

    const { data, error } = await supabase
      .from("chatbots")
      .update({
        name: bot.name,
        model: bot.model,
        temperature: bot.temperature,
        welcome_message: bot.welcome_message,
        category: bot.category,
      })
      .eq("id", id)
      .eq("user_id", user.id)
      .select()
      .single();

    setSaving(false);

    if (error) {
      console.error("Update error:", error);
      alert("Error saving changes");
      return;
    }

    setBot(data);
    alert("Chatbot updated successfully!");

  };



  const handleDelete = async () => {

    const confirmDelete = confirm(
      "Are you sure you want to delete this chatbot?"
    );

    if (!confirmDelete) return;

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/login");
      return;
    }

    const { error } = await supabase
      .from("chatbots")
      .delete()
      .match({
        id: id,
        user_id: user.id,
      });

    if (error) {
      console.error("Delete error:", error);
      alert("Error deleting chatbot");
      return;
    }

    alert("Chatbot deleted successfully");

    router.push("/dashboard/chatbots");
    router.refresh();

  };



  if (loading) return <p>Loading...</p>;
  if (!bot) return <p>Chatbot not found.</p>;



  return (
    <div style={{ padding: 40, maxWidth: 600 }}>

      <h1>Edit Chatbot</h1>

      {/* NAME */}

      <div style={{ marginTop: 20 }}>
        <label>Name</label>
        <input
          type="text"
          value={bot.name || ""}
          onChange={(e) =>
            setBot({ ...bot, name: e.target.value })
          }
          style={{ width: "100%", padding: 8, marginTop: 5 }}
        />
      </div>


      {/* CATEGORY */}

      <div style={{ marginTop: 20 }}>
        <label>Business Category</label>

        <select
          value={bot.category}
          onChange={(e) =>
            setBot({ ...bot, category: e.target.value })
          }
          style={{ width: "100%", padding: 8, marginTop: 5 }}
        >
          <option value="booking">Booking</option>
          <option value="ecommerce">Ecommerce</option>
        </select>
      </div>


      {/* MODEL */}

      <div style={{ marginTop: 20 }}>
        <label>Model</label>
        <select
          value={bot.model}
          onChange={(e) =>
            setBot({ ...bot, model: e.target.value })
          }
          style={{ width: "100%", padding: 8, marginTop: 5 }}
        >
          <option value="gpt-4o-mini">gpt-4o-mini</option>
          <option value="gpt-4o">gpt-4o</option>
        </select>
      </div>


      {/* TEMPERATURE */}

      <div style={{ marginTop: 20 }}>
        <label>Temperature</label>
        <input
          type="number"
          step="0.1"
          min="0"
          max="1"
          value={bot.temperature}
          onChange={(e) =>
            setBot({
              ...bot,
              temperature: parseFloat(e.target.value),
            })
          }
          style={{ width: "100%", padding: 8, marginTop: 5 }}
        />
      </div>


      {/* WELCOME MESSAGE */}

      <div style={{ marginTop: 20 }}>
        <label>Welcome Message</label>
        <textarea
          value={bot.welcome_message}
          onChange={(e) =>
            setBot({
              ...bot,
              welcome_message: e.target.value,
            })
          }
          style={{
            width: "100%",
            padding: 8,
            marginTop: 5,
            minHeight: 100,
          }}
        />
      </div>



      {/* SAVE BUTTON */}

      <button
        onClick={handleSave}
        disabled={saving}
        style={{
          marginTop: 30,
          padding: "10px 20px",
          background: "#2563eb",
          color: "white",
          borderRadius: 6,
        }}
      >
        {saving ? "Saving..." : "Save Changes"}
      </button>



      {/* DELETE BUTTON */}

      <button
        onClick={handleDelete}
        style={{
          marginTop: 15,
          marginLeft: 10,
          padding: "10px 20px",
          background: "red",
          color: "white",
          borderRadius: 6,
        }}
      >
        Delete Chatbot
      </button>



      {/* MANAGE DOMAINS */}

      <div style={{ marginTop: 20 }}>
        <Link
          href={`/dashboard/chatbots/${id}/domains`}
          style={{
            padding: "10px 20px",
            background: "#10b981",
            color: "white",
            borderRadius: 6,
            textDecoration: "none",
            display: "inline-block",
          }}
        >
          Manage Domains
        </Link>
      </div>



      {/* EMBED SCRIPT */}

      <div style={{ marginTop: 40 }}>
        <h3>Embed Script</h3>

        <p>Copy and paste this into your website:</p>

        <textarea
          readOnly
          value={`<script src="https://ai-chatbot-saas-five.vercel.app/widget.js" data-bot-id="${id}"></script>`}
          style={{
            width: "100%",
            padding: 10,
            minHeight: 80,
            marginTop: 10,
            background: "#111",
            color: "white",
            borderRadius: 8,
          }}
        />

        <button
          onClick={() => {
            navigator.clipboard.writeText(
              `<script src="https://ai-chatbot-saas-five.vercel.app/widget.js" data-bot-id="${id}"></script>`
            );
            alert("Copied!");
          }}
          style={{
            marginTop: 10,
            padding: "8px 15px",
            background: "#2563eb",
            color: "white",
            borderRadius: 6,
          }}
        >
          Copy Script
        </button>

      </div>

    </div>
  );
}