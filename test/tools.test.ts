import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/yf-client.js", () => ({
  yfGet: vi.fn(),
  yfChart: vi.fn(),
}));

import { yfGet, yfChart } from "../src/yf-client.js";
import { register as registerMarketData } from "../src/tools/market-data.js";
import { register as registerFundamentals } from "../src/tools/fundamentals.js";
import { register as registerSearch } from "../src/tools/search.js";
import { callTool, fakeServer } from "./helpers.js";

const mockGet = vi.mocked(yfGet);
const mockChart = vi.mocked(yfChart);

function setup() {
  const { server, tools } = fakeServer();
  registerMarketData(server);
  registerFundamentals(server);
  registerSearch(server);
  return tools;
}

const parse = (r: { content: { text: string }[] }) =>
  JSON.parse(r.content[0].text);

describe("tool registration", () => {
  it("registers every expected tool exactly once", () => {
    const names = [...setup().keys()].sort();
    expect(names).toEqual(
      [
        "yf_analyst_recommendations",
        "yf_dividends_and_splits",
        "yf_esg",
        "yf_financials",
        "yf_fund_holdings",
        "yf_historical",
        "yf_holders",
        "yf_info",
        "yf_market_summary",
        "yf_news",
        "yf_options",
        "yf_quote",
        "yf_quote_summary",
        "yf_recommendations",
        "yf_screener",
        "yf_search",
        "yf_trending",
      ].sort(),
    );
  });

  it("gives every tool a description", () => {
    for (const [name, t] of setup()) {
      expect(t.def.description, name).toBeTruthy();
    }
  });
});

