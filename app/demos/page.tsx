"use client";
import { useRouter } from "next/navigation";

const demos = [
  {
    name: "Dentist",
    slug: "dentist",
    description: "AI chatbot for dental clinics",
  },
  {
    name: "Real Estate",
    slug: "real-estate",
    description: "AI chatbot for property leads",
  },
  {
    name: "Gym",
    slug: "gym",
    description: "AI chatbot for memberships",
  },
];

export default function DemoPage() {
  const router = useRouter();

  return (
    <div className="p-10">
      <h1 className="text-3xl font-bold mb-6">Explore AI Chatbot Demos</h1>

      <div className="grid grid-cols-3 gap-6">
        {demos.map((demo) => (
          <div
            key={demo.slug}
            onClick={() => router.push(`/demos/${demo.slug}`)}
            className="p-6 border rounded-xl cursor-pointer hover:shadow-lg"
          >
            <h2 className="text-xl font-semibold">{demo.name}</h2>
            <p className="text-gray-500">{demo.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}