import { EventEmitter } from "node:events";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { httpRequestMock, httpsRequestMock } = vi.hoisted(() => ({
  httpRequestMock: vi.fn(),
  httpsRequestMock: vi.fn(),
}));

vi.mock("node:http", () => ({
  default: { request: httpRequestMock },
  request: httpRequestMock,
}));

vi.mock("node:https", () => ({
  default: { request: httpsRequestMock },
  request: httpsRequestMock,
}));

import { ipv4Fetch } from "../../../src/network/ipv4-fetch.js";

describe("ipv4Fetch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("forces family 4 when making HTTPS requests", async () => {
    httpsRequestMock.mockImplementation((url, options, onResponse) => {
      const response = new EventEmitter() as EventEmitter & {
        statusCode: number;
        headers: Record<string, string>;
      };
      response.statusCode = 201;
      response.headers = { "content-type": "application/json" };

      const request = {
        on: vi.fn().mockReturnThis(),
        write: vi.fn(),
        end: vi.fn(() => {
          onResponse(response);
          response.emit("data", Buffer.from("{\"ok\":true}"));
          response.emit("end");
        }),
      };

      return request;
    });

    const response = await ipv4Fetch("https://api.privy.io/v1/test", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ok: true }),
    });

    expect(httpsRequestMock).toHaveBeenCalledWith(
      expect.any(URL),
      expect.objectContaining({
        family: 4,
        method: "POST",
      }),
      expect.any(Function)
    );
    expect(await response.json()).toEqual({ ok: true });
  });
});
