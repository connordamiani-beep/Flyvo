// Flyvo live flight search: turns plain English into a Travelpayouts (Aviasales) price lookup.
// Needs one secret environment variable: TRAVELPAYOUTS_TOKEN
// Optional: TRAVELPAYOUTS_MARKER (defaults to 779486), TRAVELPAYOUTS_MARKET

const MONTHS = ["january","february","march","april","may","june","july","august","september","october","november","december"];

const ORIGINS: Record<string, string> = {
  london: "LON", heathrow: "LHR", gatwick: "LGW", stansted: "STN", luton: "LTN", "london city": "LCY",
  manchester: "MAN", birmingham: "BHX", edinburgh: "EDI", glasgow: "GLA", bristol: "BRS", liverpool: "LPL",
  newcastle: "NCL", leeds: "LBA", "leeds bradford": "LBA", belfast: "BFS", cardiff: "CWL",
  "east midlands": "EMA", nottingham: "EMA", derby: "EMA", sheffield: "DSA", doncaster: "DSA",
  southampton: "SOU", aberdeen: "ABZ", exeter: "EXT", norwich: "NWI", bournemouth: "BOH",
  inverness: "INV", newquay: "NQY", dublin: "DUB", cork: "ORK",
};

// Used to pick the nearest UK departure city from the visitor's location
const UK_HUBS: Array<[string, number, number]> = [
  ["LON", 51.51, -0.13], ["MAN", 53.48, -2.24], ["BHX", 52.48, -1.9], ["EDI", 55.95, -3.19],
  ["GLA", 55.86, -4.25], ["BRS", 51.45, -2.59], ["LPL", 53.41, -2.98], ["NCL", 54.98, -1.62],
  ["LBA", 53.8, -1.55], ["BFS", 54.6, -5.93], ["CWL", 51.48, -3.18], ["EMA", 52.95, -1.15],
  ["DSA", 53.38, -1.47], ["SOU", 50.9, -1.4], ["ABZ", 57.15, -2.09], ["EXT", 50.72, -3.53],
  ["NWI", 52.63, 1.3], ["INV", 57.48, -4.22],
];

function nearestHub(lat: number, lon: number) {
  let best = "LON", bestD = Infinity;
  for (const [code, la, lo] of UK_HUBS) {
    const dLat = (la - lat) * 111;
    const dLon = (lo - lon) * 111 * Math.cos((lat * Math.PI) / 180);
    const d = dLat * dLat + dLon * dLon;
    if (d < bestD) { bestD = d; best = code; }
  }
  return best;
}

const PLACES: Record<string, string> = {
  LON: "London", MAN: "Manchester", BHX: "Birmingham", EDI: "Edinburgh", GLA: "Glasgow", BRS: "Bristol",
  LPL: "Liverpool", NCL: "Newcastle", LBA: "Leeds", BFS: "Belfast", CWL: "Cardiff",
  LIS: "Lisbon", BCN: "Barcelona", PAR: "Paris", ROM: "Rome", AMS: "Amsterdam", TCI: "Tenerife", TFS: "Tenerife",
  AGP: "Malaga", FAO: "Faro", PRG: "Prague", KRK: "Krakow", DUB: "Dublin", BER: "Berlin", MAD: "Madrid",
  ATH: "Athens", DXB: "Dubai", NYC: "New York", RAK: "Marrakech", PMI: "Palma", BUD: "Budapest",
  VIE: "Vienna", CPH: "Copenhagen", REK: "Reykjavik", MIL: "Milan", VCE: "Venice", FLR: "Florence",
  NAP: "Naples", IST: "Istanbul", ALC: "Alicante", IBZ: "Ibiza", LPA: "Gran Canaria", ACE: "Lanzarote",
  FUE: "Fuerteventura", SVQ: "Seville", VLC: "Valencia", OPO: "Porto", GVA: "Geneva", ZRH: "Zurich",
  BRU: "Brussels", WAW: "Warsaw", RIX: "Riga", TLL: "Tallinn", HEL: "Helsinki", OSL: "Oslo", STO: "Stockholm",
  SOF: "Sofia", DBV: "Dubrovnik", SPU: "Split", CFU: "Corfu", HER: "Heraklion", LCA: "Larnaca", MLA: "Malta",
  CAI: "Cairo", TLV: "Tel Aviv", AMM: "Amman", BKK: "Bangkok", SIN: "Singapore", TYO: "Tokyo", LAX: "Los Angeles",
  MIA: "Miami", ORL: "Orlando", TOR: "Toronto", MEX: "Mexico City", CUN: "Cancun",
  LHR: "Heathrow", LGW: "Gatwick", STN: "Stansted", LTN: "Luton", LCY: "London City", EMA: "East Midlands",
  DSA: "Doncaster Sheffield", SOU: "Southampton", ABZ: "Aberdeen", EXT: "Exeter", NWI: "Norwich",
  BOH: "Bournemouth", INV: "Inverness", NQY: "Newquay", ORK: "Cork",
};

