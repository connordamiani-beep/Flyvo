// Flyvo live flight search: turns plain English into a Travelpayouts (Aviasales) price lookup.
// Needs one secret environment variable: TRAVELPAYOUTS_TOKEN
// Optional: TRAVELPAYOUTS_MARKER (defaults to 779486), TRAVELPAYOUTS_MARKET,
// TRAVELPAYOUTS_TRS (project ID; switches "View deal" links to Kiwi.com)

// How many flights to send back in total (3 highlighted picks + the rest as "More options")
const MAX_RESULTS = 15;

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

// Bigger airports within easy reach, checked as well for warm-weather searches
const NEARBY: Record<string, string[]> = {
  LBA: ["MAN"], NCL: ["MAN"], LPL: ["MAN"], DSA: ["MAN", "LBA"], EMA: ["BHX", "MAN"],
  BHX: ["MAN"], BRS: ["LON"], CWL: ["BRS"], SOU: ["LON"], BOH: ["LON"], EXT: ["BRS"],
  NWI: ["LON"], GLA: ["EDI"], EDI: ["GLA"], ABZ: ["EDI"], INV: ["EDI"],
};

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
  GDN: "Gdansk", WRO: "Wroclaw", POZ: "Poznan", KTW: "Katowice", BUH: "Bucharest", SKP: "Skopje", TIA: "Tirana",
  BEG: "Belgrade", ZAG: "Zagreb", LJU: "Ljubljana", BTS: "Bratislava", VNO: "Vilnius", KUN: "Kaunas",
  TRN: "Turin", BLQ: "Bologna", PSA: "Pisa", VRN: "Verona", CTA: "Catania", PMO: "Palermo", CAG: "Cagliari", BRI: "Bari",
  BIO: "Bilbao", SCQ: "Santiago de Compostela", GRX: "Granada", SPC: "La Palma", MAH: "Menorca", XRY: "Jerez",
  GRO: "Girona", REU: "Reus", FNC: "Funchal", PDL: "Ponta Delgada", NCE: "Nice", MRS: "Marseille", LYS: "Lyon",
  TLS: "Toulouse", BOD: "Bordeaux", NTE: "Nantes", SXB: "Strasbourg", MUC: "Munich", FRA: "Frankfurt",
  HAM: "Hamburg", DUS: "Dusseldorf", CGN: "Cologne", STR: "Stuttgart", NUE: "Nuremberg", LEJ: "Leipzig", DRS: "Dresden",
  SNN: "Shannon", NOC: "Knock", GOT: "Gothenburg", MMA: "Malmo", BGO: "Bergen", TOS: "Tromso", AAR: "Aarhus", BLL: "Billund",
  SKG: "Thessaloniki", RHO: "Rhodes", JMK: "Mykonos", JTR: "Santorini", ZTH: "Zante", KGS: "Kos", CHQ: "Chania",
  AYT: "Antalya", DLM: "Dalaman", BJV: "Bodrum", ADB: "Izmir", PFO: "Paphos", TUN: "Tunis", AGA: "Agadir",
  CMN: "Casablanca", SSH: "Sharm El Sheikh", HRG: "Hurghada", DOH: "Doha", AUH: "Abu Dhabi", DEL: "Delhi",
  BOM: "Mumbai", HKG: "Hong Kong", CHI: "Chicago", WAS: "Washington", SFO: "San Francisco", LAS: "Las Vegas",
  BOS: "Boston", YMQ: "Montreal", YTO: "Toronto",
};

// Looks up names for any airport or city not listed above (cached while the function stays warm)
let cityNames: Record<string, string> | null = null;
let cityCountries: Record<string, string> = {};

async function loadCityNames(): Promise<Record<string, string>> {
  if (cityNames) return cityNames;
  const urls = [
    "https://api.travelpayouts.com/data/en/cities.json",
    "https://api.travelpayouts.com/data/cities.json",
  ];
  for (const url of urls) {
    try {
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), 4000);
      const res = await fetch(url, { signal: ctl.signal });
      clearTimeout(timer);
      if (!res.ok) continue;
      const list: any[] = await res.json();
      const map: Record<string, string> = {};
      for (const c of list) {
        const name = (c.name_translations && c.name_translations.en) || c.name;
        if (c.code && name) map[c.code] = name;
        if (c.code && c.country_code) cityCountries[c.code] = c.country_code;
      }
      if (Object.keys(map).length) { cityNames = map; return map; }
    } catch {
      // try the next address
    }
  }
  return {};
}

