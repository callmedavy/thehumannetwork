// Some Lemmy deployments (lemmy.world among them) reject cross-origin browser
// traffic, so the client routes API calls through this same-origin proxy.
export const config = {
  path: "/api/lemmy/*",
};

const HOST_PATTERN = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*\.[a-z]{2,}$/;
const BLOCKED_HOSTS = /(^|\.)(local|localhost|internal|home|lan)$/;
const FORWARDED_REQUEST_HEADERS = ["authorization", "content-type", "accept", "accept-language"];
const UPSTREAM_TIMEOUT_MS = 9_500;
const USER_AGENT = "TheHumanNetwork/1.0 (+https://thehumannetwork.netlify.app)";

function jsonError(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
      "x-lemmy-proxy": "1",
    },
  });
}

function parseTarget(url: URL) {
  const segments = url.pathname
    .replace(/^\/\.netlify\/functions\/lemmy-proxy/, "")
    .replace(/^\/api\/lemmy/, "")
    .split("/")
    .filter(Boolean)
    .map((segment) => decodeURIComponent(segment));

  const instance = (segments.shift() ?? "").toLowerCase();
  if (!HOST_PATTERN.test(instance) || BLOCKED_HOSTS.test(instance)) return null;
  // Scoped to the Lemmy REST surface so this never becomes a general-purpose proxy.
  if (segments[0] !== "api") return null;

  return `https://${instance}/${segments.map((segment) => encodeURIComponent(segment)).join("/")}${url.search}`;
}

export default async (req: Request) => {
  const target = parseTarget(new URL(req.url));
  if (!target) return jsonError("Unsupported Lemmy instance or endpoint.", 400);

  const headers = new Headers({ "user-agent": USER_AGENT });
  FORWARDED_REQUEST_HEADERS.forEach((name) => {
    const value = req.headers.get(name);
    if (value) headers.set(name, value);
  });

  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method: req.method,
      headers,
      body: req.method === "GET" || req.method === "HEAD" ? undefined : await req.text(),
      redirect: "follow",
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
  } catch (error) {
    const reason = error instanceof Error && error.name === "TimeoutError" ? "the request timed out" : "the instance did not respond";
    return jsonError(`Could not reach ${new URL(target).hostname} because ${reason}.`, 502);
  }

  const contentType = upstream.headers.get("content-type") ?? "";
  const body = await upstream.text();

  // Cloudflare-style challenge pages come back as HTML; turn them into a message the UI can show.
  if (!contentType.includes("json") && !upstream.ok) {
    return jsonError(`${new URL(target).hostname} refused the request with status ${upstream.status}.`, upstream.status);
  }

  return new Response(body, {
    status: upstream.status,
    headers: {
      "content-type": contentType || "application/json",
      "cache-control": "no-store",
      "x-lemmy-proxy": "1",
    },
  });
};
