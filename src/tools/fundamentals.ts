import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { yfGet, yfChart } from "../yf-client.js";

// All known quoteSummary v10 modules
const QUOTE_SUMMARY_MODULES = [
  "assetProfile",
  "summaryDetail",
  "financialData",
  "defaultKeyStatistics",
  "calendarEvents",
  "recommendationTrend",
  "earnings",
  "earningsHistory",
  "earningsTrend",
  "industryTrend",
  "indexTrend",
  "sectorTrend",
  "incomeStatementHistory",
  "incomeStatementHistoryQuarterly",
  "balanceSheetHistory",
  "balanceSheetHistoryQuarterly",
  "cashflowStatementHistory",
  "cashflowStatementHistoryQuarterly",
  "institutionOwnership",
  "majorHoldersBreakdown",
  "insiderHolders",
  "insiderTransactions",
  "netSharePurchaseActivity",
  "upgradeDowngradeHistory",
  "price",
  "quoteType",
  "esgScores",
  "fundProfile",
  "topHoldings",
] as const;

type QuoteSummaryModule = (typeof QUOTE_SUMMARY_MODULES)[number];

async function quoteSummary(
  symbol: string,
  modules: QuoteSummaryModule[],
): Promise<unknown> {
  return yfGet(`/v10/finance/quoteSummary/${encodeURIComponent(symbol)}`, {
    modules: modules.join(","),
  });
}

