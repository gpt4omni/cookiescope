# 🍪 CookieScope

Wallet + asset explorer for **Cookie Chain**, built as a cApp for the
[Cookie Chain bounty](https://superteam.fun/earn/listing/create-an-app-on-cookie-chain-app).

It queries the public Cookiescan DAS JSON-RPC API — no wallet, key, or signup
needed for lookups.

## Features

- Paste any Cookie Chain address → see all its assets with balances, prices, collections
- **Connect wallet** (Phantom/Solflare) → one click to inspect your own holdings
- **Latest activity** feed — live chain data on load, newest assets first
- Search/filter by name, mint, or creator; collection chips with counts
- Copy-mint buttons, verified-creator badges, responsive + keyboard-friendly

## Run it

```sh
npm install
npm run dev      # local dev
npm run build    # production build in dist/
```

## Deploy (Vercel, free)

```sh
npm i -g vercel
vercel --prod
```

## Stack

Vite + TypeScript, zero runtime dependencies. Data: `https://api.cookiescan.io/` (Metaplex DAS).
