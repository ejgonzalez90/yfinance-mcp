# CLAUDE.md — yfinance-mcp

MCP server exposing Yahoo Finance market data via the unofficial Yahoo Finance API. No credentials required. Uses **Streamable HTTP transport** on port 7576.

## Tech stack

- **Runtime:** Node.js 22+ (Docker image uses 24), TypeScript (ESM)
- **Tests:** vitest (`npm test`), Yahoo client mocked, no network
- **MCP SDK:** `@modelcontextprotocol/sdk` — `McpServer` + `StreamableHTTPServerTransport`
- **HTTP server:** Node.js built-in `node:http`
- **Validation:** `zod` v4
- **Build:** `tsc` → `dist/`; dev: `tsx watch`

## Source structure

```
src/
├── index.ts             # HTTP server, session management, request routing
├── yf-client.ts         # yfGet(path, params?) and yfChart(symbol, params?) — wraps Yahoo Finance API calls
└── tools/
    ├── market-data.ts   # yf_quote, yf_historical, yf_options, yf_trending, yf_market_summary
    ├── fundamentals.ts  # yf_info, yf_financials, yf_holders, yf_dividends_and_splits,
    │                    # yf_analyst_recommendations, yf_esg, yf_fund_holdings, yf_quote_summary
    └── search.ts        # yf_search, yf_news, yf_recommendations, yf_screener
```

Tests live in `test/` (`tools.test.ts` mocks `yf-client`; `yf-client.test.ts` stubs global `fetch`).

## Key patterns

- **Two client functions** in `yf-client.ts`:
  - `yfGet(path, params?)` — calls `https://query1.finance.yahoo.com{path}` with query params.
  - `yfChart(symbol, params?)` — calls `https://query1.finance.yahoo.com/v8/finance/chart/{symbol}`.
- **Session management:** each `initialize` request gets a fresh `McpServer` + `StreamableHTTPServerTransport` pair stored in a `sessions` Map.
- All tool handlers return `{ content: [{ type: "text", text: JSON.stringify(result, null, 2) }] }`.
- `yf_historical` accepts both explicit date ranges (`period1`/`period2` as ISO strings → converted to Unix timestamps) and Yahoo range shorthands (`1d`, `5d`, `1mo`, `3mo`, `6mo`, `1y`, `2y`, `5y`, `10y`, `ytd`, `max`).
- `yf_quote_summary` is the power-user escape hatch — it exposes all 29 `quoteSummary` v10 modules directly. Higher-level tools (`yf_info`, `yf_financials`, etc.) are convenience wrappers around it.
- `yf_dividends_and_splits` uses `yfChart` with `events=div,splits` and narrows the response to just the `events` object to keep the output concise.

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | No | Override listen port (default: `7576`) |
| `NODE_ENV` | No | Set to `production` to disable `/debug` endpoint |

## Commands

```bash
npm run build         # tsc → dist/
npm run start         # node dist/index.js
npm run dev           # tsx src/index.ts
npm run prettier:fix  # format src/**/*.ts
npm test              # vitest run (mocked, offline)
docker compose up -d --build   # build locally and run on :7576

# Docker
docker build --target runtime -t yfinance-mcp:latest .
docker build --target dev -t yfinance-mcp:dev .
docker run -i --rm -p 7576:7576 yfinance-mcp:latest
docker run -i --rm -p 7576:7576 -v "$(pwd)/src:/app/src" yfinance-mcp:dev
```

## Transport: Streamable HTTP

Listens on `http://0.0.0.0:7576/mcp`. Session lifecycle: new session on `POST /mcp` without `Mcp-Session-Id`; subsequent requests include the header. Sessions are cleaned up on close.

## Adding a new tool

1. Add to the appropriate file under `src/tools/`.
2. Register with `server.registerTool(name, { description, inputSchema }, handler)`.
3. Import and call your `register` function from `src/index.ts` inside `createMcpServer()`.
4. Add tests in `test/` and update the tool list in `README.md` and the registration test.
5. Use `yfGet()` for standard API paths or `yfChart()` for price/chart data.
