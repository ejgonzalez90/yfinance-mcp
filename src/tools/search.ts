import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { yfGet } from "../yf-client.js";

export function register(server: McpServer) {
  // ── Search ───────────────────────────────────────────────────────────────

  server.registerTool(
    "yf_search",
    {
      description:
        "Search for ticker symbols, ETFs, mutual funds, indices, or crypto by name or keyword. Returns matching instruments and related news.",
      inputSchema: {
        query: z
          .string()
          .describe(
            "Search term — company name, ticker, or keyword (e.g. 'Apple', 'energy ETF', 'bitcoin')",
          ),
        quotesCount: z
          .number()
          .optional()
          .default(10)
          .describe("Max matching quotes to return. Default: 10."),
        newsCount: z
          .number()
          .optional()
          .default(5)
          .describe("Max news headlines to return. Default: 5."),
      },
    },
    async ({ query, quotesCount, newsCount }) => {
      const result = await yfGet("/v1/finance/search", {
        q: query,
        quotesCount,
        newsCount,
        enableFuzzyQuery: false,
        enableCb: true,
        enableNavLinks: false,
        enableEnhancedTrivialQuery: true,
      });
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    },
  );

  // ── News ─────────────────────────────────────────────────────────────────

  server.registerTool(
    "yf_news",
    {
      description:
        "Get the latest news headlines and article metadata for a given ticker symbol or topic.",
      inputSchema: {
        query: z
          .string()
          .describe("Ticker symbol (e.g. 'AAPL') or topic keyword"),
        count: z
          .number()
          .optional()
          .default(10)
          .describe("Number of news articles to return. Default: 10."),
      },
    },
    async ({ query, count }) => {
      const result = await yfGet("/v1/finance/search", {
        q: query,
        quotesCount: 0,
        newsCount: count,
        enableFuzzyQuery: false,
      });
      const raw = result as { news?: unknown[] };
      return {
        content: [
          { type: "text", text: JSON.stringify(raw?.news ?? [], null, 2) },
        ],
      };
    },
  );

  // ── Similar Tickers / Recommendations ───────────────────────────────────

  server.registerTool(
    "yf_recommendations",
    {
      description:
        "Get a list of tickers that Yahoo Finance considers similar or related to a given symbol. Useful for discovering comparable companies or ETFs.",
      inputSchema: {
        symbol: z.string().describe("Seed ticker symbol (e.g. 'AAPL')"),
      },
    },
    async ({ symbol }) => {
      const result = await yfGet(
        `/v6/finance/recommendationsbysymbol/${encodeURIComponent(symbol)}`,
      );
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    },
  );

  // ── Screener ─────────────────────────────────────────────────────────────

  server.registerTool(
    "yf_screener",
    {
      description:
        "Run a Yahoo Finance screener to find stocks matching predefined criteria. Built-in screener IDs include: day_gainers, day_losers, most_actives, undervalued_growth_stocks, growth_technology_stocks, aggressive_small_caps, small_cap_gainers.",
      inputSchema: {
        scrIds: z
          .string()
          .describe(
            "Screener ID (e.g. 'day_gainers', 'most_actives', 'undervalued_growth_stocks')",
          ),
        count: z
          .number()
          .optional()
          .default(25)
          .describe("Number of results to return. Default: 25."),
        region: z
          .string()
          .optional()
          .default("US")
          .describe("Region filter. Default: 'US'."),
        lang: z
          .string()
          .optional()
          .default("en-US")
          .describe("Language/locale. Default: 'en-US'."),
      },
    },
    async ({ scrIds, count, region, lang }) => {
      const result = await yfGet("/v1/finance/screener/predefined/saved", {
        scrIds,
        count,
        region,
        lang,
      });
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    },
  );
}