export function register(server: McpServer) {
  // ── Full Info (like yfinance Ticker.info) ────────────────────────────────

  server.registerTool(
    "yf_info",
    {
      description:
        "Get comprehensive company/fund profile and key statistics: sector, industry, description, market cap, PE ratio, EPS, dividend yield, beta, 52-week range, and more. Equivalent to yfinance Ticker.info.",
      inputSchema: {
        symbol: z.string().describe("Ticker symbol (e.g. 'AAPL')"),
      },
    },
    async ({ symbol }) => {
      const result = await quoteSummary(symbol, [
        "assetProfile",
        "summaryDetail",
        "financialData",
        "defaultKeyStatistics",
        "price",
        "quoteType",
      ]);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    },
  );

  // ── Financial Statements ─────────────────────────────────────────────────

  server.registerTool(
    "yf_financials",
    {
      description:
        "Get financial statements for a symbol: income statement, balance sheet, and cash flow — annual and/or quarterly. Equivalent to yfinance Ticker.financials.",
      inputSchema: {
        symbol: z.string().describe("Ticker symbol"),
        statements: z
          .array(
            z.enum([
              "income",
              "balance",
              "cashflow",
              "incomeQuarterly",
              "balanceQuarterly",
              "cashflowQuarterly",
            ]),
          )
          .optional()
          .default(["income", "balance", "cashflow"])
          .describe("Which statements to return. Default: all three annual."),
      },
    },
    async ({ symbol, statements }) => {
      const moduleMap: Record<string, QuoteSummaryModule> = {
        income: "incomeStatementHistory",
        balance: "balanceSheetHistory",
        cashflow: "cashflowStatementHistory",
        incomeQuarterly: "incomeStatementHistoryQuarterly",
        balanceQuarterly: "balanceSheetHistoryQuarterly",
        cashflowQuarterly: "cashflowStatementHistoryQuarterly",
      };
      const modules = (statements ?? ["income", "balance", "cashflow"]).map(
        (s) => moduleMap[s],
      );
      const result = await quoteSummary(symbol, modules);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    },
  );

  // ── Holders ──────────────────────────────────────────────────────────────

  server.registerTool(
    "yf_holders",
    {
      description:
        "Get institutional holders, insider holdings, insider transactions, and the major holders breakdown for a symbol. Equivalent to yfinance Ticker.institutional_holders / insider_holders.",
      inputSchema: {
        symbol: z.string().describe("Ticker symbol"),
      },
    },
    async ({ symbol }) => {
      const result = await quoteSummary(symbol, [
        "institutionOwnership",
        "majorHoldersBreakdown",
        "insiderHolders",
        "insiderTransactions",
        "netSharePurchaseActivity",
      ]);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    },
  );

  // ── Dividends & Splits ───────────────────────────────────────────────────

  server.registerTool(
    "yf_dividends_and_splits",
    {
      description:
        "Get the full history of dividends paid and stock splits for a symbol. Equivalent to yfinance Ticker.dividends and Ticker.splits.",
      inputSchema: {
        symbol: z.string().describe("Ticker symbol"),
        period1: z
          .string()
          .optional()
          .default("2000-01-01")
          .describe("Start date (ISO 8601). Default: '2000-01-01'."),
        period2: z
          .string()
          .optional()
          .describe("End date (ISO 8601). Defaults to today."),
      },
    },
    async ({ symbol, period1, period2 }) => {
      const p1 = Math.floor(new Date(period1 ?? "2000-01-01").getTime() / 1000);
      const p2 = period2
        ? Math.floor(new Date(period2).getTime() / 1000)
        : Math.floor(Date.now() / 1000);

      const result = await yfChart(symbol, {
        period1: p1,
        period2: p2,
        interval: "1d",
        events: "div,splits",
        includeAdjustedClose: true,
      });

      // Narrow to just the events object to keep the response concise
      const raw = result as {
        chart?: { result?: Array<{ events?: unknown }> };
      };
      const events = raw?.chart?.result?.[0]?.events ?? {};

      return {
        content: [{ type: "text", text: JSON.stringify(events, null, 2) }],
      };
    },
  );

  // ── Analyst Recommendations ──────────────────────────────────────────────

  server.registerTool(
    "yf_analyst_recommendations",
    {
      description:
        "Get analyst buy/hold/sell recommendation trends, upgrade/downgrade history, and earnings estimates. Equivalent to yfinance Ticker.recommendations.",
      inputSchema: {
        symbol: z.string().describe("Ticker symbol"),
      },
    },
    async ({ symbol }) => {
      const result = await quoteSummary(symbol, [
        "recommendationTrend",
        "upgradeDowngradeHistory",
        "earnings",
        "earningsTrend",
        "earningsHistory",
      ]);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    },
  );

  // ── ESG Scores ───────────────────────────────────────────────────────────

  server.registerTool(
    "yf_esg",
    {
      description:
        "Get ESG (Environmental, Social, Governance) sustainability scores for a symbol.",
      inputSchema: {
        symbol: z.string().describe("Ticker symbol"),
      },
    },
    async ({ symbol }) => {
      const result = await quoteSummary(symbol, ["esgScores"]);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    },
  );

  // ── Fund / ETF Top Holdings ──────────────────────────────────────────────

  server.registerTool(
    "yf_fund_holdings",
    {
      description:
        "Get the fund profile and top constituent holdings for an ETF or mutual fund (e.g. SPY, QQQ, XLE, XLP). Equivalent to yfinance Ticker.get_holdings().",
      inputSchema: {
        symbol: z.string().describe("ETF or mutual fund ticker (e.g. 'SPY')"),
      },
    },
    async ({ symbol }) => {
      const result = await quoteSummary(symbol, ["fundProfile", "topHoldings"]);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    },
  );

  // ── Raw quoteSummary (power user) ────────────────────────────────────────

  server.registerTool(
    "yf_quote_summary",
    {
      description: `Low-level quoteSummary access with full module selection. Use when other tools don't cover the needed data. Available modules: ${QUOTE_SUMMARY_MODULES.join(", ")}.`,
      inputSchema: {
        symbol: z.string().describe("Ticker symbol"),
        modules: z
          .array(z.enum(QUOTE_SUMMARY_MODULES))
          .describe("One or more quoteSummary module names to fetch"),
      },
    },
    async ({ symbol, modules }) => {
      const result = await quoteSummary(
        symbol,
        modules as QuoteSummaryModule[],
      );
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    },
  );
}
