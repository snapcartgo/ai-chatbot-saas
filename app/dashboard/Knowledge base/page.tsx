"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function KnowledgeBase() {

  const [question,setQuestion] = useState("");
  const [answer,setAnswer] = useState("");
  const [items,setItems] = useState<any[]>([]);

  const loadData = async () => {

    const { data } = await supabase
      .from("knowledge_base")
      .select("*");

    setItems(data || []);

  };

  useEffect(()=>{
    loadData();
  },[]);

  const addItem = async () => {

    await supabase
      .from("knowledge_base")
      .insert({
        question,
        answer
      });

    setQuestion("");
    setAnswer("");

    loadData();
  };

  return (

<div className="p-6">

<h1 className="text-2xl font-bold mb-4">Knowledge Base</h1>

<div className="space-y-3 mb-6">

<input
placeholder="Question"
value={question}
onChange={(e)=>setQuestion(e.target.value)}
className="border p-2 w-full"
/>

<textarea
placeholder="Answer"
value={answer}
onChange={(e)=>setAnswer(e.target.value)}
className="border p-2 w-full"
/>

<button
onClick={addItem}
className="bg-blue-600 text-white px-4 py-2 rounded"
>
Add Knowledge
</button>

</div>

<div>

{items.map((item)=>(
<div key={item.id} className="border p-3 mb-2">

<strong>{item.question}</strong>

<p>{item.answer}</p>

</div>
))}

</div>

</div>

  );

}