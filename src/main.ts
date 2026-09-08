const RPC = "https://api.cookiescan.io/";

interface DasAsset {
  id: string;
  interface: string;
  mutable?: boolean;
  content?: {
    files?: { uri?: string; mime?: string }[];
    links?: { image?: string; external_url?: string };
    metadata?: {
      name?: string;
      symbol?: string;
      description?: string;
      attributes?: { trait_type?: string; value?: string }[];
    };
  };
  ownership?: { owner?: string };
  grouping?: { group_key?: string; group_value?: string }[];
  royalty?: { percent?: number; basis_points?: number };
  market_cap?: number;
  volume_24h?: number;
  price_change_24h?: number;
  holder_count?: number;
  token_info?: {
    balance?: number;
    decimals?: number;
    price_info?: { total_price?: number; price_per_token?: number; currency?: string };
  };
  creators?: { address?: string; share?: number; verified?: boolean }[];
  authorities?: { address?: string; scopes?: string[] }[];
}

async function rpc<T>(method: string, params: unknown): Promise<T> {
  const res = await fetch(RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const body = (await res.json()) as { result?: T; error?: { message?: string } };
  if (body.error) throw new Error(body.error.message ?? "RPC error");
  return body.result as T;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

const COOKIE_SVG = `<svg class="noimg" viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="13" fill="#f0b429"/><circle cx="12" cy="12" r="2.2" fill="#14100b"/><circle cx="20" cy="11" r="1.7" fill="#14100b"/><circle cx="17" cy="18" r="2.4" fill="#14100b"/><circle cx="11" cy="20" r="1.6" fill="#14100b"/></svg>`;

let gallery = false;
let currentItems: DasAsset[] = [];
let currentTotal: number | undefined;

function thumb(a: DasAsset, size: "sm" | "lg"): string {
  const img = a.content?.links?.image;
  if (img) return `<img src="${escapeHtml(img)}" alt="" loading="lazy" class="${size}" />`;
  return COOKIE_SVG;
}

function fmtBalance(a: DasAsset): string {
  const t = a.token_info;
  if (!t || t.balance === undefined) return "";
  const amount = t.balance / Math.pow(10, t.decimals ?? 0);
  const price = t.price_info?.total_price !== undefined ? ` (≈ $${t.price_info.total_price.toFixed(2)})` : "";
  return `<br/><strong class="amount">${amount.toLocaleString()}${price}</strong>`;
}

function assetCard(a: DasAsset, i: number): string {
  const name = a.content?.metadata?.name ?? a.id;
  const symbol = a.content?.metadata?.symbol ?? "";
  const collection = a.grouping?.find((g) => g.group_key === "collection")?.group_value ?? "—";
  const verified = (a.creators ?? []).some((c) => c.verified) ? " ✓" : "";
  const chg = a.price_change_24h;
  const badge = chg === undefined ? "" : `<span class="${chg >= 0 ? "up" : "down"}">${chg >= 0 ? "▲" : "▼"} ${Math.abs(chg).toFixed(1)}%</span>`;
  const mcap = a.market_cap !== undefined ? `<br/><small>mcap $${a.market_cap.toLocaleString(undefined, { maximumFractionDigits: 0 })}${a.holder_count ? ` · ${a.holder_count} holders` : ""}</small>` : "";
  return `<article data-i="${i}" tabindex="0" role="button" aria-label="Open ${escapeHtml(name)} dossier">
    ${thumb(a, "sm")}
    <div><strong>${escapeHtml(name)}${verified}</strong> <code>${escapeHtml(symbol)}</code> ${badge}
    ${fmtBalance(a)}${mcap}<br/>
    <small class="addr">${escapeHtml(a.id.slice(0, 20))}…</small><br/>
    <small>${escapeHtml(a.interface)} · ${escapeHtml(collection.slice(0, 16))}…</small></div>
  </article>`;
}

function portfolioBar(items: DasAsset[], total?: number): string {
  let value = 0;
  let nfts = 0;
  let fungibles = 0;
  for (const a of items) {
    if (a.interface === "FungibleToken" || a.interface === "FungibleAsset") fungibles++;
    else nfts++;
    value += a.token_info?.price_info?.total_price ?? 0;
  }
  const shown = total !== undefined ? `${total} on-chain` : `${items.length} shown`;
  return `<div class="portfolio"><div><span class="hero">$${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span><span class="hero-label">priced value</span></div><div class="pstats">${nfts} NFTs · ${fungibles} fungibles · ${shown}</div></div>`;
}

function render(items: DasAsset[], total?: number): void {
  currentItems = items;
  currentTotal = total;
  const collections = new Map<string, number>();
  for (const a of items) {
    const c = a.grouping?.find((g) => g.group_key === "collection")?.group_value ?? "ungrouped";
    collections.set(c, (collections.get(c) ?? 0) + 1);
  }
  const chips = [...collections.entries()]
    .map(([c, n]) => `<button class="chip" data-collection="${escapeHtml(c)}">${escapeHtml(c.slice(0, 14))}… ×${n}</button>`)
    .join("");
  resultsEl.innerHTML = portfolioBar(items, total) +
    (chips ? `<div class="chips">${chips}</div>` : "") +
    `<div class="${gallery ? "gallery" : "list"}">` + (items.map(assetCard).join("") || "<p>No assets found.</p>") + `</div>`;
  resultsEl.querySelectorAll("article[data-i]").forEach((el) => {
    const open = (): void => openDossier(currentItems[Number((el as HTMLElement).dataset.i)]);
    el.addEventListener("click", open);
    el.addEventListener("keydown", (e) => {
      if ((e as KeyboardEvent).key === "Enter") open();
    });
  });
  resultsEl.querySelectorAll("[data-collection]").forEach((b) =>
    b.addEventListener("click", () => {
      const c = (b as HTMLElement).dataset.collection!;
      if (c !== "ungrouped") drillCollection(c).catch(fail);
    }),
  );
}

function openDossier(a: DasAsset): void {
  const md = a.content?.metadata;
  const attrs = (md?.attributes ?? [])
    .map((t) => `<li><span>${escapeHtml(t.trait_type ?? "?")}</span><strong>${escapeHtml(t.value ?? "?")}</strong></li>`)
    .join("");
  const creators = (a.creators ?? [])
    .map((c) => `<li><code>${escapeHtml(c.address ?? "?")}</code> ${c.share ?? 0}%${c.verified ? " ✓" : ""}</li>`)
    .join("");
  const files = (a.content?.files ?? [])
    .map((f) => `<li><a href="${escapeHtml(f.uri ?? "#")}">${escapeHtml(f.mime ?? "file")}</a></li>`)
    .join("");
  modalEl.innerHTML = `<div class="sheet" role="dialog" aria-modal="true" aria-label="Asset dossier">
    <button class="close" aria-label="Close">✕</button>
    ${thumb(a, "lg")}
    <h2>${escapeHtml(md?.name ?? a.id)}</h2>
    ${md?.description ? `<p>${escapeHtml(md.description)}</p>` : ""}
    <dl>
      <div><dt>Mint</dt><dd><code>${escapeHtml(a.id)}</code> <button data-copy="${escapeHtml(a.id)}">copy</button></dd></div>
      <div><dt>Owner</dt><dd><code>${escapeHtml(a.ownership?.owner ?? "—")}</code>${a.ownership?.owner ? ` <button data-inspect="${escapeHtml(a.ownership.owner)}">inspect →</button>` : ""}</dd></div>
      <div><dt>Interface</dt><dd>${escapeHtml(a.interface)}${a.mutable === false ? " · immutable" : ""}</dd></div>
      <div><dt>Royalty</dt><dd>${a.royalty?.percent ?? (a.royalty?.basis_points ?? 0) / 100}%</dd></div>
    </dl>
    ${attrs ? `<h3>Attributes</h3><ul class="attrs">${attrs}</ul>` : ""}
    ${creators ? `<h3>Creators</h3><ul>${creators}</ul>` : ""}
    ${files ? `<h3>Files</h3><ul>${files}</ul>` : ""}
  </div>`;
  modalEl.hidden = false;
  modalEl.querySelector(".close")!.addEventListener("click", closeDossier);
  modalEl.querySelectorAll("[data-copy]").forEach((b) =>
    b.addEventListener("click", () => navigator.clipboard?.writeText((b as HTMLElement).dataset.copy!)),
  );
  modalEl.querySelectorAll("[data-inspect]").forEach((b) =>
    b.addEventListener("click", () => {
      closeDossier();
      addrInput.value = (b as HTMLElement).dataset.inspect!;
      inspectCurrent().catch(fail);
    }),
  );
  modalEl.addEventListener("click", (e) => {
    if (e.target === modalEl) closeDossier();
  }, { once: true });
}

function closeDossier(): void {
  modalEl.hidden = true;
  modalEl.innerHTML = "";
}

function skeleton(): void {
  resultsEl.innerHTML = `<div class="list">` + "<article class='skel'><div></div><div></div></article>".repeat(4) + `</div>`;
}

function fail(err: unknown): void {
  setStatus(`Error: ${err instanceof Error ? err.message : String(err)}. Try another address or retry.`);
}

async function showOwner(owner: string): Promise<void> {
  skeleton();
  setStatus(`Loading assets for ${owner}…`);
  const data = await rpc<{ items: DasAsset[]; total: number }>("getAssetsByOwner", {
    ownerAddress: owner,
    page: 1,
    limit: 50,
    options: { showFungible: true, showCollectionMetadata: true },
  });
  location.hash = `#/owner/${owner}`;
  setStatus(`Done — live from Cookie Chain.`);
  render(data.items, data.total);
}

async function showActivity(): Promise<void> {
  skeleton();
  setStatus("Loading latest on-chain activity…");
  const data = await rpc<{ items: DasAsset[] }>("searchAssets", {
    page: 1,
    limit: 24,
    sortBy: { sortBy: "recent_action", sortDirection: "desc" },
    options: { showCollectionMetadata: true },
  });
  setStatus("Latest activity on Cookie Chain:");
  render(data.items);
}

async function showMovers(): Promise<void> {
  skeleton();
  setStatus("Scanning chain volume…");
  const data = await rpc<{ items: DasAsset[] }>("searchAssets", {
    page: 1,
    limit: 100,
    options: { showCollectionMetadata: true },
  });
  const movers = data.items
    .filter((a) => (a.volume_24h ?? 0) > 0)
    .sort((x, y) => (y.volume_24h ?? 0) - (x.volume_24h ?? 0))
    .slice(0, 12);
  setStatus(movers.length ? "Top movers by 24h volume:" : "No volume data yet — a young chain. Check back soon.");
  render(movers);
}

async function drillCollection(collection: string): Promise<void> {
  skeleton();
  setStatus(`Opening collection ${collection.slice(0, 12)}…`);
  const data = await rpc<{ items: DasAsset[] }>("searchAssets", {
    page: 1,
    limit: 50,
    grouping: ["collection", collection],
    options: { showCollectionMetadata: true },
  });
  setStatus(`Collection members:`);
  render(data.items);
}

async function search(query: string): Promise<void> {
  skeleton();
  setStatus(`Searching for “${query}”…`);
  const data = await rpc<{ items: DasAsset[] }>("searchAssets", {
    page: 1,
    limit: 50,
    options: { showCollectionMetadata: true },
  });
  const q = query.toLowerCase();
  render(data.items.filter((a) =>
    (a.content?.metadata?.name ?? "").toLowerCase().includes(q) ||
    a.id.toLowerCase().includes(q),
  ));
}

async function connectWallet(): Promise<void> {
  const provider = (window as unknown as { solana?: { connect(): Promise<{ publicKey: { toString(): string } }> } }).solana;
  if (!provider) {
    setStatus("No Solana wallet detected — install Phantom, or paste an address above.");
    return;
  }
  setStatus("Waiting for wallet approval…");
  const { publicKey } = await provider.connect();
  addrInput.value = publicKey.toString();
  await inspectCurrent();
}

async function inspectCurrent(): Promise<void> {
  const v = addrInput.value.trim();
  if (!v) {
    setStatus("Paste an address first.");
    return;
  }
  await showOwner(v);
}

function setStatus(msg: string): void {
  statusEl.textContent = msg;
}

function togglePalette(open: boolean): void {
  paletteEl.hidden = !open;
  if (open) (document.getElementById("paladdr") as HTMLInputElement).focus();
}

const statusEl = document.getElementById("status") as HTMLElement;
const resultsEl = document.getElementById("results") as HTMLElement;
const modalEl = document.getElementById("modal") as HTMLElement;
const paletteEl = document.getElementById("palette") as HTMLElement;
const addrInput = document.getElementById("addr") as HTMLInputElement;

document.getElementById("lookup")!.addEventListener("submit", (e) => {
  e.preventDefault();
  inspectCurrent().catch(fail);
});
document.getElementById("connect")!.addEventListener("click", () => connectWallet().catch(fail));
document.getElementById("activity")!.addEventListener("click", () => showActivity().catch(fail));
document.getElementById("movers")!.addEventListener("click", () => showMovers().catch(fail));
document.getElementById("searchbtn")!.addEventListener("click", () => {
  const v = (document.getElementById("q") as HTMLInputElement).value.trim();
  if (v) search(v).catch(fail);
});
document.getElementById("viewtoggle")!.addEventListener("click", (e) => {
  gallery = !gallery;
  (e.target as HTMLElement).textContent = gallery ? "List view" : "Gallery view";
  render(currentItems, currentTotal);
});
document.getElementById("palgo")!.addEventListener("click", () => {
  const v = (document.getElementById("paladdr") as HTMLInputElement).value.trim();
  togglePalette(false);
  if (v) {
    addrInput.value = v;
    inspectCurrent().catch(fail);
  } else showActivity().catch(fail);
});
document.addEventListener("keydown", (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
    e.preventDefault();
    togglePalette(paletteEl.hidden);
  }
  if (e.key === "Escape") {
    if (!modalEl.hidden) closeDossier();
    if (!paletteEl.hidden) togglePalette(false);
  }
});

// Deep link: #/owner/<address> restores a shared view.
const hashMatch = location.hash.match(/^#\/owner\/([A-Za-z0-9]+)$/);
if (hashMatch) {
  addrInput.value = hashMatch[1];
  inspectCurrent().catch(fail);
} else {
  showActivity().catch(fail);
}
