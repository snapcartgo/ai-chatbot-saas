import { notFound } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

export const revalidate = 60;

type Blog = {
  id: string;
  title: string | null;
  content: string | null;
  slug: string | null;
  created_at: string | null;
};

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default async function BlogDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug: rawSlug } = await params; // IMPORTANT
  const slug = decodeURIComponent(rawSlug).trim();

  const { data: post, error } = await supabase
    .from("blogs")
    .select("id,title,content,slug,created_at")
    .eq("slug", slug)
    .maybeSingle<Blog>();

  if (error) {
    return <main className="p-6 text-white">Error: {error.message}</main>;
  }

  if (!post) notFound();

  return (
    <main className="max-w-3xl mx-auto p-6 text-white">
      <h1 className="text-4xl font-bold">{post.title ?? "Untitled"}</h1>
      <p className="text-sm opacity-60 mt-2">
        {post.created_at ? new Date(post.created_at).toLocaleString() : ""}
      </p>
      <article className="mt-8 whitespace-pre-wrap leading-7">
        {post.content ?? ""}
      </article>
    </main>
  );
}
