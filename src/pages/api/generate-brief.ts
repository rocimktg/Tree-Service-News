import type { APIRoute } from "astro";
import Anthropic from "@anthropic-ai/sdk";

export const POST: APIRoute = async ({ request, cookies }) => {
  const token = cookies.get("admin_token")?.value;
  if (token !== import.meta.env.ADMIN_SECRET) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  let url: string;
  try {
    ({ url } = await request.json());
    if (!url) throw new Error();
  } catch {
    return new Response(JSON.stringify({ error: "Missing URL." }), { status: 400 });
  }

  // Fetch article HTML and strip to plain text
  let articleText = "";
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; TreeServiceNews/1.0)" },
      signal: AbortSignal.timeout(10000),
    });
    const html = await res.text();
    articleText = html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 10000);
  } catch {
    return new Response(JSON.stringify({ error: "Could not fetch the article. Check the URL and try again." }), { status: 400 });
  }

  const client = new Anthropic({ apiKey: import.meta.env.ANTHROPIC_API_KEY });

  const message = await client.messages.create({
    model: "claude-opus-4-7",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: `You are an editor for Tree Service News (TSN), a curated industry news site for tree service companies and arborists. Write in a plain, direct, no-fluff voice aimed at working tree crews and small business owners.

Given the article below, return a JSON object with exactly these fields:
- title: Rewritten headline for tree service owners. Clear and direct. No clickbait.
- source_name: The publication or website name (e.g. "TCIA", "Arborist Now", "Pro Climber")
- summary: 2–4 sentences. What happened, factual and clear.
- tsn_take: 1 short paragraph. Practical angle for tree crews and owners — what to do or think about.
- why_it_matters: 1–2 sentences. What owners, climbers, or crew should take away.
- category: Exactly one of these slugs: gear | safety | storm-response | business | marketing | climbing | insurance | hiring | industry-news | tree-wtf | arborist-news | eco-watch

Article URL: ${url}

Article content:
${articleText}

Respond with ONLY valid JSON. No markdown, no explanation.`,
      },
    ],
  });

  const raw = message.content[0].type === "text" ? message.content[0].text.trim() : "";

  // Strip markdown code fences if Claude includes them
  const cleaned = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();

  try {
    const data = JSON.parse(cleaned);
    return new Response(JSON.stringify(data), {
      headers: { "Content-Type": "application/json" },
    });
  } catch {
    return new Response(JSON.stringify({ error: "AI returned an unexpected response. Try again." }), { status: 500 });
  }
};
