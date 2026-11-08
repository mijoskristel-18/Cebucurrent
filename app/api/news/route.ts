import { NextResponse } from "next/server";

type Story = { id: string; category: string; title: string; summary: string; source: string; url: string; publishedAt: string };

// Current publisher links keep the front page useful whenever the live feed is unavailable.
const currentStories: Story[] = [
  {
    id: "cebu-heat-2026-11-07", category: "Community",
    title: "Extreme heat ahead: Pagasa warns Cebu’s heat index could reach 52°C",
    summary: "Pagasa Visayas says the coming hot and dry season could bring extreme heat. Residents are advised to limit long periods in direct sun, drink water, and avoid unnecessary outdoor activity during peak afternoon hours.",
    source: "SunStar Cebu", url: "https://www.sunstar.com.ph/cebu/extreme-heat-ahead", publishedAt: "2026-11-07T11:02:00+08:00",
  },
  {
    id: "cebu-mining-review-2026-11-07", category: "City",
    title: "Cebu City reviews upland mining permits after landslide",
    summary: "The city says it is reviewing existing upland permits and extraction applications. Officials also discussed slope stabilization and safety measures after the Pulangbato landslide.",
    source: "SunStar Cebu", url: "https://www.sunstar.com.ph/cebu/mayor-orders-strict-review-of-upland-mining-permits", publishedAt: "2026-11-07T11:10:00+08:00",
  },
  {
    id: "cebu-hog-prices-2026-11-07", category: "Business",
    title: "Cebu hog growers seek help as farmgate prices fall",
    summary: "Local raisers appealed to the provincial government after reporting low farmgate prices while consumers continue to pay considerably more at public markets.",
    source: "SunStar Cebu", url: "https://www.sunstar.com.ph/cebu/hog-growers-seek-help-as-prices-plunge", publishedAt: "2026-11-07T12:29:00+08:00",
  },
  {
    id: "cebu-recovery-funds-2026-11-07", category: "Province",
    title: "Cebu gets ₱1.3 billion in recovery funds",
    summary: "National rehabilitation assistance has been allocated to the province and 24 cities and municipalities for damaged roads, bridges, health facilities, schools, and other public infrastructure.",
    source: "The Freeman", url: "https://www.philstar.com/cebu-news/2026/11/07/2568514/cebu-gets-p13-billion-recovery-funds", publishedAt: "2026-11-07T00:00:00+08:00",
  },
  {
    id: "cebu-el-nino-council-2026-11-06", category: "City",
    title: "Cebu City Council to review water, food, and health readiness for El Niño",
    summary: "Council members plan to review city preparations for possible water shortages, food supply disruptions, and health risks as the dry conditions continue.",
    source: "The Freeman", url: "https://qa.philstar.com/the-freeman/cebu-news/2026/11/06/2568243/water-food-health-top-agenda-council-review-el-nio-readiness", publishedAt: "2026-11-06T00:00:00+08:00",
  },
  {
    id: "cebu-el-nino-task-force-2026-11-03", category: "Province",
    title: "Cebu Capitol forms a task force for possible Super El Niño",
    summary: "A provincial order brings offices together to prepare for possible impacts on water supply, farming, fisheries, public health, and local livelihoods.",
    source: "The Freeman", url: "https://www.philstar.com/the-freeman/cebu-news/2026/11/03/2567505/capitol-forms-super-el-nio-task-force", publishedAt: "2026-11-03T00:00:00+08:00",
  },
  {
    id: "cebu-tino-rehab-2026-11-04", category: "Province",
    title: "Cebu faces ₱11.174 billion in rehabilitation needs a year after Tino",
    summary: "A provincial recovery assessment covers housing, schools, health centers, and infrastructure. The report also tracks bridge work and assistance for families affected by the typhoon.",
    source: "SunStar Cebu", url: "https://www.sunstar.com.ph/amp/story/cebu/tino-rehab-needs-p11b", publishedAt: "2026-11-04T18:10:00+08:00",
  },
];