const DESTS: Record<string, string> = {
  lisbon: "LIS", barcelona: "BCN", paris: "PAR", rome: "ROM", amsterdam: "AMS", tenerife: "TCI",
  malaga: "AGP", faro: "FAO", prague: "PRG", krakow: "KRK", dublin: "DUB", berlin: "BER", madrid: "MAD",
  athens: "ATH", dubai: "DXB", "new york": "NYC", marrakech: "RAK", palma: "PMI", majorca: "PMI",
  budapest: "BUD", vienna: "VIE", copenhagen: "CPH", reykjavik: "REK", iceland: "REK", milan: "MIL",
  venice: "VCE", porto: "OPO", seville: "SVQ", valencia: "VLC", ibiza: "IBZ", lanzarote: "ACE",
  istanbul: "IST", dubrovnik: "DBV", split: "SPU", corfu: "CFU", malta: "MLA", cairo: "CAI", bangkok: "BKK",
  tokyo: "TYO", miami: "MIA", orlando: "ORL", cancun: "CUN",
};

function parseQuery(q: string, defaultOrigin: string) {
  const text = q.toLowerCase();
  const now = new Date();

  // budget
  let budget: number | null = null;
  const b = text.match(/£\s?(\d{2,5})/) || text.match(/(\d{2,5})\s?(?:pounds|quid|gbp)/) || text.match(/(?:under|below|max|budget(?: of)?)\s*£?\s?(\d{2,5})/);
  if (b) budget = parseInt(b[1], 10);

  // month
  let monthIndex = -1;
  for (let i = 0; i < 12; i++) {
    const full = MONTHS[i];
    const short = full.slice(0, 3);
    if (new RegExp("\\b" + full + "\\b").test(text) || (short !== "may" && new RegExp("\\b" + short + "\\b").test(text))) { monthIndex = i; break; }
  }
  if (monthIndex < 0 && /christmas|xmas/.test(text)) monthIndex = 11;
  if (monthIndex < 0 && /new year/.test(text)) monthIndex = 11;
  let year = now.getUTCFullYear();
  if (monthIndex < 0) {
    if (/this month/.test(text)) monthIndex = now.getUTCMonth();
    else monthIndex = (now.getUTCMonth() + 1) % 12;
    if (monthIndex < now.getUTCMonth()) year += 1;
  } else if (monthIndex < now.getUTCMonth()) {
    year += 1;
  }
  const month = `${year}-${String(monthIndex + 1).padStart(2, "0")}`;

  // trip length
  let minDays = 0, maxDays = 60;
  if (/weekend|long weekend|city break/.test(text)) { minDays = 2; maxDays = 4; }
  else if (/two weeks|2 weeks|fortnight/.test(text)) { minDays = 11; maxDays = 16; }
  else if (/\b(a|one|1) week\b|week off|week away|week long|weeks? holiday/.test(text)) { minDays = 5; maxDays = 9; }

  // origin: "from Manchester" wins, otherwise the visitor's nearest UK airport
  let origin = defaultOrigin;
  let fromName = "";
  const fromAt = text.search(/\b(?:from|leaving|departing|out of)\s+/);
  if (fromAt >= 0) {
    const after = text.slice(fromAt).replace(/^(?:from|leaving|departing|out of)\s+/, "");
    const names = Object.keys(ORIGINS).sort((x, y) => y.length - x.length);
    const hit = names.find((n) => new RegExp("^" + n + "\\b").test(after));
    if (hit) { origin = ORIGINS[hit]; fromName = hit; }
    else {
      const code = after.match(/^([a-z]{3})\b/);
      if (code && PLACES[code[1].toUpperCase()]) origin = code[1].toUpperCase();
    }
  }

  // destination
  let destination: string | null = null;
  for (const name of Object.keys(DESTS)) {
    if (new RegExp("\\bto\\s+" + name + "\\b|\\b" + name + "\\b").test(text)) {
      if (fromName === name) continue;
      destination = DESTS[name];
      break;
    }
  }

  const direct = /\b(direct|non-?stop)\b/.test(text);
  return { budget, month, monthIndex, minDays, maxDays, origin, destination, direct };
}

function nights(dep: string, ret: string) {
  return Math.round((new Date(ret).getTime() - new Date(dep).getTime()) / 86400000);
}

function shortDates(dep: string, ret: string) {
  const f = (s: string) => new Date(s).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
  const d1 = new Date(dep), d2 = new Date(ret);
  if (d1.getUTCMonth() === d2.getUTCMonth()) return `${d1.getUTCDate()}–${f(ret)}`;
  return `${f(dep)} – ${f(ret)}`;
}

