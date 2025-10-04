/**
 * Utility to trigger Next.js revalidation from the backend
 */

const FRONTEND_URL = process.env.FRONTEND_URL || "https://news-site-spring-wind-3063.fly.dev";
const REVALIDATE_SECRET = process.env.REVALIDATE_SECRET || "your-super-secret-revalidation-token-change-this";

interface RevalidateOptions {
  category?: string;
  slug?: string;
  type?: "article" | "homepage" | "all";
}

export async function revalidateArticle(options: RevalidateOptions): Promise<void> {
  const { category, slug, type } = options;

  const body: any = {};

  if (category && slug) {
    body.category = category;
    body.slug = slug;
    body.type = "article";
  } else if (type === "all") {
    body.tag = "articles";
  } else if (type === "homepage") {
    body.path = "/";
  }

  try {
    const response = await fetch(`${FRONTEND_URL}/api/revalidate?secret=${REVALIDATE_SECRET}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      console.error(`Revalidation failed: ${response.status} ${response.statusText}`);
    } else {
      const data = await response.json();
      console.log("Revalidation successful:", data);
    }
  } catch (error) {
    // Don't throw - revalidation failure shouldn't break the API
    console.error("Revalidation error:", error);
  }
}