// Country for each destination, shown next to the city name (e.g. "Milan, Italy")
const COUNTRY: Record<string, string> = {};
const addCountry = (country: string, codes: string) => codes.split(" ").forEach((c) => (COUNTRY[c] = country));
addCountry("Spain", "BCN TCI TFS AGP MAD PMI ALC IBZ LPA ACE FUE SVQ VLC BIO SCQ GRX SPC MAH XRY GRO REU");
addCountry("Portugal", "LIS FAO OPO FNC PDL");
addCountry("France", "PAR NCE MRS LYS TLS BOD NTE SXB");
addCountry("Italy", "ROM MIL VCE FLR NAP TRN BLQ PSA VRN CTA PMO CAG BRI");
addCountry("Greece", "ATH CFU HER SKG RHO JMK JTR ZTH KGS CHQ");
addCountry("Turkey", "IST AYT DLM BJV ADB");
addCountry("Germany", "BER MUC FRA HAM DUS CGN STR NUE LEJ DRS");
addCountry("Poland", "KRK WAW GDN WRO POZ KTW");
addCountry("Ireland", "DUB SNN NOC ORK");
addCountry("Netherlands", "AMS"); addCountry("Belgium", "BRU"); addCountry("Czechia", "PRG");
addCountry("Hungary", "BUD"); addCountry("Austria", "VIE"); addCountry("Denmark", "CPH AAR BLL");
addCountry("Iceland", "REK"); addCountry("Switzerland", "GVA ZRH"); addCountry("Latvia", "RIX");
addCountry("Estonia", "TLL"); addCountry("Finland", "HEL"); addCountry("Norway", "OSL BGO TOS");
addCountry("Sweden", "STO GOT MMA"); addCountry("Bulgaria", "SOF"); addCountry("Croatia", "DBV SPU ZAG");
addCountry("Cyprus", "LCA PFO"); addCountry("Malta", "MLA"); addCountry("Romania", "BUH");
addCountry("North Macedonia", "SKP"); addCountry("Albania", "TIA"); addCountry("Serbia", "BEG");
addCountry("Slovenia", "LJU"); addCountry("Slovakia", "BTS"); addCountry("Lithuania", "VNO KUN");
addCountry("Morocco", "RAK AGA CMN"); addCountry("Egypt", "CAI SSH HRG"); addCountry("Tunisia", "TUN");
addCountry("Israel", "TLV"); addCountry("Jordan", "AMM"); addCountry("UAE", "DXB AUH"); addCountry("Qatar", "DOH");
addCountry("Thailand", "BKK"); addCountry("Singapore", "SIN"); addCountry("Japan", "TYO");
addCountry("India", "DEL BOM"); addCountry("Hong Kong", "HKG"); addCountry("Mexico", "MEX CUN");
addCountry("USA", "NYC LAX MIA ORL CHI WAS SFO LAS BOS"); addCountry("Canada", "TOR YMQ YTO");

// Names for any other country, looked up by its 2-letter code (cached while the function stays warm)
let countryNames: Record<string, string> | null = null;
async function loadCountryNames(): Promise<Record<string, string>> {
  if (countryNames) return countryNames;
  try {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 4000);
    const res = await fetch("https://api.travelpayouts.com/data/en/countries.json", { signal: ctl.signal });
    clearTimeout(timer);
    if (!res.ok) return {};
    const list: any[] = await res.json();
    const map: Record<string, string> = {};
    for (const c of list) {
      const name = (c.name_translations && c.name_translations.en) || c.name;
      if (c.code && name) map[c.code] = name;
    }
    countryNames = map;
    return map;
  } catch {
    return {};
  }
}

const DESTS: Record<string, string> = {
  lisbon: "LIS", barcelona: "BCN", paris: "PAR", rome: "ROM", amsterdam: "AMS", tenerife: "TCI",
  malaga: "AGP", faro: "FAO", prague: "PRG", krakow: "KRK", dublin: "DUB", berlin: "BER", madrid: "MAD",
  athens: "ATH", dubai: "DXB", "new york": "NYC", marrakech: "RAK", palma: "PMI", majorca: "PMI",
  budapest: "BUD", vienna: "VIE", copenhagen: "CPH", reykjavik: "REK", iceland: "REK", milan: "MIL",
  venice: "VCE", porto: "OPO", seville: "SVQ", valencia: "VLC", ibiza: "IBZ", lanzarote: "ACE",
  istanbul: "IST", dubrovnik: "DBV", split: "SPU", corfu: "CFU", malta: "MLA", cairo: "CAI", bangkok: "BKK",
  tokyo: "TYO", miami: "MIA", orlando: "ORL", cancun: "CUN",
};

