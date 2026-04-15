import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { yfGet, yfChart } from "../yf-client.js";

export function register(server: McpServer) {
  // ── Real-time Quote ──────────────────────────────────────────────────────

  server.registerTool(
    "yf_quote",
    {
      description:
        "Get real-time quote data for one or more ticker symbols: price, change %, volume, market cap, PE ratio, 52-week range, bid/ask, and more.",
      inputSchema: {
        symbols: z
          .union([z.string(), z.array(z.string())])
          .describe(
            "Single ticker (e.g. 'AAPL') or array (e.g. ['AAPL', 'MSFT', 'SPY'])",
          ),
      },
    },
    async ({ symbols }) => {
      const list = Array.isArray(symbols) ? symbols : [symbols];
      const result = await yfGet("/v7/finance/quote", {
        symbols: list.join(","),
      });
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    },
  );

  // ── Historical Prices (Chart) ────────────────────────────────────────────

  server.registerTool(
    "yf_historical",
    {
      description:
        "Get historical OHLCV price data for a symbol. Equivalent to yfinance Ticker.history(). Supports daily, weekly, monthly and intraday intervals.",
      inputSchema: {
        symbol: z.string().describe("Ticker symbol (e.g. 'AAPL')"),
        period1: z
          .string()
          .describe(
            "Start date as ISO 8601 string (e.g. '2024-01-01') OR a shorthand range string (e.g. '1d', '5d', '1mo', '3mo', '6mo', '1y', '2y', '5y', '10y', 'ytd', 'max'). When using a range string, omit period2.",
          ),
        period2: z
          .string()
          .optional()
          .describe(
            "End date as ISO 8601 (e.g. '2024-12-31'). Omit when period1 is a range string.",
          ),
        interval: z
          .enum([
            "1m",
            "2m",
            "5m",
            "15m",
            "30m",
            "60m",
            "90m",
            "1h",
            "1d",
            "5d",
            "1wk",
            "1mo",
            "3mo",
          ])
          .optional()
          .default("1d")
          .describe("Bar interval. Default: '1d'."),
        includePrePost: z
          .boolean()
          .optional()
          .default(false)
          .describe("Include pre/post market data. Default: false."),
      },
    },
    async ({ symbol, period1, period2, interval, includePrePost }) => {
      const RANGE_SHORTHANDS = new Set([
        "1d",
        "5d",
        "1mo",
        "3mo",
        "6mo",
        "1y",
        "2y",
        "5y",
        "10y",
        "ytd",
        "max",
      ]);

      let params: Record<string, string | number | boolean>;

      if (RANGE_SHORTHANDS.has(period1)) {
        params = {
          range: period1,
          interval: interval ?? "1d",
          includePrePost: includePrePost ?? false,
        };
      } else {
        const p1 = Math.floor(new Date(period1).getTime() / 1000);
        const p2 = period2
          ? Math.floor(new Date(period2).getTime() / 1000)
          : Math.floor(Date.now() / 1000);
        params = {
          period1: p1,
          period2: p2,
          interval: interval ?? "1d",
          includePrePost: includePrePost ?? false,
        };
      }

      const result = await yfChart(symbol, params);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    },
  );

  // ── Options Chain ────────────────────────────────────────────────────────

  server.registerTool(
    "yf_options",
    {
      description:
        "Get the options chain (calls & puts) for a symbol. Without an expiration date, returns available expiry dates. With a date, returns the full call/put chain for that expiration.",
      inputSchema: {
        symbol: z.string().describe("Ticker symbol (e.g. 'AAPL')"),
        expirationDate: z
          .string()
          .optional()
          .describe(
            "Expiration date as ISO 8601 (e.g. '2025-06-20'). Omit to list all available expiration dates.",
          ),
      },
    },
    async ({ symbol, expirationDate }) => {
      const params: Record<string, string | number> = {};
      if (expirationDate) {
        params.date = Math.floor(new Date(expirationDate).getTime() / 1000);
      }
      const result = await yfGet(
        `/v7/finance/options/${encodeURIComponent(symbol)}`,
        params,
      );
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    },
  );

  // ── Trending Symbols ─────────────────────────────────────────────────────

  server.registerTool(
    "yf_trending",
    {
      description:
        "Get the currently trending ticker symbols for a given market region.",
      inputSchema: {
        region: z
          .string()
          .optional()
          .default("US")
          .describe(
            "Region code. Common: 'US', 'GB', 'DE', 'FR', 'BR', 'AR'. Default: 'US'.",
          ),
        count: z
          .number()
          .optional()
          .default(20)
          .describe("Number of trending symbols to return. Default: 20."),
      },
    },
    async ({ region, count }) => {
      const result = await yfGet(
        `/v1/finance/trending/${encodeURIComponent(region ?? "US")}`,
        { count },
      );
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    },
  );

  // ── Market Summary ───────────────────────────────────────────────────────

  server.registerTool(
    "yf_market_summary",
    {
      description:
        "Get a snapshot of major market indices (S&P 500, Nasdaq, Dow, etc.) and key benchmarks for a given region.",
      inputSchema: {
        region: z
          .string()
          .optional()
          .default("US")
          .describe("Region code (e.g. 'US', 'GB', 'AR'). Default: 'US'."),
        lang: z
          .string()
          .optional()
          .default("en-US")
          .describe("Language/locale. Default: 'en-US'."),
      },
    },
    async ({ region, lang }) => {
      const result = await yfGet("/v6/finance/quote/marketSummary", {
        region,
        lang,
      });
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    },
  );
}
