import type { APIRoute } from "astro";
import { sql } from "../../lib/db.mjs";

const SITE_URL = import.meta.env.SITE || "https://treeservicenews.com";

function buildCaption(brief: any): string {
  let teaser = brief.card_blurb || brief.reader_hook || "";

  if (!teaser && brief.summary) {
    // Pull first sentence from summary as a last resort
    const match = brief.summary.match(/^[^.!?]+[.!?]/);
    teaser = match ? match[0].trim() : brief.summary.slice(0, 160).trim() + "…";
  }

  const lines: string[] = [];
  if (teaser) lines.push(teaser);
  lines.push(
    "Here's the quick Tree Service News brief on what happened and why it matters for tree service owners."
  );
  return lines.join("\n\n");
}

export const POST: APIRoute = async ({ request, cookies }) => {
  const token = cookies.get("admin_token")?.value;
  if (token !== import.meta.env.ADMIN_SECRET) {
    return new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  let briefId: number;
  try {
    const body = await request.json();
    briefId = parseInt(body.briefId);
    if (!briefId || isNaN(briefId)) throw new Error("invalid id");
  } catch {
    return new Response(JSON.stringify({ ok: false, error: "Invalid request body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const [brief] = await sql`
    SELECT id, title, slug, summary, card_blurb, reader_hook, status
    FROM links WHERE id = ${briefId} AND status = 'published'
  `;
  if (!brief) {
    return new Response(
      JSON.stringify({ ok: false, error: "Brief not found or not published" }),
      { status: 404, headers: { "Content-Type": "application/json" } }
    );
  }

  const pageId    = import.meta.env.FACEBOOK_PAGE_ID;
  const pageToken = import.meta.env.FACEBOOK_PAGE_TOKEN;
  console.log("FB env check — PAGE_ID:", !!pageId, "PAGE_TOKEN:", !!pageToken);
  if (!pageId || !pageToken) {
    return new Response(
      JSON.stringify({ ok: false, error: "Facebook credentials not configured (FACEBOOK_PAGE_ID / FACEBOOK_PAGE_TOKEN)" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  const briefUrl = `${SITE_URL}/briefs/${brief.slug}`;
  const message  = buildCaption(brief);

  let fbRes: Response;
  try {
    fbRes = await fetch(`https://graph.facebook.com/v19.0/${pageId}/feed`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ message, link: briefUrl, access_token: pageToken }),
      signal: AbortSignal.timeout(15000),
    });
  } catch (e: any) {
    console.error("post-to-facebook: network error", e);
    return new Response(
      JSON.stringify({ ok: false, error: "Network error reaching Facebook API" }),
      { status: 502, headers: { "Content-Type": "application/json" } }
    );
  }

  const fbData = await fbRes.json();
  if (!fbRes.ok || fbData.error) {
    console.error("post-to-facebook: FB API error", fbData);
    return new Response(
      JSON.stringify({ ok: false, error: fbData.error?.message ?? "Facebook API error" }),
      { status: 502, headers: { "Content-Type": "application/json" } }
    );
  }

  await sql`UPDATE links SET facebook_posted_at = NOW(), updated_at = NOW() WHERE id = ${briefId}`;

  return new Response(JSON.stringify({ ok: true, postId: fbData.id }), {
    headers: { "Content-Type": "application/json" },
  });
};
