const RPC = "https://api.cookiescan.io/";

interface DasAsset {
  id: string;
  interface: string;
  content?: { metadata?: { name?: string; symbol?: string }; links?: { image?: string } };
  ownership?: { owner?: string };
  grouping?: { group_key?: string; group_value?: string }[];
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

function assetCard(a: DasAsset): string {
  const name = a.content?.metadata?.name ?? a.id;
  const symbol = a.content?.metadata?.symbol ?? "";
  const img = a.content?.links?.image;
  const collection = a.grouping?.find((g) => g.group_key === "collection")?.group_value ?? "—";
  return `<article>
    ${img ? `<img src="${img}" alt="" loading="lazy" width="96" />` : ""}
    <div><strong>${escapeHtml(name)}</strong> <code>${escapeHtml(symbol)}</code><br/>
    <small>${escapeHtml(a.id)}</small><br/>
    <small>type: ${escapeHtml(a.interface)} · collection: ${escapeHtml(collection)}</small></div>
  </article>`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

async function showOwner(owner: string, statusEl: HTMLElement, results: HTMLElement): Promise<void> {
  statusEl.textContent = `Loading assets for ${owner}…`;
  results.innerHTML = "";
  const data = await rpc<{ items: DasAsset[]; total: number }>("getAssetsByOwner", {
    ownerAddress: owner,
    page: 1,
    limit: 20,
  });
  statusEl.textContent = `${data.total} asset(s) found.`;
  results.innerHTML = data.items.map(assetCard).join("") || "<p>No assets.</p>";
}

async function showLatest(statusEl: HTMLElement, results: HTMLElement): Promise<void> {
  statusEl.textContent = "Loading latest on-chain asset…";
  const data = await rpc<{ items: DasAsset[] }>("searchAssets", { page: 1, limit: 1, sortBy: { sortBy: "recent_action", sortDirection: "desc" } });
  const first = data.items[0];
  if (!first) {
    statusEl.textContent = "Chain returned no assets.";
    return;
  }
  const owner = first.ownership?.owner;
  if (owner) {
    (document.getElementById("addr") as HTMLInputElement).value = owner;
    await showOwner(owner, statusEl, results);
  } else {
    statusEl.textContent = "Latest asset:";
    results.innerHTML = assetCard(first);
  }
}

const form = document.getElementById("lookup") as HTMLFormElement;
const addr = document.getElementById("addr") as HTMLInputElement;
const statusEl = document.getElementById("statusEl") as HTMLElement;
const results = document.getElementById("results") as HTMLElement;

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const v = addr.value.trim();
  if (!v) {
    statusEl.textContent = "Paste an address first.";
    return;
  }
  showOwner(v, statusEl, results).catch((err: unknown) => {
    statusEl.textContent = `Error: ${err instanceof Error ? err.message : String(err)}`;
  });
});

document.getElementById("sample")!.addEventListener("click", () => {
  showLatest(statusEl, results).catch((err: unknown) => {
    statusEl.textContent = `Error: ${err instanceof Error ? err.message : String(err)}`;
  });
});

// Auto-load live data on start so the app proves itself immediately.
showLatest(statusEl, results).catch((err: unknown) => {
  statusEl.textContent = `Error: ${err instanceof Error ? err.message : String(err)}`;
});
