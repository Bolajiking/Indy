import http from "node:http";
import https from "node:https";

function createAbortError() {
  return new DOMException("The operation was aborted.", "AbortError");
}

function normalizeResponseHeaders(headers: http.IncomingHttpHeaders): Headers {
  const normalized = new Headers();

  for (const [key, value] of Object.entries(headers)) {
    if (typeof value === "undefined") {
      continue;
    }

    if (Array.isArray(value)) {
      for (const entry of value) {
        normalized.append(key, entry);
      }
      continue;
    }

    normalized.set(key, value);
  }

  return normalized;
}

export async function ipv4Fetch(
  input: string | URL | Request,
  init?: RequestInit,
): Promise<Response> {
  const request = new Request(input, init);
  const url = new URL(request.url);
  const client = url.protocol === "http:" ? http : https;
  const body =
    request.method === "GET" || request.method === "HEAD"
      ? null
      : Buffer.from(await request.arrayBuffer());

  return new Promise<Response>((resolve, reject) => {
    const abort = () => {
      const error = createAbortError();
      req.destroy(error);
      reject(error);
    };

    const req = client.request(
      url,
      {
        method: request.method,
        headers: Object.fromEntries(request.headers.entries()),
        family: 4,
      },
      (response) => {
        const chunks: Buffer[] = [];

        response.on("data", (chunk) => {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        });
        response.on("end", () => {
          if (request.signal) {
            request.signal.removeEventListener("abort", abort);
          }

          resolve(
            new Response(Buffer.concat(chunks), {
              status: response.statusCode ?? 500,
              headers: normalizeResponseHeaders(response.headers),
            }),
          );
        });
      },
    );

    req.on("error", (error) => {
      if (request.signal) {
        request.signal.removeEventListener("abort", abort);
      }

      reject(error);
    });

    if (request.signal) {
      if (request.signal.aborted) {
        abort();
        return;
      }

      request.signal.addEventListener("abort", abort, { once: true });
    }

    if (body) {
      req.write(body);
    }

    req.end();
  });
}
