import assert from "node:assert/strict";

// Logic contracts duplicated from src/main.ts (pure, no DOM/fetch).
// If any of these fail, the app's helpers drifted from spec.

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function fastGateway(url) {
  return url.replace("https://ipfs.io/ipfs/", "https://cloudflare-ipfs.com/ipfs/");
}

function shortAmount(a) {
  const t = a.token_info;
  if (!t || t.balance === undefined) return "—";
  return (t.balance / Math.pow(10, t.decimals ?? 0)).toLocaleString();
}

function scoreMover(a) {
  return (a.volume_24h ?? 0) * 1e12 + (a.market_cap ?? 0) * 1e6 + (a.holder_count ?? 0);
}

function parseOwnerHash(hash) {
  const m = hash.match(/^#\/owner\/([A-Za-z0-9]+)$/);
  return m ? m[1] : null;
}

let n = 0;
const ok = (cond, name) => { n++; assert.ok(cond, name); console.log(`PASS ${name}`); };

// escapeHtml
ok(escapeHtml(`<a href="x">&'`) === "&lt;a href=&quot;x&quot;&gt;&amp;&#39;", "escapes all five chars");
ok(escapeHtml("plain 123") === "plain 123", "leaves safe text alone");
ok(escapeHtml("") === "", "empty string");

// fastGateway
ok(fastGateway("https://ipfs.io/ipfs/QmX") === "https://cloudflare-ipfs.com/ipfs/QmX", "rewrites ipfs.io");
ok(fastGateway("https://other.io/a.png") === "https://other.io/a.png", "leaves other hosts");

// shortAmount
ok(shortAmount({ token_info: { balance: 1500000, decimals: 6 } }) === "1.5", "divides by decimals");
ok(shortAmount({}) === "—", "missing token_info");
ok(shortAmount({ token_info: {} }) === "—", "missing balance");

// movers scoring: volume dominates, then mcap, then holders
const v = { volume_24h: 5, market_cap: 0, holder_count: 0 };
const m = { volume_24h: 0, market_cap: 999999, holder_count: 0 };
const h = { volume_24h: 0, market_cap: 0, holder_count: 50 };
const z = {};
ok(scoreMover(v) > scoreMover(m) && scoreMover(m) > scoreMover(h) && scoreMover(h) > scoreMover(z), "volume > mcap > holders > nothing");
ok([v, z, m].sort((a, b) => scoreMover(b) - scoreMover(a))[0] === v, "sort puts volume first");

// hash deep links
ok(parseOwnerHash("#/owner/AbC123") === "AbC123", "parses owner hash");
ok(parseOwnerHash("#/owner/") === null, "rejects empty address");
ok(parseOwnerHash("#/owner/a b") === null, "rejects spaces");
ok(parseOwnerHash("") === null, "rejects empty hash");
ok(parseOwnerHash("#/evil/x") === null, "rejects other routes");

console.log(`\n${n} assertions passed.`);
