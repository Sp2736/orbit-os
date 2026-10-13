const GREEK: Record<string, string> = {
  "α": "alpha", "β": "beta", "γ": "gamma", "δ": "delta", "ε": "epsilon", "ζ": "zeta", "η": "eta", "θ": "theta",
  "ι": "iota", "κ": "kappa", "λ": "lambda", "μ": "mu", "ν": "nu", "ξ": "xi", "ο": "omicron", "π": "pi",
  "ρ": "rho", "σ": "sigma", "τ": "tau", "υ": "upsilon", "φ": "phi", "χ": "chi", "ψ": "psi", "ω": "omega",
};

// Three-letter Bayer abbreviations -> full greek names (HYG uses these).
const BAYER_ABBR: Record<string, string> = {
  alp: "alpha", bet: "beta", gam: "gamma", del: "delta", eps: "epsilon", zet: "zeta", eta: "eta", the: "theta",
  iot: "iota", kap: "kappa", lam: "lambda", mu: "mu", nu: "nu", xi: "xi", omi: "omicron", pi: "pi",
  rho: "rho", sig: "sigma", tau: "tau", ups: "upsilon", phi: "phi", chi: "chi", psi: "psi", ome: "omega",
};

/** Lowercase, expand greek letters/abbreviations, strip punctuation and spaces. "α Cen" -> "alphacen". */
export function normalizeQuery(input: string): string {
  let s = input.trim().toLowerCase();
  s = s.replace(/[α-ω]/g, (ch) => GREEK[ch] ?? ch);
  s = s.replace(/[^a-z0-9\s]/g, " ");
  const parts = s.split(/\s+/).filter(Boolean).map((p) => BAYER_ABBR[p] ?? p);
  return parts.join("");
}

export interface CatalogId {
  catalog: "hip" | "hd" | "hr" | "gj" | "messier" | "ngc" | "ic";
  number: number;
}

/** Parse "HIP 32349", "hd48915", "M31", "NGC 224", "Gliese 551", "GJ551". Returns null when not a catalog id. */
export function parseCatalogId(input: string): CatalogId | null {
  const s = input.trim().toLowerCase().replace(/\s+/g, "");
  const m = s.match(/^(hip|hd|hr|gj|gliese|messier|m|ngc|ic)(\d+)$/);
  if (!m) return null;
  const map: Record<string, CatalogId["catalog"]> = {
    hip: "hip", hd: "hd", hr: "hr", gj: "gj", gliese: "gj", messier: "messier", m: "messier", ngc: "ngc", ic: "ic",
  };
  return { catalog: map[m[1]], number: parseInt(m[2], 10) };
}
