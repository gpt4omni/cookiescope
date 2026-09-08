const RPC = "https://api.cookiescan.io/";

interface DasAsset {
  id: string;
  interface: string;
  mutable?: boolean;
  content?: {
    metadata?: { name?: string; symbol?: string; description?: string };
    links?: { image?: string };
  };
  ownership?: { owner?: string };
  grouping?: { group_key?: string; group_value?: string }[];
  token_info?: { balance?: number; decimals?: number; price_info?: { total_price?: number; currency?: string } };
  creators?: { address?: string; share?: number; verified?: boolean }[];
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

function fmtBalance(a: DasAsset): string {
  const t = a.token_info;
  if (!t || t.balance === undefined) return "";
  const decimals = t.decimals ?? 0;
  const amount = t.balance / Math.pow(10, decimals);
  const price = t.price_info?.total_price !== undefined ? ` (≈ $${t.price_info.total_price.toFixed(2)})` : "";
  return `<br/><strong>${amount.toLocaleString()}${price}</strong>`;
}

function assetCard(a: DasAsset): string {
  const name = a.content?.metadata?.name ?? a.id;
  const symbol = a.content?.metadata?.symbol ?? "";
  const img = a.content?.links?.image;
  const collection = a.grouping?.find((g) => g.group_key === "collection")?.group_value ?? "—";
  const verified = (a.creators ?? []).some((c) => c.verified) ? " ✓" : "";
  return `<article>
    ${img ? `<img src="${escapeHtml(img)}" alt="" loading="lazy" />` : `<svg class="noimg" viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="13" fill="#f0b429"/><circle cx="12" cy="12" r="2.2" fill="#14100b"/><circle cx="20" cy="11" r="1.7" fill="#14100b"/><circle cx="17" cy="18" r="2.4" fill="#14100b"/><circle cx="11" cy="20" r="1.6" fill="#14100b"/></svg>`}
    <div><strong>${escapeHtml(name)}${verified}</strong> <code>${escapeHtml(symbol)}</code>
    ${fmtBalance(a)}<br/>
    <small class="addr">${escapeHtml(a.id)} <button data-copy="${escapeHtml(a.id)}">copy</button></small><br/>
    <small>type: ${escapeHtml(a.interface)} · collection: ${escapeHtml(collection.slice(0, 18))}…</small></div>
  </article>`;
}

function renderAssets(el: HTMLElement, items: DasAsset[], total?: number): void {
  const collections = new Map<string, number>();
  for (const a of items) {
    const c = a.grouping?.find((g) => g.group_key === "collection")?.group_value ?? "ungrouped";
    collections.set(c, (collections.get(c) ?? 0) + 1);
  }
  const chips = [...collections.entries()]
    .map(([c, n]) => `<span class="chip">${escapeHtml(c.slice(0, 12))}… ×${n}</span>`)
    .join("");
  el.innerHTML = (total !== undefined ? `<p class="total">${total} asset(s)</p>` : "") +
    (chips ? `<div class="chips">${chips}</div>` : "") +
    (items.map(assetCard).join("") || "<p>No assets found.</p>");
  el.querySelectorAll("[data-copy]").forEach((b) =>
    b.addEventListener("click", () => navigator.clipboard?.writeText((b as HTMLElement).dataset.copy!)),
  );
}

async function showOwner(owner: string): Promise<void> {
  setStatus(`Loading assets for ${owner}…`);
  const data = await rpc<{ items: DasAsset[]; total: number }>("getAssetsByOwner", {
    ownerAddress: owner,
    page: 1,
    limit: 50,
    options: { showFungible: true, showCollectionMetadata: true },
  });
  setStatus(`Done — live from Cookie Chain.`);
  renderAssets(resultsEl, data.items, data.total);
}

async function showActivity(): Promise<void> {
  setStatus("Loading latest on-chain activity…");
  const data = await rpc<{ items: DasAsset[] }>("searchAssets", {
    page: 1,
    limit: 20,
    sortBy: { sortBy: "recent_action", sortDirection: "desc" },
    options: { showCollectionMetadata: true },
  });
  setStatus("Latest activity on Cookie Chain:");
  renderAssets(resultsEl, data.items);
}

async function search(query: string): Promise<void> {
  setStatus(`Searching for “${query}”…`);
  const data = await rpc<{ items: DasAsset[] }>("searchAssets", {
    page: 1,
    limit: 20,
    creatorAddress: query.length >= 32 && query.length <= 44 ? query : undefined,
    options: { showCollectionMetadata: true },
  });
  const items = data.items.filter((a) =>
    (a.content?.metadata?.name ?? "").toLowerCase().includes(query.toLowerCase()) ||
    a.id.toLowerCase().includes(query.toLowerCase()),
  );
  setStatus(`${items.length} match(es).`);
  renderAssets(resultsEl, items);
}

async function connectWallet(): Promise<void> {
  const provider = (window as unknown as { solana?: { isPhantom?: boolean; connect(): Promise<{ publicKey: { toString(): string } }> } }).solana;
  if (!provider) {
    setStatus("No Solana wallet detected — install Phantom, or paste an address above.");
    return;
  }
  setStatus("Waiting for wallet approval…");
  const { publicKey } = await provider.connect();
  const addr = publicKey.toString();
  (document.getElementById("addr") as HTMLInputElement).value = addr;
  await showOwner(addr);
}

function setStatus(msg: string): void {
  statusEl.textContent = msg;
}

const statusEl = document.getElementById("status") as HTMLElement;
const resultsEl = document.getElementById("results") as HTMLElement;
const addrInput = document.getElementById("addr") as HTMLInputElement;

document.getElementById("lookup")!.addEventListener("submit", (e) => {
  e.preventDefault();
  const v = addrInput.value.trim();
  if (!v) {
    setStatus("Paste an address first.");
    return;
  }
  showOwner(v).catch((err: unknown) => setStatus(`Error: ${err instanceof Error ? err.message : String(err)}`));
});
document.getElementById("connect")!.addEventListener("click", () => {
  connectWallet().catch((err: unknown) => setStatus(`Wallet error: ${err instanceof Error ? err.message : String(err)}`));
});
document.getElementById("activity")!.addEventListener("click", () => {
  showActivity().catch((err: unknown) => setStatus(`Error: ${err instanceof Error ? err.message : String(err)}`));
});
document.getElementById("searchbtn")!.addEventListener("click", () => {
  const v = (document.getElementById("q") as HTMLInputElement).value.trim();
  if (v) search(v).catch((err: unknown) => setStatus(`Error: ${err instanceof Error ? err.message : String(err)}`));
});

// Auto-load live chain activity so the app proves itself immediately.
showActivity().catch((err: unknown) => setStatus(`Error: ${err instanceof Error ? err.message : String(err)}`));
