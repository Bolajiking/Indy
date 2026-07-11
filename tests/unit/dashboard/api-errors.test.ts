import { describe, expect, it, vi } from "vitest";
import { ApiRequestError, fetchDeals } from "../../../dashboard/src/lib/api";
import { NextRequest } from "../../../dashboard/node_modules/next/server";
import { GET as proxyGet } from "../../../dashboard/src/app/api/proxy/[...path]/route";

describe("dashboard API errors", () => {
  it("parses the stable error envelope and preserves requestId", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              error: {
                code: "INVALID",
                message: "Bad input",
                requestId: "req-1",
              },
            }),
            { status: 400 },
          ),
      ),
    );
    await expect(fetchDeals("token")).rejects.toMatchObject({
      name: "ApiRequestError",
      message: "Bad input",
      code: "INVALID",
      requestId: "req-1",
    });
  });

  it("temporarily accepts the legacy string error shape", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ error: "Legacy error" }), {
            status: 400,
          }),
      ),
    );
    await expect(fetchDeals("token")).rejects.toBeInstanceOf(ApiRequestError);
  });
});

describe("dashboard proxy correlation", () => {
  it("forwards inbound request IDs and returns the backend correlation ID", async () => {
    const upstream = vi.fn(async (_url: string, init?: RequestInit) => {
      expect(new Headers(init?.headers).get("X-Request-Id")).toBe(
        "dashboard-req-1",
      );
      return new Response("{}", {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "X-Request-Id": "backend-req-1",
        },
      });
    });
    vi.stubGlobal("fetch", upstream);
    const request = new NextRequest("http://localhost/api/proxy/api/deals", {
      headers: { "X-Request-Id": "dashboard-req-1" },
    });
    const response = await proxyGet(request, {
      params: Promise.resolve({ path: ["api", "deals"] }),
    });
    expect(response.headers.get("X-Request-Id")).toBe("backend-req-1");
  });
});