// Warm-weather destinations, grouped by when they're reliably warm (daytime highs around 20°C+).
// Month numbers: 0 = January ... 11 = December.
const WARM_ALL_YEAR = new Set([
  // Tropics, Gulf, Red Sea
  "HRG", "SSH", "DXB", "DOH", "AUH", "BKK", "SIN", "CUN", "MIA", "BOM",
  // Winter sun: Canaries, Madeira, southern Morocco, Egypt, Florida, Israel
  "TCI", "TFS", "LPA", "ACE", "FUE", "SPC", "FNC", "AGA", "CAI", "ORL", "TLV", "DEL",
]);
// Warm spring to late autumn (April–November)
const WARM_SPRING_TO_AUTUMN = new Set([
  "LCA", "PFO", "MLA", "RAK", "AYT", "DLM", "BJV", "CTA", "PMO", "HER", "CHQ", "RHO",
  "AGP", "ALC", "FAO", "SVQ", "HKG", "LAS", "AMM", "TUN", "CMN", "XRY", "GRX",
]);
// Warm in summer only (May–October)
const WARM_SUMMER = new Set([
  "BCN", "PMI", "IBZ", "MAH", "ATH", "JMK", "JTR", "ZTH", "KGS", "CFU", "SKG", "SPU", "DBV",
  "NCE", "MRS", "LIS", "OPO", "VLC", "MAD", "NAP", "ROM", "BRI", "CAG", "FLR", "PSA", "IST",
  "ADB", "TIA", "REU", "GRO", "PDL", "LAX", "SFO", "NYC", "WAS", "BOS", "CHI", "TOK", "TYO",
  "SOF", "BUD", "VCE", "MIL", "BLQ", "VRN", "TRN", "SKP", "BEG", "TLS", "BOD",
]);

function isWarm(code: string, monthIndex: number) {
  if (WARM_ALL_YEAR.has(code)) return true;
  if (WARM_SPRING_TO_AUTUMN.has(code)) return monthIndex >= 3 && monthIndex <= 10;
  if (WARM_SUMMER.has(code)) return monthIndex >= 4 && monthIndex <= 9;
  return false;
}

