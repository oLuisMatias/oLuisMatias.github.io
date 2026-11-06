// Checks the login ticket that Cloudflare Access puts on every request it lets through.
//
// Access has already asked for an email code at the edge. This check is a second lock: even if Access
// were ever switched off or set up wrong, the Worker still refuses anyone who has no valid ticket
// for the owner's email. It fails closed: anything missing or odd means "no".
import { base64UrlToBytes } from "./base64";

export interface AccessEnv {
  /** For example https://myteam.cloudflareaccess.com */
  ACCESS_TEAM_DOMAIN?: string;
  /** The Access application's AUD tag. Several tags can be given, separated by commas. */
  ACCESS_AUD?: string;
  OWNER_EMAIL?: string;
}

export type AccessResult = { ok: true; email: string } | { ok: false; status: number; message: string };

interface Jwk extends JsonWebKey {
  kid?: string;
}

const KEYS_TTL_MS = 10 * 60 * 1000;
let keyCache: { team: string; at: number; keys: Jwk[] } | null = null;

export async function verifyAccess(request: Request, env: AccessEnv): Promise<AccessResult> {
  const team = (env.ACCESS_TEAM_DOMAIN ?? "").trim().replace(/\/+$/, "");
  const auds = (env.ACCESS_AUD ?? "").split(",").map((a) => a.trim()).filter(Boolean);
  const owner = (env.OWNER_EMAIL ?? "").trim().toLowerCase();
  if (!team.startsWith("https://") || auds.length === 0 || !owner) {
    return { ok: false, status: 503, message: "The login lock (Cloudflare Access) isn't set up yet." };
  }

  const token = request.headers.get("Cf-Access-Jwt-Assertion");
  if (!token) return deny("You are not signed in.");

  const parts = token.split(".");
  if (parts.length !== 3) return deny("The login ticket is malformed.");

  let header: { alg?: string; kid?: string };
  let claims: { iss?: string; aud?: string | string[]; exp?: number; nbf?: number; email?: string };
  try {
    header = JSON.parse(new TextDecoder().decode(base64UrlToBytes(parts[0])));
    claims = JSON.parse(new TextDecoder().decode(base64UrlToBytes(parts[1])));
  } catch {
    return deny("The login ticket is malformed.");
  }
  if (header.alg !== "RS256" || !header.kid) return deny("The login ticket uses an unsupported signature.");

  // Signature: the ticket must be signed by one of the keys Cloudflare publishes for this team.
  let jwk = (await getKeys(team, false)).find((k) => k.kid === header.kid);
  if (!jwk) jwk = (await getKeys(team, true)).find((k) => k.kid === header.kid); // keys may have rotated
  if (!jwk) return deny("The login ticket was not signed by Cloudflare Access.");

  let valid = false;
  try {
    const key = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
    valid = await crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5",
      key,
      base64UrlToBytes(parts[2]),
      new TextEncoder().encode(`${parts[0]}.${parts[1]}`),
    );
  } catch {
    valid = false;
  }
  if (!valid) return deny("The login ticket signature is not valid.");

  // Claims: right issuer, right application, not expired, and the owner's email.
  const now = Math.floor(Date.now() / 1000);
  const tokenAuds = Array.isArray(claims.aud) ? claims.aud : claims.aud ? [claims.aud] : [];
  if (claims.iss !== team) return deny("The login ticket comes from another team.");
  if (!tokenAuds.some((a) => auds.includes(a))) return deny("The login ticket is for another application.");
  if (typeof claims.exp !== "number" || claims.exp <= now) return deny("Your login has expired. Reload the page to sign in again.");
  if (typeof claims.nbf === "number" && claims.nbf > now + 60) return deny("The login ticket is not valid yet.");

  const email = (claims.email ?? "").toLowerCase();
  if (email !== owner) return { ok: false, status: 403, message: "This account is not allowed here." };

  return { ok: true, email };
}

function deny(message: string): AccessResult {
  return { ok: false, status: 401, message };
}

async function getKeys(team: string, force: boolean): Promise<Jwk[]> {
  if (!force && keyCache && keyCache.team === team && Date.now() - keyCache.at < KEYS_TTL_MS) return keyCache.keys;
  try {
    const res = await fetch(`${team}/cdn-cgi/access/certs`);
    if (!res.ok) return keyCache?.team === team ? keyCache.keys : [];
    const data = (await res.json()) as { keys?: Jwk[] };
    keyCache = { team, at: Date.now(), keys: data.keys ?? [] };
    return keyCache.keys;
  } catch {
    return keyCache?.team === team ? keyCache.keys : [];
  }
}
