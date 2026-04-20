import { notFound } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

export const revalidate = 60;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default async function BlogDetailPage({
  params,
}: {
  params: { slug: string };
}) {
  const slug = decodeURIComponent(params.slug);

  const { data, error } = await supabase
    .from("blogs")
    .select("id,title,content,slug,created_at")
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    return <main className="p-6">Error: {error.message}</main>;
  }

  if (!data) return notFound();

  return (
    <main className="max-w-3xl mx-auto p-6">
      <h1 className="text-3xl font-bold">{data.title}</h1>
      <p className="text-sm opacity-70 mt-2">
        {data.created_at ? new Date(data.created_at).toLocaleString() : ""}
      </p>
      <article className="mt-8 whitespace-pre-wrap leading-7">
        {data.content}
      </article>
    </main>
  );
}
