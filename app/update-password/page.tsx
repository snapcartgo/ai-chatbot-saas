"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function UpdatePassword() {

  const [password,setPassword] = useState("");
  const router = useRouter();

  const handleUpdate = async (e:any) => {
    e.preventDefault();

    const { error } = await supabase.auth.updateUser({
      password: password
    });

    if(error){
      alert(error.message);
    }else{
      alert("Password updated!");
      router.push("/login");
    }
  };

  return(
    <main className="min-h-screen flex items-center justify-center bg-gray-950 text-white">

      <div className="bg-gray-900 p-10 rounded-xl w-full max-w-md">

        <h1 className="text-2xl font-bold mb-6">
          Set new password
        </h1>

        <form onSubmit={handleUpdate} className="space-y-4">

          <input
            type="password"
            placeholder="New password"
            className="w-full p-3 rounded bg-gray-800 border border-gray-700"
            value={password}
            onChange={(e)=>setPassword(e.target.value)}
          />

          <button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 p-3 rounded"
          >
            Update Password
          </button>

        </form>

      </div>

    </main>
  )
}