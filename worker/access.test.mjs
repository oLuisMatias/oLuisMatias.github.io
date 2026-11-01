// Tests for the sign-in window of the content editor: /admin/auth must hand out the GitHub token
// only with a valid Cloudflare Access ticket for the owner's email. Run: npm test
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";

const TEAM = "https://myteam.cloudflareaccess.com";
const AUD = "aud-abc123";
const OWNER = "owner@example.com";
const TOKEN = "ghp_secret_token_value";

let worker;
let keys; // the key pair Cloudflare "uses" in these tests
let otherKeys; // a stranger's key pair

const b64url = (data) => Buffer.from(data).toString("base64url");

async function makeKeys(kid) {
  const pair = await crypto.subtle.generateKey(
    { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
    true,
    ["sign", "verify"],
  );
  const jwk = { ...(await crypto.subtle.exportKey("jwk", pair.publicKey)), kid, alg: "RS256", use: "sig" };
  return { privateKey: pair.privateKey, jwk, kid };
}

async function ticket(claims, { signWith = keys, kid = signWith.kid, alg = "RS256" } = {}) {
  const header = b64url(JSON.stringify({ alg, kid, typ: "JWT" }));
  const now = Math.floor(Date.now() / 1000);
  const payload = b64url(JSON.stringify({ iss: TEAM, aud: [AUD], email: OWNER, iat: now, nbf: now, exp: now + 3600, ...claims }));
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", signWith.privateKey, new TextEncoder().encode(`${header}.${payload}`));
  return `${header}.${payload}.${b64url(new Uint8Array(sig))}`;
}

const baseEnv = () => ({
  ASSETS: { fetch: async () => new Response("a plain file of the site") },
  GITHUB_TOKEN: TOKEN,
  ACCESS_TEAM_DOMAIN: TEAM,
  ACCESS_AUD: AUD,
  OWNER_EMAIL: OWNER,
});

async function call(headers = {}, env = baseEnv(), path = "/admin/auth", method = "GET") {
  const res = await worker.fetch(new Request(`https://lmatias.example${path}`, { method, headers }), env);
  return { status: res.status, body: await res.text() };
}

before(async () => {
  keys = await makeKeys("key-1");
  otherKeys = await makeKeys("key-1"); // same kid on purpose: only the signature tells them apart
  // Cloudflare's published keys for the team.
  globalThis.fetch = async (url) => {
    if (String(url) === `${TEAM}/cdn-cgi/access/certs`) return Response.json({ keys: [keys.jwk] });
    throw new Error(`unexpected fetch: ${url}`);
  };
  const out = await build({ entryPoints: ["worker/index.ts"], bundle: true, format: "esm", platform: "neutral", write: false, logLevel: "silent" });
  worker = (await import(`data:text/javascript;base64,${Buffer.from(out.outputFiles[0].text).toString("base64")}`)).default;
});

const noToken = (r) => assert.ok(!r.body.includes(TOKEN), "the token must not appear in the response");

test("owner with a valid ticket gets the token", async () => {
  const r = await call({ "Cf-Access-Jwt-Assertion": await ticket({}) });
  assert.equal(r.status, 200);
  assert.ok(r.body.includes(TOKEN));
});

test("the email is compared without regard to case", async () => {
  const r = await call({ "Cf-Access-Jwt-Assertion": await ticket({ email: "Owner@Example.com" }) });
  assert.equal(r.status, 200);
});

test("no ticket: refused", async () => {
  const r = await call();
  assert.equal(r.status, 401);
  noToken(r);
});

test("another person's email: refused", async () => {
  const r = await call({ "Cf-Access-Jwt-Assertion": await ticket({ email: "stranger@example.com" }) });
  assert.equal(r.status, 403);
  noToken(r);
});

test("ticket for another application: refused", async () => {
  const r = await call({ "Cf-Access-Jwt-Assertion": await ticket({ aud: ["someone-elses-app"] }) });
  assert.equal(r.status, 401);
  noToken(r);
});

test("ticket from another team: refused", async () => {
  const r = await call({ "Cf-Access-Jwt-Assertion": await ticket({ iss: "https://other.cloudflareaccess.com" }) });
  assert.equal(r.status, 401);
  noToken(r);
});

test("expired ticket: refused", async () => {
  const r = await call({ "Cf-Access-Jwt-Assertion": await ticket({ exp: Math.floor(Date.now() / 1000) - 10 }) });
  assert.equal(r.status, 401);
  noToken(r);
});

test("ticket signed with a stranger's key: refused", async () => {
  const r = await call({ "Cf-Access-Jwt-Assertion": await ticket({}, { signWith: otherKeys }) });
  assert.equal(r.status, 401);
  noToken(r);
});

test("tampered ticket (email changed after signing): refused", async () => {
  const good = (await ticket({ email: "stranger@example.com" })).split(".");
  const forgedPayload = b64url(JSON.stringify({ iss: TEAM, aud: [AUD], email: OWNER, exp: Math.floor(Date.now() / 1000) + 3600 }));
  const r = await call({ "Cf-Access-Jwt-Assertion": `${good[0]}.${forgedPayload}.${good[2]}` });
  assert.equal(r.status, 401);
  noToken(r);
});

test("'alg: none' ticket: refused", async () => {
  const header = b64url(JSON.stringify({ alg: "none", typ: "JWT" }));
  const payload = b64url(JSON.stringify({ iss: TEAM, aud: [AUD], email: OWNER, exp: Math.floor(Date.now() / 1000) + 3600 }));
  const r = await call({ "Cf-Access-Jwt-Assertion": `${header}.${payload}.` });
  assert.equal(r.status, 401);
  noToken(r);
});

test("garbage in the header: refused", async () => {
  const r = await call({ "Cf-Access-Jwt-Assertion": "not-a-ticket" });
  assert.equal(r.status, 401);
  noToken(r);
});

test("login lock not configured (empty settings): refused, even with a ticket", async () => {
  const t = await ticket({});
  for (const patch of [{ ACCESS_TEAM_DOMAIN: "" }, { ACCESS_AUD: "" }, { OWNER_EMAIL: "" }, { ACCESS_TEAM_DOMAIN: undefined }]) {
    const r = await call({ "Cf-Access-Jwt-Assertion": t }, { ...baseEnv(), ...patch });
    assert.equal(r.status, 503);
    noToken(r);
  }
});

test("several application tags can be allowed", async () => {
  const env = { ...baseEnv(), ACCESS_AUD: `first-app, ${AUD}` };
  const r = await call({ "Cf-Access-Jwt-Assertion": await ticket({}) }, env);
  assert.equal(r.status, 200);
});

test("token not configured: a clear message, no crash", async () => {
  const r = await call({ "Cf-Access-Jwt-Assertion": await ticket({}) }, { ...baseEnv(), GITHUB_TOKEN: undefined });
  assert.equal(r.status, 503);
  assert.ok(r.body.includes("GITHUB_TOKEN"));
});

test("other addresses are plain files; POST to /admin/auth never gives the token", async () => {
  const file = await call({}, baseEnv(), "/cv");
  assert.equal(file.body, "a plain file of the site");
  const post = await call({ "Cf-Access-Jwt-Assertion": await ticket({}) }, baseEnv(), "/admin/auth", "POST");
  noToken(post);
});

test("the reply page only answers a window from the same site", async () => {
  const r = await call({ "Cf-Access-Jwt-Assertion": await ticket({}) });
  assert.ok(r.body.includes("e.origin !== window.location.origin"));
});
