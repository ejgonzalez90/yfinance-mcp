# yfinance-mcp

A [Model Context Protocol](https://modelcontextprotocol.io) (MCP) server that gives AI agents access to Yahoo Finance market data: real-time quotes, price history, options chains, company fundamentals, financial statements, analyst recommendations, ESG scores, news and predefined stock screeners. No API key is required.

It is read-only: the server only fetches public market data and has no trading or account functionality.

> **Disclaimer.** This project is unofficial and is not affiliated with, endorsed by, or sponsored by Yahoo or Yahoo Finance. It calls Yahoo's unofficial, undocumented web endpoints, which can change or stop working at any time. Data is provided for informational purposes only and is not investment advice. Your use of Yahoo Finance data is subject to Yahoo's terms of service; you are responsible for complying with them.

## How it works

- **Transport:** Streamable HTTP, listening on `http://0.0.0.0:7576/mcp` (override the port with `PORT`).
- **Yahoo access:** a small built-in client (`src/yf-client.ts`) obtains the cookie and crumb Yahoo requires, attaches them to requests, and refreshes them once if Yahoo rejects them.
- **Sessions:** every MCP `initialize` request gets its own server and transport, so clients can reconnect freely.
- **Output:** tools return Yahoo's JSON, pretty-printed as text. A few tools trim the payload (`yf_news` returns only the news array, `yf_dividends_and_splits` only the `events` object).
- Several tools accept a region code (for example `AR`, `BR`, `GB`), so Yahoo's non-US markets can be queried. The server adds no special handling beyond passing the code through.

There is no authentication on the HTTP endpoint. Run it on localhost or a trusted network, not exposed to the internet.

## Quick start

### Docker (prebuilt image)

```bash
docker run -d --name yfinance-mcp --restart unless-stopped -p 7576:7576 ghcr.io/ejgonzalez90/yfinance-mcp:latest
```

To keep it reachable only from your machine, publish the port as `127.0.0.1:7576:7576`.

### Docker Compose (build locally)

```bash
git clone https://github.com/ejgonzalez90/yfinance-mcp.git
cd yfinance-mcp
docker compose up -d --build
```

The container restarts automatically (`unless-stopped`) and serves on port 7576. No environment file is needed.

### Node.js

Requires Node.js 22 or newer (the Docker image uses Node 24).

```bash
npm ci
npm run dev                  # run from source with tsx
# or
npm run build && npm start   # compiled
```

## Connect a client

### Claude Code

```bash
claude mcp add --transport http yfinance-mcp http://localhost:7576/mcp
```

### Other MCP clients

Any client that supports Streamable HTTP can use the endpoint URL. For clients configured through JSON, an entry like this is typical (the exact key names vary by client):

```json
{
  "mcpServers": {
    "yfinance-mcp": {
      "type": "http",
      "url": "http://localhost:7576/mcp"
    }
  }
}
```

## Tools

17 tools, all prefixed `yf_`.

### Market data

| Tool | Description |
|------|-------------|
| `yf_quote` | Real-time quote data for one or more tickers: price, change %, volume, market cap, PE ratio, 52-week range, bid/ask |
| `yf_historical` | Historical OHLCV data. `period1` is either an ISO date or a range shorthand (`1d`, `5d`, `1mo`, `3mo`, `6mo`, `1y`, `2y`, `5y`, `10y`, `ytd`, `max`); intervals from `1m` to `3mo`; optional pre/post-market data |
| `yf_options` | Options chain (calls and puts). Without `expirationDate`, returns the available expirations |
| `yf_trending` | Currently trending tickers for a region (default `US`) |
| `yf_market_summary` | Snapshot of major market indices and benchmarks for a region |

### Fundamentals

| Tool | Description |
|------|-------------|
| `yf_info` | Company or fund profile and key statistics: sector, industry, market cap, PE, EPS, dividend yield, beta, 52-week range |
| `yf_financials` | Income statement, balance sheet and cash flow, annual and/or quarterly |
| `yf_holders` | Institutional holders, insider holders and transactions, major holders breakdown, net share purchase activity |
| `yf_dividends_and_splits` | Dividend and stock split history (defaults to since 2000-01-01) |
| `yf_analyst_recommendations` | Analyst buy/hold/sell trends, upgrade/downgrade history, earnings estimates and history |
| `yf_esg` | ESG sustainability scores |
| `yf_fund_holdings` | Fund profile and top holdings for ETFs and mutual funds |
| `yf_quote_summary` | Low-level access to any of the Yahoo `quoteSummary` v10 modules (29 modules, e.g. `assetProfile`, `earningsTrend`, `topHoldings`) |

### Search and discovery

| Tool | Description |
|------|-------------|
| `yf_search` | Search symbols, ETFs, funds, indices or crypto by name or keyword; also returns related news |
| `yf_news` | Latest news for a ticker or topic |
| `yf_recommendations` | Tickers Yahoo considers similar to a given symbol |
| `yf_screener` | Run a predefined Yahoo screener, e.g. `day_gainers`, `day_losers`, `most_actives`, `undervalued_growth_stocks`, `growth_technology_stocks`, `aggressive_small_caps`, `small_cap_gainers` |

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `7576` | Listen port |
| `NODE_ENV` | unset | Anything other than `production` enables `GET /debug`, which returns uptime and the active session count. The Docker image sets `production`. |

## Development

```bash
npm ci
npm run dev           # tsx, run from source
npm run build         # tsc -> dist/
npm test              # vitest; the Yahoo client is mocked, no network needed
npm run prettier:fix  # format src/
```

Docker targets: `dev` (mount `src/` and hot-reload with `tsx watch`), `builder`, and `runtime` (production image).

```bash
docker build --target runtime -t yfinance-mcp:latest .
docker build --target dev -t yfinance-mcp:dev .
docker run --rm -p 7576:7576 -v "$(pwd)/src:/app/src" yfinance-mcp:dev
```

Tool implementations live in `src/tools/`; see [CLAUDE.md](CLAUDE.md) for the code layout and how to add a tool.

## License

[MIT](LICENSE)