// Typical daytime high (°C) for each month, January to December. Shown on each card.
const CLIMATE: Record<string, number[]> = {
  TCI: [22,22,23,23,24,26,28,29,28,27,25,23], TFS: [22,22,23,23,24,26,28,29,28,27,25,23],
  LPA: [21,21,22,22,23,25,26,27,27,26,24,22], ACE: [21,22,23,24,25,27,29,29,28,27,24,22],
  FUE: [21,21,22,23,24,25,27,28,27,26,24,22], SPC: [21,21,22,22,23,24,26,27,27,26,24,22],
  FNC: [19,19,19,20,21,23,24,26,26,24,22,20], AGA: [21,22,23,24,25,26,28,28,28,27,24,21],
  RAK: [18,20,23,25,29,33,37,37,32,28,23,19], CMN: [17,18,19,20,22,24,26,27,26,24,21,18],
  HRG: [22,23,25,29,33,35,36,36,34,31,27,23], SSH: [22,23,25,29,33,36,37,37,35,31,27,23],
  CAI: [19,21,24,28,32,34,35,35,33,30,25,21], DXB: [24,26,29,33,38,40,41,41,39,35,30,26],
  AUH: [24,26,29,33,38,40,42,42,40,36,30,26], DOH: [22,23,27,32,38,41,42,41,39,35,29,24],
  TLV: [18,18,20,23,26,28,30,31,30,28,24,20], AMM: [13,14,18,23,28,31,32,33,31,27,20,15],
  LCA: [17,17,19,22,26,30,33,33,31,28,23,19], PFO: [17,17,19,21,24,27,30,30,29,27,23,19],
  MLA: [16,16,17,20,24,28,31,31,28,25,21,17], TUN: [16,17,19,22,26,30,33,33,30,26,21,17],
  AYT: [15,16,18,21,25,31,34,34,31,26,21,17], DLM: [15,16,18,21,26,31,34,34,31,26,20,16],
  BJV: [15,16,18,21,25,30,33,33,30,26,21,17], ADB: [13,14,17,21,26,31,33,33,29,24,19,14],
  IST: [9,10,12,17,22,27,29,29,25,20,15,11], ATH: [13,14,17,20,25,30,33,33,29,24,19,15],
  HER: [16,16,18,20,24,28,29,29,27,24,21,17], CHQ: [16,16,18,21,25,29,31,31,28,25,21,17],
  RHO: [16,16,18,21,25,29,31,31,29,25,21,17], CTA: [16,16,18,20,24,29,32,32,29,25,20,17],
  PMO: [15,15,17,19,23,27,30,30,28,24,20,16], AGP: [17,18,20,22,25,29,31,31,29,24,20,18],
  ALC: [17,18,20,22,25,28,31,31,29,25,21,18], FAO: [16,17,19,21,23,27,29,29,27,24,20,17],
  SVQ: [16,18,22,24,28,33,36,36,32,26,20,16], BCN: [14,15,17,19,22,26,28,29,26,22,17,14],
  PMI: [15,15,17,20,23,27,30,31,28,24,19,16], IBZ: [15,16,17,19,23,27,30,30,28,24,19,16],
  LIS: [15,16,19,20,23,27,29,29,27,23,18,16], MAD: [10,12,16,18,22,29,32,32,27,20,14,11],
  ROM: [12,13,16,19,23,28,31,31,27,22,17,13], NAP: [13,14,16,19,23,27,30,31,27,23,18,14],
  NCE: [13,14,15,18,21,25,27,28,25,21,17,14], VCE: [6,9,13,17,22,26,29,28,24,18,12,7],
  MIL: [7,10,15,18,23,27,30,29,24,18,12,7], PAR: [7,8,12,16,20,23,25,25,21,16,11,8],
  AMS: [6,7,10,14,18,20,22,22,19,15,10,7], BRU: [6,7,11,15,18,21,23,23,20,15,10,6],
  DUB: [8,9,11,13,15,18,20,19,17,14,10,8], EDI: [7,7,9,11,14,17,19,19,16,13,9,7],
  BER: [3,5,9,15,19,22,25,24,19,14,8,4], PRG: [1,3,8,14,19,22,24,24,19,13,7,3],
  KRK: [1,3,8,14,20,23,25,24,19,14,7,2], WRO: [2,4,9,14,19,22,25,24,19,14,8,3],
  BUD: [3,6,11,17,22,25,28,28,22,16,9,4], VIE: [3,5,10,16,21,24,27,26,21,15,8,4],
  CPH: [3,3,6,11,16,19,22,21,18,13,8,4], REK: [2,3,3,6,10,12,14,14,11,7,4,3],
  BKK: [32,33,34,35,34,33,33,33,32,32,32,31], SIN: [30,31,32,32,32,31,31,31,31,31,31,30],
  CUN: [28,29,30,31,32,32,33,33,32,31,29,28], MIA: [24,25,26,28,30,32,33,33,32,29,27,25],
  ORL: [22,23,26,28,31,33,33,33,32,29,26,23], BOM: [30,31,32,33,34,32,30,30,31,33,33,32],
  DEL: [21,24,30,36,40,39,35,34,34,33,28,23], HKG: [19,19,22,25,29,31,32,32,31,28,24,20],
  LAS: [14,17,21,25,31,38,40,39,34,27,19,14], LAX: [20,20,21,22,23,24,27,28,27,25,22,20],
};
const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];

function tempLine(codes: Array<string | undefined>, monthIdx: number) {
  for (const c of codes) {
    const row = c ? CLIMATE[c] : undefined;
    if (row) return `Usually around ${row[monthIdx]}°C in ${MONTH_NAMES[monthIdx]}. `;
  }
  return "";
}

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
  let minDays = 2, maxDays = 60;
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
  const warm = /\b(warm|warmer|hot|heat|sun|sunny|sunshine|beach|beaches|tropical|winter sun)\b/.test(text);
  return { budget, month, monthIndex, minDays, maxDays, origin, destination, direct, warm };
}

// Asks Claude to understand the search. Returns null (so the keyword parser is used instead)
// if there's no ANTHROPIC_API_KEY, or Claude is slow or gives an unusable answer.
// Records what happened with Claude on the last search, shown as "ai" in /api/search responses
let aiStatus = "not tried";

