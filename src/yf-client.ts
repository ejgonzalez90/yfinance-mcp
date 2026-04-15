/**
 * Minimal Yahoo Finance HTTP client.
 *
 * Yahoo Finance requires a crumb token (+ session cookies) for most API calls.
 * This client handles crumb acquisition and refresh automatically, mirroring
 * how ppi-client.ts manages PPI bearer tokens.
 */

const YF_QUERY_HOST1 = "query1.finance.yahoo.com";
const YF_QUERY_HOST2 = "query2.finance.yahoo.com";
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

let crumb: string | null = null;
let cookieString: string | null = null;

function log(msg: string) {
  console.error(`[${new Date().toISOString()}] INFO [yf-client] ${msg}`);
}

function parseCookies(headers: Headers): string {
  // Node 18+ exposes getSetCookie(); fall back to iterating raw Set-Cookie.
  const raw: string[] =
    typeof (headers as unknown as { getSetCookie?: () => string[] })
      .getSetCookie === "function"
      ? (headers as unknown as { getSetCookie: () => string[] }).getSetCookie()
      : [];

  if (raw.length === 0) {
    // Fallback: parse the single comma-folded header value.
    const single = headers.get("set-cookie");
    if (single) raw.push(...single.split(/,\s*(?=[^;]+=[^;]+)/));
  }

  return raw
    .map((c) => c.split(";")[0].trim())
    .filter(Boolean)
    .join("; ");
}

async function acquireCrumb(): Promise<void> {
  log("Acquiring Yahoo Finance crumb + cookies…");

  // Step 1 — hit fc.yahoo.com to obtain the initial consent cookie set.
  const fcRes = await fetch("https://fc.yahoo.com", {
    redirect: "follow",
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
  });
  cookieString = parseCookies(fcRes.headers);
  log(`Got ${cookieString ? "cookies" : "no cookies"} from fc.yahoo.com`);

  // Step 2 — exchange cookies for a crumb.
  const crumbRes = await fetch(`https://${YF_QUERY_HOST1}/v1/test/getcrumb`, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "text/plain",
      Cookie: cookieString ?? "",
    },
  });

  if (!crumbRes.ok) {
    throw new Error(
      `Crumb fetch failed: ${crumbRes.status} ${await crumbRes.text()}`,
    );
  }

  crumb = (await crumbRes.text()).trim();
  if (!crumb || crumb === "null") {
    throw new Error("Yahoo Finance returned an empty crumb. Try again later.");
  }

  log(`Crumb acquired: ${crumb.slice(0, 6)}…`);
}

async function ensureCrumb(): Promise<{ crumb: string; cookie: string }> {
  if (!crumb || !cookieString) await acquireCrumb();
  return { crumb: crumb!, cookie: cookieString! };
}

export type QueryParams = Record<
  string,
  string | number | boolean | undefined | null
>;

/**
 * GET a Yahoo Finance API endpoint.
 * Automatically injects crumb + cookie and retries once on auth failure.
 */
export async function yfGet(
  path: string,
  params: QueryParams = {},
  host = YF_QUERY_HOST1,
): Promise<unknown> {
  const { crumb: c, cookie } = await ensureCrumb();

  const url = new URL(`https://${host}${path}`);
  url.searchParams.set("crumb", c);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
  }

  log(`GET ${url.pathname}${url.search}`);

  const res = await fetch(url.toString(), {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "application/json",
      Cookie: cookie,
    },
  });

  if (res.status === 401 || res.status === 403) {
    // Crumb expired — invalidate and retry once.
    log("Auth error, refreshing crumb…");
    crumb = null;
    cookieString = null;
    return yfGet(path, params, host);
  }

  if (!res.ok) {
    throw new Error(`Yahoo Finance API ${res.status}: ${await res.text()}`);
  }

  return res.json();
}

/** Shorthand for chart/historical endpoints on host2. */
export async function yfChart(
  symbol: string,
  params: QueryParams = {},
): Promise<unknown> {
  return yfGet(`/v8/finance/chart/${encodeURIComponent(symbol)}`, params);
}