describe("tool handlers", () => {
  let tools: ReturnType<typeof setup>;
  beforeEach(() => {
    vi.resetAllMocks();
    mockGet.mockResolvedValue({ ok: true });
    mockChart.mockResolvedValue({ ok: true });
    tools = setup();
  });

  it("yf_quote joins an array of symbols with commas", async () => {
    await callTool(tools, "yf_quote", { symbols: ["AAPL", "MSFT"] });
    expect(mockGet).toHaveBeenCalledWith("/v7/finance/quote", {
      symbols: "AAPL,MSFT",
    });
  });

  it("yf_quote accepts a single string symbol", async () => {
    await callTool(tools, "yf_quote", { symbols: "SPY" });
    expect(mockGet).toHaveBeenCalledWith("/v7/finance/quote", {
      symbols: "SPY",
    });
  });

  it("yf_quote rejects missing symbols", async () => {
    await expect(callTool(tools, "yf_quote", {})).rejects.toThrow();
  });

  it("returns pretty-printed JSON text content", async () => {
    mockGet.mockResolvedValue({ a: 1 });
    const res = await callTool(tools, "yf_quote", { symbols: "X" });
    expect(res.content[0].type).toBe("text");
    expect(res.content[0].text).toBe(JSON.stringify({ a: 1 }, null, 2));
  });

  it("yf_historical uses range shorthand without period timestamps", async () => {
    await callTool(tools, "yf_historical", { symbol: "AAPL", period1: "1mo" });
    expect(mockChart).toHaveBeenCalledWith("AAPL", {
      range: "1mo",
      interval: "1d",
      includePrePost: false,
    });
  });

  it("yf_historical converts ISO dates to Unix seconds", async () => {
    await callTool(tools, "yf_historical", {
      symbol: "AAPL",
      period1: "2024-01-01",
      period2: "2024-01-02",
      interval: "1wk",
    });
    expect(mockChart).toHaveBeenCalledWith("AAPL", {
      period1: 1704067200,
      period2: 1704153600,
      interval: "1wk",
      includePrePost: false,
    });
  });

  it("yf_historical rejects an unsupported interval", async () => {
    await expect(
      callTool(tools, "yf_historical", {
        symbol: "AAPL",
        period1: "1y",
        interval: "7d",
      }),
    ).rejects.toThrow();
  });

  it("yf_options passes an expiration as Unix seconds, and omits it otherwise", async () => {
    await callTool(tools, "yf_options", { symbol: "AAPL" });
    expect(mockGet).toHaveBeenLastCalledWith("/v7/finance/options/AAPL", {});
    await callTool(tools, "yf_options", {
      symbol: "AAPL",
      expirationDate: "2025-06-20",
    });
    expect(mockGet).toHaveBeenLastCalledWith("/v7/finance/options/AAPL", {
      date: 1750377600,
    });
  });

  it("yf_trending applies region and count defaults", async () => {
    await callTool(tools, "yf_trending", {});
    expect(mockGet).toHaveBeenCalledWith("/v1/finance/trending/US", {
      count: 20,
    });
  });

  it("yf_info requests the profile-related quoteSummary modules", async () => {
    await callTool(tools, "yf_info", { symbol: "AAPL" });
    const [path, params] = mockGet.mock.calls[0];
    expect(path).toBe("/v10/finance/quoteSummary/AAPL");
    expect((params as { modules: string }).modules.split(",")).toEqual([
      "assetProfile",
      "summaryDetail",
      "financialData",
      "defaultKeyStatistics",
      "price",
      "quoteType",
    ]);
  });

  it("yf_financials maps statement names to quoteSummary modules", async () => {
    await callTool(tools, "yf_financials", {
      symbol: "AAPL",
      statements: ["income", "cashflowQuarterly"],
    });
    expect(mockGet.mock.calls[0][1]).toEqual({
      modules: "incomeStatementHistory,cashflowStatementHistoryQuarterly",
    });
  });

  it("yf_quote_summary rejects unknown modules", async () => {
    await expect(
      callTool(tools, "yf_quote_summary", {
        symbol: "AAPL",
        modules: ["notAModule"],
      }),
    ).rejects.toThrow();
  });

  it("yf_dividends_and_splits narrows the chart payload to events", async () => {
    mockChart.mockResolvedValue({
      chart: {
        result: [{ events: { dividends: { 1: { amount: 0.2 } } }, meta: {} }],
      },
    });
    const res = await callTool(tools, "yf_dividends_and_splits", {
      symbol: "AAPL",
    });
    expect(parse(res)).toEqual({ dividends: { 1: { amount: 0.2 } } });
  });

  it("yf_dividends_and_splits returns {} when Yahoo sends no events", async () => {
    mockChart.mockResolvedValue({ chart: { result: [{}] } });
    const res = await callTool(tools, "yf_dividends_and_splits", {
      symbol: "AAPL",
    });
    expect(parse(res)).toEqual({});
  });

  it("yf_news returns only the news array, or [] when absent", async () => {
    mockGet.mockResolvedValueOnce({ news: [{ title: "t" }], quotes: [1] });
    expect(parse(await callTool(tools, "yf_news", { query: "AAPL" }))).toEqual([
      { title: "t" },
    ]);
    mockGet.mockResolvedValueOnce({});
    expect(parse(await callTool(tools, "yf_news", { query: "AAPL" }))).toEqual(
      [],
    );
  });

  it("yf_screener forwards the screener id with defaults", async () => {
    await callTool(tools, "yf_screener", { scrIds: "day_gainers" });
    expect(mockGet).toHaveBeenCalledWith(
      "/v1/finance/screener/predefined/saved",
      { scrIds: "day_gainers", count: 25, region: "US", lang: "en-US" },
    );
  });

  it("propagates upstream errors so the MCP layer can report them", async () => {
    mockGet.mockRejectedValue(new Error("Yahoo Finance API 500: boom"));
    await expect(
      callTool(tools, "yf_quote", { symbols: "AAPL" }),
    ).rejects.toThrow("Yahoo Finance API 500");
  });

  it("url-encodes symbols in path parameters", async () => {
    await callTool(tools, "yf_recommendations", { symbol: "BRK/B" });
    expect(mockGet).toHaveBeenCalledWith(
      "/v6/finance/recommendationsbysymbol/BRK%2FB",
    );
  });
});
