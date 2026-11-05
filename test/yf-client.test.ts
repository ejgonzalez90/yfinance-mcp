import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetSession, yfGet } from "../src/yf-client.js";

function res(
  status: number,
  body: string,
  headers: Record<string, string> = {},
) {
  return new Response(body, { status, headers });
}

describe("yf-client (fetch mocked)", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    resetSession();
    vi.spyOn(console, "error").mockImplementation(() => {});
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("acquires a crumb, then sends it and skips undefined params", async () => {
    fetchMock
      .mockResolvedValueOnce(res(200, "", { "set-cookie": "A=1; Path=/" }))
      .mockResolvedValueOnce(res(200, "crumb123"))
      .mockResolvedValueOnce(res(200, JSON.stringify({ hello: "world" })));

    const out = await yfGet("/v7/finance/quote", {
      symbols: "AAPL",
      x: undefined,
    });
    expect(out).toEqual({ hello: "world" });

    const url = new URL(fetchMock.mock.calls[2][0] as string);
    expect(url.searchParams.get("crumb")).toBe("crumb123");
    expect(url.searchParams.get("symbols")).toBe("AAPL");
    expect(url.searchParams.has("x")).toBe(false);
  });

  it("throws with status and body on non-OK responses", async () => {
    fetchMock
      .mockResolvedValueOnce(res(200, ""))
      .mockResolvedValueOnce(res(200, "c"))
      .mockResolvedValueOnce(res(500, "oops"));
    await expect(yfGet("/x")).rejects.toThrow("Yahoo Finance API 500: oops");
  });

  it("refreshes the crumb once on 401 and gives up on a second 401", async () => {
    fetchMock
      .mockResolvedValueOnce(res(200, ""))
      .mockResolvedValueOnce(res(200, "c1"))
      .mockResolvedValueOnce(res(401, "no"))
      .mockResolvedValueOnce(res(200, ""))
      .mockResolvedValueOnce(res(200, "c2"))
      .mockResolvedValueOnce(res(401, "still no"));
    await expect(yfGet("/x")).rejects.toThrow("Yahoo Finance API 401");
    expect(fetchMock).toHaveBeenCalledTimes(6);
  });

  it("fails clearly when the crumb endpoint returns an empty crumb", async () => {
    fetchMock
      .mockResolvedValueOnce(res(200, ""))
      .mockResolvedValueOnce(res(200, "null"));
    await expect(yfGet("/x")).rejects.toThrow("empty crumb");
  });
});