async function askClaude(q: string, defaultOrigin: string) {
  const key = Netlify.env.get("ANTHROPIC_API_KEY");
  if (!key) { aiStatus = "off: no ANTHROPIC_API_KEY found (redeploy after adding it)"; return null; }
  aiStatus = "trying";
  const today = new Date().toISOString().slice(0, 10);

  const system = `You turn a traveller's request into flight search filters for Flyvo, a UK flight finder. Today is ${today}. If the traveller doesn't say where they're flying from, use null for origin (we'll use their nearest airport, ${defaultOrigin}).

Always answer by calling the set_filters tool.

Rules:
- Codes are 3-letter IATA codes. Prefer city codes where one exists (LON, PAR, ROM, MIL, NYC, STO, TYO, TCI for Tenerife), and also include the main airport code when it differs (e.g. TCI and TFS).
- A named place: destinations holds just that place. A country or region (e.g. "Greece", "the Canaries"): its main holiday airports.
- A description instead of a place (warm, beach, skiing, nightlife, romantic, cheap city break, etc.): list 15-30 destinations with direct or easy flights from the UK that genuinely fit in the travel month. Be strict about weather: "warm" or "sunny" means typical daytime highs of at least 20°C in that month; skiing means reliable snow that month.
- No preference about where at all: destinations is [].
- budget: the most they want to spend on flights in GBP, or null.
- month: the month they mean. "Next month" is the month after today's. No month given: next month. Never a month before today's.
- Trip length: weekend 2-4 nights, a week 5-9, two weeks 11-16, a specific number of nights ±1. Not stated: 2-14.
- direct: true only if they ask for direct or non-stop flights.`;

  try {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 7000);
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      signal: ctl.signal,
      headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1000,
        system,
        tools: [{
          name: "set_filters",
          description: "Flight search filters for the traveller's request",
          input_schema: {
            type: "object",
            properties: {
              origin: { type: ["string", "null"], description: "3-letter IATA code, or null if not stated" },
              destinations: { type: "array", items: { type: "string" }, description: "3-letter IATA codes, or [] for anywhere" },
              budget: { type: ["number", "null"], description: "Max flight spend in GBP, or null" },
              month: { type: "string", description: "YYYY-MM" },
              min_nights: { type: "integer" },
              max_nights: { type: "integer" },
              direct: { type: "boolean" },
              warm: { type: "boolean", description: "true if they want warm, hot, sunny or beach weather" },
            },
            required: ["origin", "destinations", "budget", "month", "min_nights", "max_nights", "direct", "warm"],
          },
        }],
        tool_choice: { type: "tool", name: "set_filters" },
        messages: [{ role: "user", content: q }],
      }),
    });
    clearTimeout(timer);
    if (!res.ok) {
      let detail = "";
      try { detail = (await res.text()).slice(0, 300); } catch {}
      aiStatus = `Claude error ${res.status}: ${detail}`;
      return null;
    }

    const data = await res.json();
    const tool = (data.content || []).find((c: any) => c.type === "tool_use");
    let a: any = tool ? tool.input : null;
    if (!a) {
      const text = (data.content || []).map((c: any) => (c.type === "text" ? c.text : "")).join("");
      const s = text.indexOf("{"), e = text.lastIndexOf("}");
      if (s < 0 || e < s) { aiStatus = "Claude replied but not with filters"; return null; }
      a = JSON.parse(text.slice(s, e + 1));
    }

    // Accept "TCI", {code: "TCI"} or {iata: "TCI"}
    const code = (x: any) => {
      const v = typeof x === "string" ? x : x && (x.code || x.iata || x.city_code);
      return typeof v === "string" && /^[A-Za-z]{3}$/.test(v.trim()) ? v.trim().toUpperCase() : null;
    };
    // Accept 150, "150" or "£150"
    const num = (x: any) => {
      const n = typeof x === "number" ? x : parseFloat(String(x ?? "").replace(/[^\d.]/g, ""));
      return Number.isFinite(n) && n > 0 ? n : null;
    };
    const destinations: string[] = Array.isArray(a.destinations)
      ? [...new Set(a.destinations.map(code).filter(Boolean) as string[])].slice(0, 40)
      : [];

    const thisMonth = today.slice(0, 7);
    let month: string = typeof a.month === "string" && /^\d{4}-\d{2}$/.test(a.month) ? a.month : "";
    if (!month || month < thisMonth) month = parseQuery(q, defaultOrigin).month;
    const monthIndex = parseInt(month.slice(5), 10) - 1;

    const minDays = num(a.min_nights) ? Math.max(1, Math.round(num(a.min_nights)!)) : 2;
    let maxDays = num(a.max_nights) ? Math.round(num(a.max_nights)!) : 14;
    if (maxDays < minDays) maxDays = minDays;

    aiStatus = "on";
    return {
      budget: num(a.budget) ? Math.round(num(a.budget)!) : null,
      month,
      monthIndex,
      minDays,
      maxDays,
      origin: code(a.origin) || defaultOrigin,
      destination: destinations.length === 1 ? destinations[0] : null,
      destinations,
      direct: a.direct === true || a.direct === "true",
      // Warm weather is checked against Flyvo's own month-by-month list, not left to Claude's guess
      warm: a.warm === true || a.warm === "true" || parseQuery(q, defaultOrigin).warm,
    };
  } catch (err: any) {
    aiStatus = err && err.name === "AbortError" ? "Claude took too long" : "Claude request failed: " + String(err && err.message || err).slice(0, 200);
    return null;
  }
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
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

