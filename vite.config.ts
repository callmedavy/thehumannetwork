import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

const HOST_PATTERN = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*\.[a-z]{2,}$/;

type DevRequest = AsyncIterable<Uint8Array> & {
  url?: string;
  method?: string;
  headers: Record<string, string | string[] | undefined>;
};

type DevResponse = {
  statusCode: number;
  setHeader: (name: string, value: string) => void;
  end: (body?: string) => void;
};

async function readBody(request: DevRequest) {
  const chunks: Uint8Array[] = [];
  for await (const chunk of request) chunks.push(chunk);
  const body = new Uint8Array(chunks.reduce((total, chunk) => total + chunk.length, 0));
  let offset = 0;
  chunks.forEach((chunk) => {
    body.set(chunk, offset);
    offset += chunk.length;
  });
  return body;
}

// Mirrors netlify/functions/lemmy-proxy.mts so `npm run dev` can also reach
// instances that block cross-origin browser requests.
function lemmyProxy(): Plugin {
  return {
    name: "lemmy-dev-proxy",
    configureServer(server) {
      server.middlewares.use("/api/lemmy", async (incoming, outgoing, next) => {
        const request = incoming as unknown as DevRequest;
        const response = outgoing as unknown as DevResponse;

        const [path, search] = (request.url ?? "").split("?");
        const [, rawInstance = "", rest = ""] = /^\/([^/]+)(\/.*)?$/.exec(path) ?? [];
        const instance = rawInstance.toLowerCase();
        if (!HOST_PATTERN.test(instance) || !rest.startsWith("/api/")) return next();

        const headers = new Headers({ "user-agent": "TheHumanNetwork/1.0 (local dev)" });
        ["authorization", "content-type", "accept"].forEach((name) => {
          const value = request.headers[name];
          if (typeof value === "string") headers.set(name, value);
        });

        const method = request.method ?? "GET";
        response.setHeader("x-lemmy-proxy", "1");

        try {
          const upstream = await fetch(`https://${instance}${rest}${search ? `?${search}` : ""}`, {
            method,
            headers,
            body: method === "GET" || method === "HEAD" ? undefined : await readBody(request),
          });
          response.statusCode = upstream.status;
          response.setHeader("content-type", upstream.headers.get("content-type") ?? "application/json");
          response.end(await upstream.text());
        } catch {
          response.statusCode = 502;
          response.setHeader("content-type", "application/json");
          response.end(JSON.stringify({ error: `Could not reach ${instance}.` }));
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), lemmyProxy()],
});
