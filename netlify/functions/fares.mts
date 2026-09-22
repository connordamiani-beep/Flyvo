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
