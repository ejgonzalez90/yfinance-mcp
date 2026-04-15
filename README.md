# yfinance-mcp

MCP server exposing Yahoo Finance market data — no API key required. Provides 17 tools for real-time quotes, historical prices, options chains, company fundamentals, financial statements, analyst recommendations, ESG scores, news, and stock screeners.

**Transport:** Streamable HTTP — listens on `http://0.0.0.0:7576/mcp`.

## Quick start

### Build and run

```bash
# Production
docker build --target runtime -t yfinance-mcp:latest .
docker run -i --rm -p 7576:7576 yfinance-mcp:latest

# Development (hot reload)
docker build --target dev -t yfinance-mcp:dev .
docker run -i --rm -p 7576:7576 -v "$(pwd)/src:/app/src" yfinance-mcp:dev
```

Or via VS Code tasks: **yfinance-mcp: Run: production** / **yfinance-mcp: Dev: hot reload**.

### Connect from an MCP client

Point the client at `http://localhost:7576/mcp`.

No credentials needed — Yahoo Finance data is publicly accessible.

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | No | Override listen port (default: `7576`) |
| `NODE_ENV` | No | Set to `production` to disable the `/debug` endpoint |

## Debug endpoint

In development, `GET http://localhost:7576/debug` returns server health and active session count.

## Tools

### Market data
| Tool | Description |
|------|-------------|
| `yf_quote` | Real-time quote(s): price, change %, volume, market cap, PE, bid/ask, 52-week range |
| `yf_historical` | Historical OHLCV data — supports range shorthands (`1d`, `1mo`, `1y`, `max`) and explicit date ranges |
| `yf_options` | Options chain (calls & puts) for a symbol; omit expiry to list available dates |
| `yf_trending` | Currently trending tickers for a region (default: US) |
| `yf_market_summary` | Snapshot of major indices (S&P 500, Nasdaq, Dow, etc.) |

### Fundamentals
| Tool | Description |
|------|-------------|
| `yf_info` | Full company/fund profile: sector, industry, description, market cap, PE, EPS, beta, dividend yield |
| `yf_financials` | Financial statements — income, balance sheet, cash flow (annual and/or quarterly) |
| `yf_holders` | Institutional holders, insider holdings, insider transactions, major holders breakdown |
| `yf_dividends_and_splits` | Full dividend and stock split history |
| `yf_analyst_recommendations` | Analyst buy/hold/sell trends, upgrade/downgrade history, earnings estimates |
| `yf_esg` | ESG (Environmental, Social, Governance) sustainability scores |
| `yf_fund_holdings` | Fund profile and top holdings for ETFs / mutual funds (e.g. SPY, QQQ) |
| `yf_quote_summary` | Low-level access to any `quoteSummary` v10 module |

### Search & discovery
| Tool | Description |
|------|-------------|
| `yf_search` | Search for symbols, ETFs, indices, or crypto by name or keyword |
| `yf_news` | Latest news headlines for a ticker or topic |
| `yf_recommendations` | Similar/related tickers suggested by Yahoo Finance |
| `yf_screener` | Run predefined screeners: `day_gainers`, `day_losers`, `most_actives`, `undervalued_growth_stocks`, etc. |
