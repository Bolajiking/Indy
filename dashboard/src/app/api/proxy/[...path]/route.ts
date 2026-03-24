import { NextRequest, NextResponse } from "next/server";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

/**
 * Proxy all requests from the dashboard to the backend API.
 * This avoids CORS issues when running the dashboard on a different port.
 */
async function proxyRequest(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const targetPath = `/${path.join("/")}`;
  const url = new URL(targetPath, API_BASE);

  // Forward query params
  req.nextUrl.searchParams.forEach((value, key) => {
    url.searchParams.set(key, value);
  });

  const headers = new Headers();
  // Forward auth header if present
  const authHeader = req.headers.get("Authorization");
  if (authHeader) {
    headers.set("Authorization", authHeader);
  }
  headers.set("Content-Type", req.headers.get("Content-Type") ?? "application/json");

  try {
    const response = await fetch(url.toString(), {
      method: req.method,
      headers,
      body: req.method !== "GET" && req.method !== "HEAD" ? await req.text() : undefined,
    });

    const data = await response.text();

    return new NextResponse(data, {
      status: response.status,
      headers: {
        "Content-Type": response.headers.get("Content-Type") ?? "application/json",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Backend unavailable" },
      { status: 502 }
    );
  }
}

export const GET = proxyRequest;
export const POST = proxyRequest;
export const PUT = proxyRequest;
export const DELETE = proxyRequest;
export const PATCH = proxyRequest;
