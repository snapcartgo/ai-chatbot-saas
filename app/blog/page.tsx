import Link from "next/link";
import { createClient } from "@supabase/supabase-js";

export const revalidate = 60;

type BlogRow = {
  id: string;
  title: string | null;
  slug: string | null;
  created_at: string | null;
};

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function BlogPage() {
  // Change "blog" to your real table name if different (e.g. "block")
  const { data, error } = await supabase
    .from("blog")
    .select("id,title,slug,created_at")
    .order("created_at", { ascending: false });

  if (error) {
    return <main className="p-6">Failed to load blogs.</main>;
  }

  const posts = (data ?? []) as BlogRow[];

  return (
    <main className="max-w-3xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Blog</h1>

      <div className="space-y-4">
        {posts.map((post) => (
          <article key={post.id} className="border rounded-xl p-4">
            <h2 className="text-xl font-semibold">
              <Link href={`/blog/${post.slug}`}>{post.title ?? "Untitled"}</Link>
            </h2>
            <p className="text-sm opacity-70 mt-1">
              {post.created_at
                ? new Date(post.created_at).toLocaleString()
                : "No date"}
            </p>
          </article>
        ))}
      </div>
    </main>
  );
}
