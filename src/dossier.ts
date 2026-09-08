// Dossier modal + asset imagery for CookieScope. Owns no network calls;
// callers pass data in and react through callbacks.

import type { DasAsset } from "./api";

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

export const COOKIE_SVG = `<svg class="noimg" viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="13" fill="#f0b429"/><circle cx="12" cy="12" r="2.2" fill="#14100b"/><circle cx="20" cy="11" r="1.7" fill="#14100b"/><circle cx="17" cy="18" r="2.4" fill="#14100b"/><circle cx="11" cy="20" r="1.6" fill="#14100b"/></svg>`;

export function fastGateway(url: string): string {
  return url.replace("https://ipfs.io/ipfs/", "https://cloudflare-ipfs.com/ipfs/");
}

export function thumb(a: DasAsset, size: "sm" | "lg"): string {
  const raw = a.content?.links?.image ??
    a.content?.files?.find((f) => (f.mime ?? "").startsWith("image"))?.uri;
  if (raw) {
    return `<img src="${escapeHtml(fastGateway(raw))}" data-raw="${escapeHtml(raw)}" alt="" loading="lazy" class="${size}" />`;
  }
  return COOKIE_SVG;
}

// Swaps a failed fast-gateway image back to its origin URL, then to the
// cookie mark if the origin fails too. Delegated in capture phase.
export function armImageFallbacks(root: HTMLElement): void {
  root.addEventListener("error", (e) => {
    const t = e.target as HTMLElement;
    if (t.tagName !== "IMG") return;
    const img = t as HTMLImageElement;
    const raw = img.dataset.raw;
    if (raw && img.src !== raw) {
      img.src = raw;
    } else {
      const span = document.createElement("span");
      span.innerHTML = COOKIE_SVG;
      img.replaceWith(span.firstElementChild ?? span);
    }
  }, true);
}

export interface DossierCallbacks {
  onInspect(owner: string): void;
}

export function openDossier(a: DasAsset, ctx: DossierCallbacks): void {
  const modalEl = document.getElementById("modal") as HTMLElement;
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
      ctx.onInspect((b as HTMLElement).dataset.inspect!);
    }),
  );
  modalEl.addEventListener("click", (e) => {
    if (e.target === modalEl) closeDossier();
  }, { once: true });
}

export function closeDossier(): void {
  const modalEl = document.getElementById("modal") as HTMLElement;
  modalEl.hidden = true;
  modalEl.innerHTML = "";
}
