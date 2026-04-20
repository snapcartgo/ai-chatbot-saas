import Link from "next/link";
import { createClient } from "@supabase/supabase-js";

export const revalidate = 60;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default async function BlogPage() {
  const { data, error } = await supabase
    .from("blogs") // IMPORTANT
    .select("id,title,slug,created_at")
    .order("created_at", { ascending: false });

  if (error) {
    return <main className="p-6">Failed to load blogs: {error.message}</main>;
  }

  return (
    <main className="max-w-3xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Blog</h1>
      <div className="space-y-4">
        {(data ?? []).map((post) => (
          <article key={post.id} className="border rounded-xl p-4">
            <h2 className="text-xl font-semibold">
              <Link href={`/blog/${post.slug}`}>{post.title}</Link>
            </h2>
          </article>
        ))}
      </div>
    </main>
  );
}
