import { notFound } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

export const revalidate = 60;

type BlogDetail = {
  id: string;
  title: string | null;
  content: string | null;
  slug: string | null;
  created_at: string | null;
};

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function BlogDetailPage({
  params,
}: {
  params: { slug: string };
}) {
  // Change "blog" to your real table name if different (e.g. "block")
  const { data, error } = await supabase
    .from("blog")
    .select("id,title,content,slug,created_at")
    .eq("slug", params.slug)
    .single();

  if (error || !data) return notFound();

  const post = data as BlogDetail;

  return (
    <main className="max-w-3xl mx-auto p-6">
      <h1 className="text-3xl font-bold">{post.title ?? "Untitled"}</h1>
      <p className="text-sm opacity-70 mt-2">
        {post.created_at ? new Date(post.created_at).toLocaleString() : ""}
      </p>

      <article className="mt-8 whitespace-pre-wrap leading-7">
        {post.content ?? ""}
      </article>
    </main>
  );
}
