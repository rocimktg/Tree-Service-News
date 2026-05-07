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
    max_tokens: 2048,
    messages: [
      {
        role: "user",
        content: `You are an editor for Tree Service News (TSN), a curated industry news site for tree service companies and arborists. Write in a plain, direct, no-fluff voice for working tree crews and small business owners.

Given the article below, return a single JSON object with ALL of the following fields. Respond with ONLY valid JSON — no markdown, no explanation.

EDITORIAL FIELDS (shown publicly):
- title: Rewritten headline for tree service owners. Clear and direct. No clickbait.
- source_name: The publication or website name (e.g. "TCIA", "Arborist Now", "Pro Climber")
- summary: 2–4 sentences. What happened, factual and clear. No invented facts.
- tsn_take: 1 short paragraph. Practical angle for tree crews and owners.
- why_it_matters: 1–2 sentences. What owners, climbers, or crew should take away.
- category: Exactly one slug: gear | safety | storm-response | business | marketing | climbing | insurance | hiring | industry-news | tree-wtf | arborist-news | eco-watch

METADATA FIELDS (used for cards, related posts, and article footer):
- reader_hook: One sentence explaining why a working tree pro would click this.
- card_blurb: 1–2 sentences for article cards, more operator-focused than the summary.
- impact_badge: One short phrase from: Storm Watch | Gear Watch | Safety Note | Business Angle | Good for Owners | Good for Crews | Good for Arborists | Field Relevant | Weird One | Insurance Angle | Equipment ROI | Utility Watch | Municipal Angle
- audience: Array of 1–4 from: Owner-Operator | Small Crew | Growth Company | Established Company | Arborist | Climber | Utility Vegetation | Municipal Crew | Storm Contractor | Land Manager | Equipment Buyer
- business_impact: Array of 1–3 from: Makes Money | Saves Time | Reduces Risk | Improves Safety | Helps Hiring | Improves Equipment Decisions | Supports Storm Readiness | Improves Professionalism | Industry Awareness
- job_relevance: Array of 1–5 from: Tree Removal | Pruning | Storm Cleanup | Stump Grinding | Crane Work | Grapple Saw Work | Land Clearing | Plant Health Care | Utility Work | Municipal Work | Forestry | Restoration | Marketing | Insurance | Safety | Business Operations | Equipment | Hiring | Reviews | Google Visibility
- read_next_tags: Array of 3–6 lowercase tags for related article matching (e.g. "storm response", "grapple saw", "crew safety")
- dwell_prompt: One practical question for the article footer (e.g. "Would this change how you schedule storm response work?")
- weirdness_level: Exactly one of: Normal | Odd | Tree WTF
- urgency: Exactly one of: High | Medium | Low
- operator_type_fit: Short phrase for who this is most relevant for (e.g. "Best for small crews and growth-stage companies")
- why_this_is_here: For unusual or Tree WTF stories only — why this belongs on TSN. Return null for normal articles.

Article URL: ${url}

Article content:
${articleText}`,
      },
    ],
  });

  const raw = message.content[0].type === "text" ? message.content[0].text.trim() : "";
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
