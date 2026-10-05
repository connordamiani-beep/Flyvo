// Flyvo quick guide: a few short, practical notes about a destination for a given month,
// written by Claude and shown in the "About" panel on each flight card.
// Uses the same ANTHROPIC_API_KEY environment variable as the search.

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

// Remembered while the function stays warm, so repeat views don't cost another Claude call
const cache = new Map<string, unknown>();

function json(body: unknown, status = 200, cacheable = false) {
  const headers: Record<string, string> = { "content-type": "application/json; charset=utf-8" };
  if (cacheable) {
    // Let Netlify's CDN keep each guide for 30 days, and browsers for a day
    headers["cache-control"] = "public, max-age=86400";
    headers["netlify-cdn-cache-control"] = "public, durable, max-age=2592000";
  } else {
    headers["cache-control"] = "no-store";
  }
  return new Response(JSON.stringify(body), { status, headers });
}

export default async (req: Request) => {
  const params = new URL(req.url).searchParams;
  const clean = (v: string | null) => (v || "").trim().replace(/\s+/g, " ").slice(0, 60);
  const city = clean(params.get("city"));
  const country = clean(params.get("country"));
  const month = MONTHS.find((m) => m.toLowerCase() === clean(params.get("month")).toLowerCase()) || "";

  const okName = (s: string) => /^[\p{L}\p{M} .'’()-]+$/u.test(s);
  if (!city || !okName(city) || (country && !okName(country))) {
    return json({ error: "Which place would you like to know about?" }, 400);
  }

  const key = Netlify.env.get("ANTHROPIC_API_KEY");
  if (!key) return json({ error: "The guide isn't switched on yet." }, 503);

  const cacheKey = `${city}|${country}|${month}`.toLowerCase();
  if (cache.has(cacheKey)) return json(cache.get(cacheKey), 200, true);

  const place = country ? `${city}, ${country}` : city;
  const system = `You write short, practical, honest travel notes for Flyvo, a UK flight finder. Write in British English for UK travellers.
Keep every note to one sentence of 25 words or fewer. Be specific about the place, but don't invent facts: no named restaurants or hotels, no exact prices, no ratings, and never present anything as a review. Give typical costs as rough ranges in GBP and say they're rough. If the place is a region or island, describe it as a whole.
Always answer by calling the set_guide tool.`;

  try {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 9000);
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      signal: ctl.signal,
      headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 600,
        system,
        tools: [{
          name: "set_guide",
          description: "Quick guide to a destination",
          input_schema: {
            type: "object",
            properties: {
              good_for: { type: "string", description: "What kind of trip or traveller the place suits best" },
              weather: { type: "string", description: `What the weather is usually like${month ? " in " + month : ""}, and what to pack` },
              costs: { type: "string", description: "Rough everyday costs for a UK visitor (a meal, a drink, getting around), as rough GBP ranges" },
              tip: { type: "string", description: "One genuinely useful local tip" },
            },
            required: ["good_for", "weather", "costs", "tip"],
          },
        }],
        tool_choice: { type: "tool", name: "set_guide" },
        messages: [{ role: "user", content: `Quick guide for a trip to ${place}${month ? " in " + month : ""}.` }],
      }),
    });
    clearTimeout(timer);
    if (!res.ok) return json({ error: "The guide isn't available right now." }, 502);

    const data = await res.json();
    const tool = (data.content || []).find((c: any) => c.type === "tool_use");
    const a = tool && tool.input;
    const text = (v: any) => (typeof v === "string" ? v.trim().slice(0, 300) : "");
    if (!a || !text(a.good_for)) return json({ error: "The guide isn't available right now." }, 502);

    const body = {
      place,
      month,
      notes: [
        { label: "Good for", text: text(a.good_for) },
        { label: month ? `Weather in ${month}` : "Weather", text: text(a.weather) },
        { label: "Rough costs", text: text(a.costs) },
        { label: "Local tip", text: text(a.tip) },
      ].filter((n) => n.text),
    };
    cache.set(cacheKey, body);
    return json(body, 200, true);
  } catch {
    return json({ error: "The guide isn't available right now." }, 502);
  }
};

export const config = { path: "/api/guide" };
