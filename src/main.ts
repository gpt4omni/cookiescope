import "@fontsource/space-grotesk/700.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/600.css";
import { Buffer } from "buffer";
import { LAMPORTS_PER_SOL, PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import {
  chainConnectionForWrites,
  getAssetsByOwner,
  getChainStats,
  searchAssets,
  type DasAsset,
} from "./api";
import {
  armImageFallbacks,
  closeDossier,
  escapeHtml,
  openDossier,
  thumb,
} from "./dossier";

(window as unknown as { Buffer?: typeof Buffer }).Buffer ??= Buffer;

const connection = chainConnectionForWrites();

let gallery = false;
let currentItems: DasAsset[] = [];
let currentTotal: number | undefined;

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

function isFungible(a: DasAsset): boolean {
  return a.interface === "FungibleToken" || a.interface === "FungibleAsset";
}

function shortAmount(a: DasAsset): string {
  const t = a.token_info;
  if (!t || t.balance === undefined) return "—";
  return (t.balance / Math.pow(10, t.decimals ?? 0)).toLocaleString();
}

function changeBadge(a: DasAsset): string {
  const chg = a.price_change_24h;
  if (chg === undefined) return "—";
  return `<span class="${chg >= 0 ? "up" : "down"}">${chg >= 0 ? "▲" : "▼"} ${Math.abs(chg).toFixed(1)}%</span>`;
}

function mcapCell(a: DasAsset): string {
  if (a.market_cap === undefined) return "—";
  return `$${a.market_cap.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function portfolioLine(items: DasAsset[], total?: number): string {
  let value = 0;
  let nfts = 0;
  for (const a of items) {
    if (isFungible(a)) continue;
    nfts++;
    value += a.token_info?.price_info?.total_price ?? 0;
  }
  const shown = total !== undefined ? `${total} on-chain` : `${items.length} shown`;
  return `<p class="statline"><span class="hero">$${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span> priced · ${nfts} NFTs · ${items.length - nfts} fungibles · ${shown}</p>`;
}

function assetRow(a: DasAsset, i: number): string {
  const name = a.content?.metadata?.name ?? a.id;
  const symbol = a.content?.metadata?.symbol ?? "";
  const verified = (a.creators ?? []).some((c) => c.verified) ? " ✓" : "";
  return `<tr data-i="${i}" tabindex="0">
    <td><span class="cellasset">${thumb(a, "sm")}<span><strong>${escapeHtml(name)}${verified}</strong> <code>${escapeHtml(symbol)}</code></span></span></td>
    <td>${isFungible(a) ? "FT" : "NFT"}</td>
    <td class="num">${shortAmount(a)}</td>
    <td class="num">${changeBadge(a)}</td>
    <td class="num">${mcapCell(a)}</td>
  </tr>`;
}

function render(items: DasAsset[], total?: number): void {
  currentItems = items;
  currentTotal = total;
  const collections = new Map<string, number>();
  for (const a of items) {
    const c = a.grouping?.find((g) => g.group_key === "collection")?.group_value ?? "ungrouped";
    collections.set(c, (collections.get(c) ?? 0) + 1);
  }
  const realCollections = [...collections.entries()].filter(([c]) => c !== "ungrouped");
  const filter = realCollections.length
    ? `<label class="collfilter">Collection <select id="collsel"><option value="">All (${items.length})</option>` +
      realCollections.map(([c, n]) => `<option value="${escapeHtml(c)}">${escapeHtml(c.slice(0, 20))} (${n})</option>`).join("") +
      `</select></label>`
    : "";
  const body = gallery
    ? `<div class="gallery">` + (items.map(assetCard).join("") || "<p>No assets found.</p>") + `</div>`
    : `<div class="tablewrap"><table><thead><tr><th>Asset</th><th>Type</th><th class="num">Balance</th><th class="num">24h</th><th class="num">Mcap</th></tr></thead>` +
      `<tbody>` + (items.map(assetRow).join("") || `<tr><td colspan="5">No assets found.</td></tr>`) + `</tbody></table></div>`;
  resultsEl.innerHTML = portfolioLine(items, total) + filter + body;
  const sel = document.getElementById("collsel") as HTMLSelectElement | null;
  sel?.addEventListener("change", () => {
    if (sel.value) drillCollection(sel.value).catch(fail);
  });
  resultsEl.querySelectorAll("[data-i]").forEach((el) => {
    const open = (): void => openDossier(currentItems[Number((el as HTMLElement).dataset.i)], {
      onInspect: (owner: string) => {
        addrInput.value = owner;
        inspectCurrent().catch(fail);
      },
    });
    el.addEventListener("click", open);
    el.addEventListener("keydown", (e) => {
      if ((e as KeyboardEvent).key === "Enter") open();
    });
  });
}

function skeleton(): void {
  resultsEl.innerHTML = `<div class="skel"></div>`.repeat(3);
}

function fail(err: unknown): void {
  setStatus(`Error: ${err instanceof Error ? err.message : String(err)}. Try another address or retry.`);
}

async function showOwner(owner: string): Promise<void> {
  skeleton();
  setStatus(`Loading assets for ${owner}…`);
  const data = await getAssetsByOwner(owner);
  location.hash = `#/owner/${owner}`;
  setStatus(`Done — live from Cookie Chain.`);
  render(data.items, data.total);
}

async function showActivity(): Promise<void> {
  skeleton();
  setStatus("Loading latest on-chain activity…");
  const data = await searchAssets({
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
  const data = await searchAssets({
    page: 1,
    limit: 100,
    options: { showCollectionMetadata: true },
  });
  const scored = (a: DasAsset): number =>
    (a.volume_24h ?? 0) * 1e12 + (a.market_cap ?? 0) * 1e6 + (a.holder_count ?? 0);
  const movers = [...data.items].sort((x, y) => scored(y) - scored(x)).slice(0, 12);
  const hasVolume = movers.some((a) => (a.volume_24h ?? 0) > 0);
  setStatus(hasVolume
    ? "Top movers by 24h volume:"
    : "Biggest assets by market cap & holders (volume ranking goes live once trading starts):");
  render(movers);
}

async function drillCollection(collection: string): Promise<void> {
  skeleton();
  setStatus(`Opening collection ${collection.slice(0, 12)}…`);
  const data = await searchAssets({
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
  const data = await searchAssets({
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

interface WalletProvider {
  publicKey?: { toString(): string };
  connect(): Promise<{ publicKey: { toString(): string } }>;
  signTransaction<T>(tx: T): Promise<T>;
}

function getProvider(name: "nightly" | "phantom" | "solflare"): WalletProvider | null {
  const w = window as unknown as {
    nightly?: { solana?: WalletProvider };
    solana?: WalletProvider & { isPhantom?: boolean };
    solflare?: WalletProvider;
  };
  if (name === "nightly") return w.nightly?.solana ?? null;
  if (name === "solflare") return w.solflare ?? null;
  return w.solana ?? null;
}

let activeProvider: WalletProvider | null = null;
let activeAddress = "";

async function connectWallet(name: "nightly" | "phantom" | "solflare"): Promise<void> {
  const provider = getProvider(name);
  if (!provider) {
    setStatus(`No ${name} wallet detected — install it, or paste an address above for read-only mode.`);
    return;
  }
  setStatus(`Waiting for ${name} approval…`);
  const { publicKey } = await provider.connect();
  activeProvider = provider;
  activeAddress = publicKey.toString();
  const lamports = await connection.getBalance(new PublicKey(activeAddress));
  addrInput.value = activeAddress;
  walletEl.hidden = false;
  walletAddrEl.textContent = `${activeAddress.slice(0, 6)}…${activeAddress.slice(-4)}`;
  walletBalEl.textContent = `${(lamports / LAMPORTS_PER_SOL).toFixed(4)} SOL`;
  (document.getElementById("sendto") as HTMLInputElement).placeholder = "Recipient address…";
  setStatus(`Connected with ${name}.`);
  await inspectCurrent();
}

async function sendSol(): Promise<void> {
  if (!activeProvider?.publicKey) {
    txStatus("Connect a wallet first (Nightly required for the bounty demo).");
    return;
  }
  const to = (document.getElementById("sendto") as HTMLInputElement).value.trim();
  const amount = Number((document.getElementById("sendamount") as HTMLInputElement).value);
  if (!to || !(amount > 0)) {
    txStatus("Enter a recipient address and an amount above zero.");
    return;
  }
  const sendBtn = document.getElementById("sendbtn") as HTMLButtonElement;
  sendBtn.disabled = true;
  try {
    txStatus("Building transaction…");
    const tx = new Transaction().add(SystemProgram.transfer({
      fromPubkey: new PublicKey(activeAddress),
      toPubkey: new PublicKey(to),
      lamports: Math.round(amount * LAMPORTS_PER_SOL),
    }));
    tx.feePayer = new PublicKey(activeAddress);
    tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    txStatus("Waiting for wallet signature…");
    const signed = await activeProvider.signTransaction(tx);
    txStatus("Broadcasting…");
    const sig = await connection.sendRawTransaction(signed.serialize());
    txStatus(`Confirming ${sig.slice(0, 12)}…`);
    await connection.confirmTransaction(sig, "confirmed");
    txStatus(`Confirmed ✓ ${sig}`);
    const sigEl = document.getElementById("txsig") as HTMLElement;
    sigEl.innerHTML = `signature: <code>${escapeHtml(sig)}</code> <button id="sigcopy">copy</button>`;
    document.getElementById("sigcopy")!.addEventListener("click", () => navigator.clipboard?.writeText(sig));
  } catch (err: unknown) {
    txStatus(`Failed: ${err instanceof Error ? err.message : String(err)}`);
  } finally {
    sendBtn.disabled = false;
  }
}

function txStatus(msg: string): void {
  (document.getElementById("txstatus") as HTMLElement).textContent = msg;
}

async function showChainStats(): Promise<void> {
  const el = document.getElementById("chainslot") as HTMLElement;
  try {
    const stats = await getChainStats();
    el.textContent = `slot ${stats.slot.toLocaleString()} · ${stats.tps} TPS · ${stats.medianFeeSol.toFixed(9)} SOL fee`;
  } catch {
    el.textContent = "Cookie Chain · RPC unreachable";
  }
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
const walletEl = document.getElementById("walletbar") as HTMLElement;
const walletAddrEl = document.getElementById("walletaddr") as HTMLElement;
const walletBalEl = document.getElementById("walletbal") as HTMLElement;

armImageFallbacks(resultsEl);
armImageFallbacks(modalEl);
void showChainStats();
window.setInterval(showChainStats, 30000);

document.getElementById("lookup")!.addEventListener("submit", (e) => {
  e.preventDefault();
  inspectCurrent().catch(fail);
});
for (const name of ["nightly", "phantom", "solflare"] as const) {
  document.getElementById(`connect-${name}`)!.addEventListener("click", () => connectWallet(name).catch(fail));
}
document.getElementById("sendbtn")!.addEventListener("click", () => sendSol().catch(fail));
function setTab(id: string): void {
  for (const t of ["activity", "movers", "viewtoggle"]) {
    document.getElementById(t)!.classList.toggle("active", t === id);
  }
}
document.getElementById("activity")!.addEventListener("click", () => {
  gallery = false;
  setTab("activity");
  showActivity().catch(fail);
});
document.getElementById("movers")!.addEventListener("click", () => {
  gallery = false;
  setTab("movers");
  showMovers().catch(fail);
});
document.getElementById("searchbtn")!.addEventListener("click", () => {
  const v = (document.getElementById("q") as HTMLInputElement).value.trim();
  if (v) search(v).catch(fail);
});
document.getElementById("viewtoggle")!.addEventListener("click", () => {
  gallery = !gallery;
  setTab(gallery ? "viewtoggle" : "activity");
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
