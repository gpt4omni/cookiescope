# 🍪 CookieScope

Wallet + asset explorer for **Cookie Chain**, built as a cApp for the
[Cookie Chain bounty](https://superteam.fun/earn/listing/create-an-app-on-cookie-chain-app).

It queries the public Cookiescan DAS JSON-RPC API — no wallet, key, or signup
needed for lookups.

## Features

- Paste any Cookie Chain address → see all its assets (NFTs, fungibles, collections)
- One-click "latest on-chain asset" demo — the app proves live chain data on load
- Asset cards: name, symbol, mint, type, collection

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