function decodeXml(value: string) {
  return value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&apos;|&#39;/g, "'").replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&#x([\da-f]+);/gi, (_, n: string) => String.fromCodePoint(parseInt(n, 16)));
}

function field(xml: string, name: string) {
  const match = xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, "i"));
  return match ? decodeXml(match[1]).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim() : "";
}

function categorise(text: string) {
  const value = text.toLowerCase();
  if (/\bheat\b|\bel ni[nñ]o\b|\bdrought\b|\bflood\b|environment|rainfall|\bweather\b|\blandslide\b|\bmining\b/.test(value)) return "Community";
  if (/\bport\b|\btravel\b|\bairport\b|\bpassenger\b|\bferry\b|\bbridge\b|\btourism\b/.test(value)) return "Travel";
  if (/\bbusiness\b|\bprice\b|\bmarket\b|\bhog\b|\bfarm\b|\bagriculture\b|\btrade\b/.test(value)) return "Business";
  if (/\bfestival\b|\bculture\b|\bartist\b|\bart\b|\bheritage\b|\bsinulog\b/.test(value)) return "Culture";
  if (/\bcouncil\b|\bmayor\b|\bgovernment\b|\bcapitol\b|\bordinance\b|\bgovernance\b/.test(value)) return "City";
  return "Province";
}

function parseFeed(xml: string): Story[] {
  const entries = xml.match(/<item\b[\s\S]*?<\/item>/gi) || [];
  return entries.flatMap((entry, index) => {
    const title = field(entry, "title");
    const link = field(entry, "link");
    const description = field(entry, "description").replace(/\s+/g, " ");
    const pubDate = field(entry, "pubDate");
    const date = new Date(pubDate);
    if (!title || !/^https:\/\//i.test(link) || !Number.isFinite(date.getTime())) return [];
    const age = Date.now() - date.getTime();
    if (age > 21 * 24 * 60 * 60 * 1000 || age < -24 * 60 * 60 * 1000) return [];
    const localLead = `${title} ${description.slice(0, 180)}`;
    if (!/\bcebu\b|sugbo|mandaue|lapu[- ]?lapu|talisay|toledo|bogo|liloan|tuburan|compostela|balamban|carcar|danao|naga city|minglanilla|san fernando/i.test(localLead)) return [];
    const sourceMatch = entry.match(/<source[^>]*>([\s\S]*?)<\/source>/i);
    const source = sourceMatch ? decodeXml(sourceMatch[1]).trim() : "SunStar Cebu";
    const summary = description.replace(/The post[\s\S]*$/i, "").replace(/https?:\/\/\S+/g, "").replace(/\s*&nbsp;\s*/gi, " ").trim().slice(0, 230);
    return [{
      id: `${source}-${index}-${date.getTime()}`,
      category: categorise(localLead),
      title,
      summary: summary.length >= 230 ? `${summary}…` : summary,
      source,
      url: link,
      publishedAt: date.toISOString(),
    }];
  });
}

export const dynamic = "force-dynamic";

export async function GET() {
  let live: Story[] = [];
  try {
    const response = await fetch("https://www.sunstar.com.ph/feeds/cebu", {
      headers: { "User-Agent": "CebuCurrent/1.0 (local news links)" },
      signal: AbortSignal.timeout(5000),
      next: { revalidate: 900 },
    });
    if (response.ok) live = parseFeed(await response.text());
  } catch { /* The verified publisher links below keep the page available during feed interruptions. */ }
  const unique = new Map<string, Story>();
  for (const story of live) unique.set(story.url, story);
  const stories = unique.size
    ? [...unique.values()].sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt)).slice(0, 12)
    : currentStories;
  return NextResponse.json({ stories, live: unique.size > 0 }, {
    headers: { "Cache-Control": "public, s-maxage=900, stale-while-revalidate=3600" },
  });
}
