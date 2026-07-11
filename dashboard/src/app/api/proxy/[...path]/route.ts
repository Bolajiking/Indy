import { NextRequest, NextResponse } from "next/server";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";
const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const VALID_REQUEST_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

function requestId(req: NextRequest): string {
  const inbound = req.headers.get("X-Request-Id");
  return inbound && VALID_REQUEST_ID.test(inbound)
    ? inbound
    : crypto.randomUUID();
}

function isTrustedProxyOrigin(req: NextRequest): boolean {
  if (!MUTATING_METHODS.has(req.method)) {
    return true;
  }

  const origin = req.headers.get("Origin");
  if (!origin) {
    return true;
  }

  return origin === req.nextUrl.origin;
}

/**
 * Proxy all requests from the dashboard to the backend API.
 * This avoids CORS issues when running the dashboard on a different port.
 */
async function proxyRequest(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const correlationId = requestId(req);
  if (!isTrustedProxyOrigin(req)) {
    return NextResponse.json(
      { error: "Untrusted request origin" },
      { status: 403, headers: { "X-Request-Id": correlationId } },
    );
  }

  const { path } = await params;
  const targetPath = `/${path.join("/")}`;
  const url = new URL(targetPath, API_BASE);

  req.nextUrl.searchParams.forEach((value, key) => {
    url.searchParams.set(key, value);
  });

  const headers = new Headers();
  const authHeader = req.headers.get("Authorization");
  if (authHeader) {
    headers.set("Authorization", authHeader);
  }
  headers.set(
    "Content-Type",
    req.headers.get("Content-Type") ?? "application/json",
  );
  headers.set("X-Request-Id", correlationId);

  try {
    const response = await fetch(url.toString(), {
      method: req.method,
      headers,
      body:
        req.method !== "GET" && req.method !== "HEAD"
          ? await req.text()
          : undefined,
    });

    const data = await response.text();

    return new NextResponse(data, {
      status: response.status,
      headers: {
        "Content-Type":
          response.headers.get("Content-Type") ?? "application/json",
        "X-Request-Id": response.headers.get("X-Request-Id") ?? correlationId,
      },
    });
  } catch {
    return NextResponse.json(
      {
        error: {
          code: "BACKEND_UNAVAILABLE",
          message: "Backend unavailable",
          requestId: correlationId,
        },
      },
      { status: 502, headers: { "X-Request-Id": correlationId } },
    );
  }
}

export const GET = proxyRequest;
export const POST = proxyRequest;
export const PUT = proxyRequest;
export const DELETE = proxyRequest;
export const PATCH = proxyRequest;