function hm(mins: number) {
  if (!mins) return "";
  return `${Math.floor(mins / 60)}h ${String(mins % 60).padStart(2, "0")}m`;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "private, max-age=300" },
  });
}

export default async (req: Request, context: any) => {
  const token = Netlify.env.get("TRAVELPAYOUTS_TOKEN");
  const marker = Netlify.env.get("TRAVELPAYOUTS_MARKER") || "779486";
  const market = Netlify.env.get("TRAVELPAYOUTS_MARKET");

  if (!token) return json({ error: "Flight search isn't switched on yet." }, 503);

  const q = (new URL(req.url).searchParams.get("q") || "").trim().slice(0, 300);
  if (!q) return json({ error: "Tell us where you'd like to go, or your budget." }, 400);

  const geo = context && context.geo;
  const geoOrigin =
    geo && geo.country && geo.country.code === "GB" && typeof geo.latitude === "number" && typeof geo.longitude === "number"
      ? nearestHub(geo.latitude, geo.longitude)
      : "LON";

  const p = parseQuery(q, geoOrigin);

  const params = new URLSearchParams({
    origin: p.origin,
    departure_at: p.month,
    return_at: p.month,
    one_way: "false",
    sorting: "price",
    currency: "gbp",
    limit: "100",
    direct: p.direct ? "true" : "false",
    unique: p.destination ? "false" : "true",
    token,
  });
  if (p.destination) params.set("destination", p.destination);
  if (market) params.set("market", market);

  let payload: any;
  try {
    const res = await fetch("https://api.travelpayouts.com/aviasales/v3/prices_for_dates?" + params.toString(), {
      headers: { "Accept-Encoding": "gzip, deflate" },
    });
    payload = await res.json();
    if (!res.ok || payload.success === false) {
      return json({ error: "The flight data service didn't answer. Please try again in a moment." }, 502);
    }
  } catch {
    return json({ error: "The flight data service didn't answer. Please try again in a moment." }, 502);
  }

  let offers: any[] = Array.isArray(payload.data) ? payload.data : [];
  offers = offers.filter((o) => o && o.price && o.departure_at && o.return_at);

  const inLength = offers.filter((o) => {
    const n = nights(o.departure_at, o.return_at);
    return n >= p.minDays && n <= p.maxDays;
  });
  const inBudget = p.budget ? inLength.filter((o) => o.price <= p.budget!) : inLength;

  if (!inBudget.length) {
    return json({
      query: p,
      results: [],
      message: p.budget
        ? `We couldn't find a trip from ${PLACES[p.origin] || p.origin} for £${p.budget} or less in that month. Try a higher budget or a different month.`
        : "We couldn't find flights for that. Try a different month or destination.",
    });
  }

  // Pick up to three different destinations
  const seen = new Set<string>();
  const distinct: any[] = [];
  for (const o of inBudget) {
    if (seen.has(o.destination)) continue;
    seen.add(o.destination);
    distinct.push(o);
  }
  const cheapest = distinct[0];
  const rest = distinct.slice(1);
  const fastest = [...rest].sort((a, b) => (a.duration_to || 9999) - (b.duration_to || 9999))[0];
  const third = rest.find((o) => o !== fastest && o.transfers === 0) || rest.find((o) => o !== fastest);
  const picked: Array<[string, any]> = [["Cheapest", cheapest]];
  if (fastest) picked.push(["Shortest flight", fastest]);
  if (third) picked.push(["Also worth a look", third]);

  const results = picked.map(([tag, o]) => {
    const n = nights(o.departure_at, o.return_at);
    const city = PLACES[o.destination] || o.destination;
    const originName = PLACES[o.origin] || o.origin;
    const stops = o.transfers === 0 ? "Direct" : `${o.transfers} stop${o.transfers > 1 ? "s" : ""}`;
    const left = p.budget ? p.budget - Math.round(o.price) : null;
    const take =
      (left !== null && left >= 0 ? `£${left} of your £${p.budget} budget left for the rest of the trip. ` : "") +
      `${n} night${n === 1 ? "" : "s"} away, ${o.transfers === 0 ? "flying direct" : stops.toLowerCase() + " each way at most"}.` +
      (tag === "Cheapest" ? " This is the lowest price we found." : tag === "Shortest flight" ? " Gets you there fastest of the options." : "");
    const link = String(o.link || "");
    const url = "https://www.aviasales.com" + link + (link.includes("?") ? "&" : "?") + "marker=" + encodeURIComponent(marker);
    return {
      tag,
      city,
      route: `${originName} → ${o.destination}`,
      dates: shortDates(o.departure_at, o.return_at),
      price: "£" + Math.round(o.price),
      stops: `${stops}${o.duration_to ? " · " + hm(o.duration_to) : ""}`,
      take,
      url,
    };
  });

  return json({ query: p, results });
};

export const config = { path: "/api/search" };
