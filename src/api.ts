// Typed DAS + chain client for CookieScope. Native fetch only (plus the
// already-installed @solana/web3.js for chain stats). Endpoints identical
// to the rest of the app.

import { Connection } from "@solana/web3.js";

export const DAS_RPC_URL = "https://api.cookiescan.io/";
export const CHAIN_RPC_URL = "https://rpc.cookiescan.io/";

export interface DasAsset {
  id: string;
  interface: string;
  mutable?: boolean;
  content?: {
    files?: { uri?: string; mime?: string }[];
    links?: { image?: string; external_url?: string };
    json_uri?: string;
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
  token_info?: {
    balance?: number;
    decimals?: number;
    price_info?: { total_price?: number; price_per_token?: number; currency?: string };
  };
  creators?: { address?: string; share?: number; verified?: boolean }[];
  authorities?: { address?: string; scopes?: string[] }[];
  market_cap?: number;
  volume_24h?: number;
  price_change_24h?: number;
  holder_count?: number;
}

export interface ChainStats {
  slot: number;
  tps: number;
  medianFeeSol: number;
}

const DEFAULT_TIMEOUT_MS = 20000;

async function fetchJson(url: string, body: unknown, timeoutMs: number): Promise<unknown> {
  const ctrl = new AbortController();
  const timer = window.setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    window.clearTimeout(timer);
  }
}

/** DAS JSON-RPC call. Retries once on network failure/abort, never on
 *  HTTP or application-level errors. */
export async function rpc<T>(method: string, params: unknown, opts?: { timeoutMs?: number }): Promise<T> {
  const timeoutMs = opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const payload = { jsonrpc: "2.0", id: 1, method, params };
  let lastErr: unknown = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const body = (await fetchJson(DAS_RPC_URL, payload, timeoutMs)) as {
        result?: T;
        error?: { message?: string };
      };
      if (body.error) throw new Error(body.error.message ?? "RPC error");
      return body.result as T;
    } catch (err) {
      // Retry only transport-level failures (abort / TypeError from fetch).
      if (err instanceof TypeError || (err instanceof DOMException && err.name === "AbortError")) {
        lastErr = err;
        continue;
      }
      throw err;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("request failed");
}

export function getAssetsByOwner(owner: string, page = 1, limit = 50): Promise<{ items: DasAsset[]; total: number }> {
  return rpc("getAssetsByOwner", {
    ownerAddress: owner,
    page,
    limit,
    options: { showFungible: true, showCollectionMetadata: true },
  });
}

export function searchAssets(params: Record<string, unknown>): Promise<{ items: DasAsset[]; total?: number }> {
  return rpc("searchAssets", params);
}

const chainConnection = new Connection(CHAIN_RPC_URL, "confirmed");

export async function getChainStats(): Promise<ChainStats> {
  const [slot, samples, fees] = await Promise.all([
    chainConnection.getSlot(),
    chainConnection.getRecentPerformanceSamples(2),
    chainConnection.getRecentPrioritizationFees(),
  ]);
  const txs = samples.reduce((n, s) => n + s.numTransactions, 0);
  const secs = samples.reduce((n, s) => n + s.samplePeriodSecs, 0);
  const sorted = fees.map((f) => f.prioritizationFee).sort((a, b) => a - b);
  return {
    slot,
    tps: secs > 0 ? Math.round(txs / secs) : 0,
    medianFeeSol: sorted.length ? sorted[Math.floor(sorted.length / 2)] / 1e9 : 0,
  };
}

export function chainConnectionForWrites(): Connection {
  return new Connection(CHAIN_RPC_URL, "confirmed");
}
