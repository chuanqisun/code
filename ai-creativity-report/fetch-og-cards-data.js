import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const directory = fileURLToPath(new URL(".", import.meta.url));
const indexPath = new URL("index.html", import.meta.url);
const outputPath = new URL("data.json", import.meta.url);
const timeoutMs = 10_000;

const decodeHtml = (value = "") =>
  value
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&nbsp;/gi, " ")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .trim();

const getAttribute = (tag, name) => {
  const match = tag.match(new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"));
  return decodeHtml(match?.[1] ?? match?.[2] ?? match?.[3] ?? "");
};

const readMetadata = (html, url) => {
  const metadata = new Map();

  for (const [tag] of html.matchAll(/<meta\b[^>]*>/gi)) {
    const key = getAttribute(tag, "property") || getAttribute(tag, "name");
    const content = getAttribute(tag, "content");
    if (key && content && !metadata.has(key.toLowerCase())) metadata.set(key.toLowerCase(), content);
  }

  const title = decodeHtml(html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/<[^>]+>/g, " ") ?? "");
  const hostname = new URL(url).hostname.replace(/^www\./, "");

  return {
    title: metadata.get("og:title") || metadata.get("twitter:title") || title || hostname,
    description: metadata.get("og:description") || metadata.get("twitter:description") || metadata.get("description") || "Open external resource",
    site: metadata.get("og:site_name") || hostname,
    image: metadata.get("og:image") || metadata.get("twitter:image") || "",
  };
};

const fetchMetadata = async (url) => {
  try {
    const response = await fetch(url, {
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent": "Mozilla/5.0 (compatible; OGCardFetcher/1.0)",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    return { ...readMetadata(await response.text(), url), fetched: true };
  } catch (error) {
    const hostname = new URL(url).hostname.replace(/^www\./, "");
    console.warn(`Could not fetch ${url}: ${error.message}`);
    return {
      title: hostname,
      description: "Preview unavailable - open the source directly.",
      site: hostname,
      image: "",
      fetched: false,
    };
  }
};

const html = await readFile(indexPath, "utf8");
const urls = [...new Set([...html.matchAll(/<og-card\b[^>]*\bhref\s*=\s*(?:"([^"]+)"|'([^']+)')[^>]*>/gi)].map((match) => decodeHtml(match[1] ?? match[2])))];

if (urls.length === 0) throw new Error(`No <og-card href> elements found in ${directory}index.html`);

const entries = await Promise.all(urls.map(async (url) => [url, await fetchMetadata(url)]));
await writeFile(outputPath, `${JSON.stringify(Object.fromEntries(entries), null, 2)}\n`);
console.log(`Wrote ${entries.length} OG card entries to ${directory}data.json`);
