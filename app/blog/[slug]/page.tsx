
import { notFound } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import type { Metadata } from "next";

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

// SEO metadata
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;

  const { data: post } = await supabase
    .from("blogs")
    .select("title, content")
    .eq("slug", decodeURIComponent(slug))
    .maybeSingle();

  if (!post) {
    return {
      title: "Blog Not Found | Woodpetra",
    };
  }

  const description =
    post.content?.replace(/<[^>]*>/g, "").slice(0, 160) ||
    "Read this blog article on Woodpetra.";

  return {
    title: `${post.title} | Woodpetra`,
    description,
    alternates: {
      canonical: `https://woodpetra.in/blog/${slug}`,
    },
    openGraph: {
      title: post.title ?? "",
      description,
      url: `https://woodpetra.in/blog/${slug}`,
      siteName: "Woodpetra",
      type: "article",
    },
    twitter: {
      card: "summary_large_image",
      title: post.title ?? "",
      description,
    },
  };
}

export default async function BlogDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const decodedSlug = decodeURIComponent(slug).trim();

  const { data: post, error } = await supabase
    .from("blogs")
    .select("id,title,content,slug,created_at")
    .eq("slug", decodedSlug)
    .maybeSingle<Blog>();

  if (error) {
    return (
      <main className="max-w-3xl mx-auto p-6">
        <h1>Error</h1>
        <p>{error.message}</p>
      </main>
    );
  }

  if (!post) {
    notFound();
  }

  return (
    <main className="max-w-3xl mx-auto px-6 py-10">
      <h1 className="text-4xl font-bold mb-4">
        {post.title ?? "Untitled"}
      </h1>

      {post.created_at && (
        <p className="text-sm text-gray-500 mb-8">
          {new Date(post.created_at).toLocaleDateString()}
        </p>
      )}

      <article className="prose max-w-none">
        {post.content ? (
          <div
            dangerouslySetInnerHTML={{
              __html: post.content,
            }}
          />
        ) : (
          <p>No content available.</p>
        )}
      </article>
    </main>
  );
}