// "View deal" links. Kiwi.com sells the ticket itself, so the visitor goes from Flyvo
// straight to a page where they can book. Each link is made by the Travelpayouts
// partner links API so the click is tracked. Needs TRAVELPAYOUTS_TRS (the Flyvo
// project ID in Travelpayouts). Without it, or if the API fails, every result keeps
// its Aviasales link, so a deal button always works.
function kiwiUrl(o: any) {
  const from = String(o.origin_airport || o.origin || "");
  const to = String(o.destination_airport || o.destination || "");
  const dep = String(o.departure_at || "").slice(0, 10);
  const ret = String(o.return_at || "").slice(0, 10);
  const day = /^\d{4}-\d{2}-\d{2}$/;
  if (!/^[A-Z]{3}$/.test(from) || !/^[A-Z]{3}$/.test(to) || !day.test(dep)) return "";
  const qs = new URLSearchParams({ from, to, departure: dep });
  if (day.test(ret)) qs.set("return", ret);
  return "https://www.kiwi.com/deep?" + qs.toString();
}

async function kiwiPartnerLinks(offers: any[], token: string, marker: string, trs: number, notes: string[] = []) {
  const out = new Map<string, string>();
  const urls = [...new Set(offers.map(kiwiUrl).filter(Boolean))];
  if (!urls.length || !(trs > 0) || !(Number(marker) > 0)) {
    notes.push("skipped: " + urls.length + " urls, trs " + (trs > 0 ? "set" : "missing"));
    return out;
  }
  const batches: string[][] = [];
  for (let i = 0; i < urls.length; i += 10) batches.push(urls.slice(i, i + 10));
  await Promise.all(
    batches.map(async (batch) => {
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), 3000);
      try {
        const res = await fetch("https://api.travelpayouts.com/links/v1/create", {
          method: "POST",
          signal: ctl.signal,
          headers: { "content-type": "application/json", "x-access-token": token },
          body: JSON.stringify({
            trs,
            marker: Number(marker),
            shorten: true,
            links: batch.map((url) => ({ url, sub_id: "search" })),
          }),
        });
        if (!res.ok) {
          notes.push("http " + res.status + ": " + (await res.text()).slice(0, 300));
          return;
        }
        const data: any = await res.json();
        for (const l of data?.result?.links || []) {
          if (l && l.code === "success" && /^https:\/\//.test(String(l.partner_url || ""))) out.set(String(l.url), String(l.partner_url));
          else notes.push("link " + String(l?.code) + ": " + String(l?.message || "").slice(0, 200));
        }
        if (!data?.result?.links) notes.push("no links: " + JSON.stringify(data).slice(0, 300));
      } catch (e) {
        // leave these results on their Aviasales links
        notes.push("error: " + String((e as any)?.name || e));
      } finally {
        clearTimeout(timer);
      }
    }),
  );
  return out;
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

  // Departure airport: one typed in the search wins; otherwise the visitor's chosen airport
  // (?from=MAN, sent by the "Flying from" picker), otherwise the nearest one to their location.
  // ?override=1 means the visitor just picked an airport, so it wins even over a typed one.
  const params0 = new URL(req.url).searchParams;
  const fromParam = (params0.get("from") || "").toUpperCase();
  const fromOk = /^[A-Z]{3}$/.test(fromParam) && Object.values(ORIGINS).includes(fromParam);
  const startOrigin = fromOk ? fromParam : geoOrigin;

  const p = (await askClaude(q, startOrigin)) || { ...parseQuery(q, startOrigin), destinations: [] as string[] };
  if (fromOk && params0.get("override") === "1") p.origin = fromParam;

  // Looks up return prices from one departure airport (null if the service didn't answer)
  async function fetchOffers(origin: string): Promise<any[] | null> {
    const params = new URLSearchParams({
      origin,
      departure_at: p.month,
      return_at: p.month,
      one_way: "false",
      sorting: "price",
      currency: "gbp",
      limit: "100",
      direct: p.direct ? "true" : "false",
      unique: p.destination ? "false" : "true",
      token: token!,
    });
    if (p.destination) params.set("destination", p.destination);
    if (market) params.set("market", market);
    try {
      const res = await fetch("https://api.travelpayouts.com/aviasales/v3/prices_for_dates?" + params.toString(), {
        headers: { "Accept-Encoding": "gzip, deflate" },
      });
      const payload = await res.json();
      if (!res.ok || payload.success === false) return null;
      return (Array.isArray(payload.data) ? payload.data : []).map((o: any) => ({ ...o, _from: origin }));
    } catch {
      return null;
    }
  }

  // Warm searches also check bigger airports nearby (e.g. Manchester for Leeds), which have more winter-sun flights
  const alts = p.warm && !p.destination ? (NEARBY[p.origin] || []).filter((c) => c !== p.origin) : [];
  const [home, ...more] = await Promise.all([fetchOffers(p.origin), ...alts.map(fetchOffers)]);
  if (home === null && more.every((m) => m === null)) {
    return json({ error: "The flight data service didn't answer. Please try again in a moment." }, 502);
  }

  let offers: any[] = [...(home || []), ...more.flatMap((m) => m || [])];
  offers = offers.filter((o) => o && o.price && o.departure_at && o.return_at);
  offers.sort((a, b) => a.price - b.price);

  const inLength = offers.filter((o) => {
    const n = nights(o.departure_at, o.return_at);
    return n >= p.minDays && n <= p.maxDays;
  });
  // Claude picked a shortlist of places that fit (e.g. warm in November): keep only those
  // Warm requests use Flyvo's own weather list; other requests (nightlife, skiing...) use Claude's shortlist
  const wanted = !p.warm && p.destinations.length > 1 ? new Set(p.destinations) : null;
  const inWeather = p.warm && !p.destination
    ? inLength.filter((o) => isWarm(o.destination, p.monthIndex) || isWarm(o.destination_airport, p.monthIndex))
    : wanted
      ? inLength.filter((o) => wanted.has(o.destination) || wanted.has(o.destination_airport))
      : inLength;
  const withinBudget = p.budget ? inWeather.filter((o) => o.price <= p.budget!) : inWeather;

  // Nothing fits the budget: show the closest options just above it (up to 50% over) instead of a dead end
  const overBudget = !!p.budget && !withinBudget.length;
  const inBudget = overBudget ? inWeather.filter((o) => o.price <= p.budget! * 1.5) : withinBudget;

  if (!inBudget.length) {
    return json({
      ai: aiStatus,
      query: p,
      results: [],
      message: wanted || (p.warm && !p.destination)
        ? `We couldn't find a trip that fits from ${PLACES[p.origin] || p.origin}${p.budget ? ` for £${p.budget} or less` : ""} that month. Try a higher budget or a different month.`
        : p.budget
        ? `We couldn't find a trip from ${PLACES[p.origin] || p.origin} for £${p.budget} or less in that month. Try a higher budget or a different month.`
        : "We couldn't find flights for that. Try a different month or destination.",
    });
  }

  // Remove duplicates. Browsing ("anywhere for £200"): one flight per destination.
  // A named destination ("Barcelona in December"): one flight per date pair and stop count,
  // so the visitor sees different dates instead of just one result.
  const seen = new Set<string>();
  const pool: any[] = [];
  for (const o of inBudget) {
    const key = p.destination
      ? `${String(o.origin_airport || o.origin)}|${String(o.departure_at).slice(0, 10)}|${String(o.return_at).slice(0, 10)}|${o.transfers}`
      : o.destination;
    if (seen.has(key)) continue;
    seen.add(key);
    pool.push(o);
  }

  const picked: Array<[string, any]> = [];
  if (overBudget) {
    // Just the closest few, cheapest first
    for (const o of pool.slice(0, 6)) picked.push(["Just over budget", o]);
  } else {
  // Three highlighted picks first
  const cheapest = pool[0];
  const rest = pool.slice(1);
  const fastest = rest.length
    ? [...rest].sort((a, b) => (a.duration_to || 9999) - (b.duration_to || 9999))[0]
    : undefined;
  const third = rest.find((o) => o !== fastest && o.transfers === 0) || rest.find((o) => o !== fastest);
  picked.push(["Cheapest", cheapest]);
  if (fastest) picked.push(["Shortest flight", fastest]);
  if (third) picked.push(["Also worth a look", third]);

  // Then everything else, cheapest first, up to MAX_RESULTS in total
  for (const o of pool) {
    if (picked.length >= MAX_RESULTS) break;
    if (picked.some(([, x]) => x === o)) continue;
    picked.push(["More options", o]);
  }
  }

  const unknown = picked.map(([, o]) => o.destination).filter((c: string) => !PLACES[c] || !COUNTRY[c]);
  const looked: Record<string, string> = unknown.length ? await loadCityNames() : {};
  const nameOf = (code: string) => PLACES[code] || looked[code] || code;
  const needCountries = picked.some(([, o]) => !COUNTRY[o.destination] && cityCountries[o.destination] && cityCountries[o.destination] !== "GB");
  const countries: Record<string, string> = needCountries ? await loadCountryNames() : {};
  const countryOf = (code: string) => {
    if (COUNTRY[code]) return COUNTRY[code];
    const cc = cityCountries[code];
    return cc && cc !== "GB" ? countries[cc] || "" : "";
  };

  const trs = Number(Netlify.env.get("TRAVELPAYOUTS_TRS"));
  const linkNotes: string[] = [];
  const kiwi = await kiwiPartnerLinks(picked.map(([, o]) => o), token, marker, trs, linkNotes);

  const results = picked.map(([tag, o]) => {
    const n = nights(o.departure_at, o.return_at);
    const city = nameOf(o.destination);
    const originName = nameOf(o.origin);
    const stops = o.transfers === 0 ? "Direct" : `${o.transfers} stop${o.transfers > 1 ? "s" : ""}`;
    const left = p.budget ? p.budget - Math.round(o.price) : null;
    const fromNearby = o._from && o._from !== p.origin
      ? `Flies from ${nameOf(o._from)}, the nearest big airport to ${nameOf(p.origin)}. `
      : "";
    const weather = tempLine([o.destination, o.destination_airport], new Date(o.departure_at).getUTCMonth());
    const take =
      weather +
      fromNearby +
      (left !== null && left >= 0 ? `£${left} of your £${p.budget} budget left for the rest of the trip. ` : "") +
      (left !== null && left < 0 ? `Nothing fitted your £${p.budget} budget, but this is only £${-left} over. ` : "") +
      `${n} night${n === 1 ? "" : "s"} away, ${o.transfers === 0 ? "flying direct" : stops.toLowerCase() + " each way at most"}.` +
      (tag === "Cheapest" ? " This is the lowest price we found." : tag === "Shortest flight" ? " Gets you there fastest of the options." : "");
    const link = String(o.link || "");
    const url =
      kiwi.get(kiwiUrl(o)) ||
      "https://www.aviasales.com" + link + (link.includes("?") ? "&" : "?") + "marker=" + encodeURIComponent(marker);
    return {
      tag,
      city: countryOf(o.destination) ? `${city}, ${countryOf(o.destination)}` : city,
      route: `${originName} → ${city}`,
      dates: shortDates(o.departure_at, o.return_at),
      price: "£" + Math.round(o.price),
      stops: `${stops}${o.duration_to ? " · " + hm(o.duration_to) : ""}`,
      take,
      url,
    };
  });

  return json({
    ai: aiStatus,
    query: p,
    results,
    // ?debug=1 shows why deal links fell back to Aviasales (no secrets in here)
    ...(new URL(req.url).searchParams.get("debug") === "1" ? { links: { kiwi: kiwi.size, notes: linkNotes } } : {}),
    ...(overBudget ? { message: `Nothing came in under £${p.budget}, so here are the closest options just above it.` } : {}),
  });
};

export const config = { path: "/api/search" };
