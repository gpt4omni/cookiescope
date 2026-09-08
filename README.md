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
- Connect with Nightly (required), Phantom, or Solflare; live balance + address badge
- Send real SOL transfers on Cookie Chain with build → sign → broadcast → confirm feedback
- Live chain slot indicator; fast IPFS gateway images with origin fallback
- Click any asset for a full dossier: attributes, creators, royalty, files, provenance
- Click a collection chip to drill into its members
- Gallery mode, portfolio totals, shareable `#/owner/…` deep links, ⌘K quick jump
- Market movers ranked by real 24h volume, 24h change badges, market caps, holder counts
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
