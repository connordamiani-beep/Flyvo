import type { Config } from "@netlify/functions";

// Flyvo fares function.
// Reads recent fares from the Travelpayouts (Aviasales) Data API and returns a
// shortlist to the search page. The API token lives in the Netlify environment
// variable TRAVELPAYOUTS_TOKEN and is never sent to the browser.

const API = "https://api.travelpayouts.com";
const MARKER = "779486";

const ORIGINS: Record<string, string> = {
  London: "LON",
  Manchester: "MAN",
  Birmingham: "BHX",
  Edinburgh: "EDI",
  Glasgow: "GLA",
  Bristol: "BRS",
  Leeds: "LBA",
  Newcastle: "NCL",
  Liverpool: "LPL",
};

type Lookups = {
  at?: number;
  cities: Record<string, { name: string; country: string }>;
  countries: Record<string, string>;
  airlines: Record<string, string>;
};
const cache: { value?: Lookups } = {};

function json(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...headers },
  });
}

async function getJson(url: string, token?: string) {
  const res = await fetch(url, { headers: token ? { "X-Access-Token": token } : {} });
  if (!res.ok) throw new Error("status " + res.status);
  return res.json();
}

// City, country and airline names. Cached for a few hours; falls back to codes.
async function lookups(): Promise<Lookups> {
  const now = Date.now();
  if (cache.value && cache.value.at && now - cache.value.at < 6 * 3600 * 1000) return cache.value;
  const out: Lookups = { at: now, cities: {}, countries: {}, airlines: {} };
  try {
    const [cities, countries, airlines] = await Promise.all([
      getJson(API + "/data/en/cities.json"),
      getJson(API + "/data/en/countries.json"),
      getJson(API + "/data/en/airlines.json"),
    ]);
    for (const c of countries as any[]) if (c && c.code) out.countries[c.code] = c.name;
    for (const c of cities as any[]) {
      if (c && c.code) out.cities[c.code] = { name: c.name, country: out.countries[c.country_code] || "" };
    }
    for (const a of airlines as any[]) if (a && a.code && a.name) out.airlines[a.code] = a.name;
  } catch {
    // keep whatever we managed to load; the page copes with missing names
  }
  cache.value = out;
  return out;
}
function nightsBetween(dep: string, ret: string) {
  return Math.round((Date.parse(ret) - Date.parse(dep)) / 86400000);
}

function pickBest(tickets: any[], nights: number, tolerance: number, preferClose: boolean) {
  const best = new Map<string, { t: any; gap: number }>();
  for (const t of tickets) {
    if (!t || !t.destination || !t.price || !t.departure_at || !t.return_at || typeof t.link !== "string") continue;
    const n = nightsBetween(t.departure_at, t.return_at);
    const gap = Math.abs(n - nights);
    if (!(n >= 1) || gap > tolerance) continue;
    const prev = best.get(t.destination);
    const better =
      !prev ||
      (preferClose ? gap < prev.gap || (gap === prev.gap && t.price < prev.t.price) : t.price < prev.t.price);
    if (better) best.set(t.destination, { t, gap });
  }
  return new Map([...best].map(([k, v]) => [k, v.t]));
}

function shortlist(tickets: any[], nights: number) {
  const best = pickBest(tickets, nights, 2, false);
  if (best.size < 20) {
    for (const [dest, t] of pickBest(tickets, nights, 5, true)) if (!best.has(dest)) best.set(dest, t);
  }
  return best;
}

export default async (req: Request) => {
  const token = Netlify.env.get("TRAVELPAYOUTS_TOKEN");
  if (!token) return json({ ok: false, error: "not_configured" }, 503);

  const url = new URL(req.url);
  const origin = ORIGINS[url.searchParams.get("origin") ?? ""];
  const month = url.searchParams.get("month") ?? "";
  const nights = parseInt(url.searchParams.get("nights") ?? "", 10);
  if (!origin || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || !(nights >= 2 && nights <= 21)) {
    return json({ ok: false, error: "bad_request" }, 400);
  }

  const qs = new URLSearchParams({
    origin,
    departure_at: month,
    one_way: "false",
    sorting: "price",
    limit: "1000",
    currency: "gbp",
  });

  let tickets: any[] = [];
  try {
    const data = await getJson(API + "/aviasales/v3/prices_for_dates?" + qs.toString(), token);
    tickets = Array.isArray(data?.data) ? data.data : [];
  } catch {
    return json({ ok: false, error: "upstream" }, 502);
  }

  const best = shortlist(tickets, nights);

  const look = await lookups();
  const fares = [...best.values()]
    .sort((a, b) => a.price - b.price)
    .slice(0, 40)
    .map((t) => {
      const city = look.cities[t.destination];
      const minutes = Number(t.duration_to) || (Number(t.duration) ? Math.round(Number(t.duration) / 2) : null);
      const path = t.link.startsWith("/") ? t.link : "/" + t.link;
      return {
        destination: t.destination,
        name: city ? city.name : t.destination,
        country: city ? city.country : "",
        airline: t.airline || "",
        airline_name: look.airlines[t.airline] || t.airline || "",
        price: t.price,
        departure_at: t.departure_at,
        return_at: t.return_at,
        nights: nightsBetween(t.departure_at, t.return_at),
        transfers: Number(t.transfers) || 0,
        minutes,
        link:
          "https://www.aviasales.com" + path + (path.includes("?") ? "&" : "?") + "marker=" + MARKER + "&currency=gbp",
      };
    });

  if (!fares.length) return json({ ok: false, error: "no_results" }, 200);

  return json({ ok: true, source: "recent_searches", fares }, 200, {
    "Cache-Control": "public, max-age=600",
    "Netlify-CDN-Cache-Control": "public, max-age=3600",
  });
};

export const config: Config = {
  path: "/api/fares",
};
