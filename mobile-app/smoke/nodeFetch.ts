// jest-expo replaces global fetch with a React Native polyfill that cannot read real
// responses. Live smoke tests use Node's own HTTPS client through this minimal fetch shim.
import https from "node:https";

export const nodeFetch = ((url: string, init: { method?: string; headers?: Record<string, string>; body?: string; signal?: AbortSignal } = {}) =>
  new Promise((resolve, reject) => {
    const req = https.request(url, { method: init.method ?? "GET", headers: init.headers, signal: init.signal }, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => {
        const text = Buffer.concat(chunks).toString("utf8");
        const status = res.statusCode ?? 0;
        resolve({
          status,
          ok: status >= 200 && status < 300,
          headers: { get: (k: string) => (res.headers[k.toLowerCase()] as string | undefined) ?? null },
          text: async () => text,
          json: async () => JSON.parse(text),
        });
      });
    });
    req.on("error", reject);
    if (init.body) req.write(init.body);
    req.end();
  })) as unknown as typeof fetch;
