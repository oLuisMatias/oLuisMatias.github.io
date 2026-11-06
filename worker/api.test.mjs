// Tests for the project editor's API: what it may touch, and that other sites can't drive it. Run: npm test
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";

let handleApi, StoreConflict, githubStore, worker;

before(async () => {
  const out = await build({
    stdin: {
      contents: `
        export { handleApi } from "./worker/api";
        export { StoreConflict } from "./worker/store";
        export { githubStore } from "./worker/github-store";
        import worker from "./worker/index";
        export { worker };
      `,
      resolveDir: process.cwd(),
      loader: "ts",
    },
    bundle: true,
    format: "esm",
    platform: "neutral",
    write: false,
    logLevel: "silent",
  });
  const mod = await import(`data:text/javascript;base64,${Buffer.from(out.outputFiles[0].text).toString("base64")}`);
  ({ handleApi, StoreConflict, githubStore, worker } = mod);
});

// A store held in memory, with GitHub-like version tags.
function memoryStore(files = {}) {
  let n = 0;
  const data = new Map(Object.entries(files).map(([p, t]) => [p, { bytes: new TextEncoder().encode(t), sha: `v${n++}` }]));
  return {
    data,
    async list(dir) {
      return [...data]
        .filter(([p]) => p.startsWith(`${dir}/`) && !p.slice(dir.length + 1).includes("/"))
        .map(([p, f]) => ({ name: p.slice(dir.length + 1), sha: f.sha }));
    },
    async read(p) {
      return data.get(p) ?? null;
    },
    async write(p, bytes, sha) {
      const old = data.get(p);
      if (old ? old.sha !== sha : sha) throw new StoreConflict("conflict");
      const next = { bytes, sha: `v${n++}` };
      data.set(p, next);
      return { sha: next.sha };
    },
    async remove(p, sha) {
      if (data.get(p)?.sha !== sha) throw new StoreConflict("conflict");
      data.delete(p);
    },
    commits: 0,
    async commit(changes) {
      this.commits++;
      const shas = {};
      for (const { path, bytes } of changes) {
        if (bytes) data.set(path, (shas[path] = `v${n++}`, { bytes, sha: shas[path] }));
        else data.delete(path);
      }
      return shas;
    },
  };
}

const ORIGIN = "https://lmatias.example";
const editorHeaders = { Origin: ORIGIN, "X-Editor": "1" };
const req = (path, { method = "GET", headers = {}, body } = {}) => new Request(`${ORIGIN}${path}`, { method, headers, body });
const put = (path, obj, headers = editorHeaders) =>
  req(path, { method: "PUT", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify(obj) });

test("lists projects with their text and version", async () => {
  const store = memoryStore({ "src/content/projects/a.yml": "title: A", "src/content/projects/notes.txt": "x" });
  const { projects } = await (await handleApi(req("/admin/api/projects"), store)).json();
  assert.deepEqual(projects.map((p) => [p.slug, p.text]), [["a", "title: A"]]);
});

test("saves a project, and a stale version is a conflict", async () => {
  const store = memoryStore({ "src/content/projects/a.yml": "title: A" });
  const sha = store.data.get("src/content/projects/a.yml").sha;
  assert.equal((await handleApi(put("/admin/api/projects/a", { text: "title: B", sha }), store)).status, 200);
  assert.equal(new TextDecoder().decode(store.data.get("src/content/projects/a.yml").bytes), "title: B");
  assert.equal((await handleApi(put("/admin/api/projects/a", { text: "title: C", sha }), store)).status, 409);
});

test("creates a new project, but never overwrites an existing one blindly", async () => {
  const store = memoryStore({ "src/content/projects/a.yml": "title: A" });
  assert.equal((await handleApi(put("/admin/api/projects/new-one", { text: "title: N" }), store)).status, 200);
  assert.equal((await handleApi(put("/admin/api/projects/a", { text: "title: X" }), store)).status, 409);
});

test("deletes a project", async () => {
  const store = memoryStore({ "src/content/projects/a.yml": "title: A" });
  const sha = store.data.get("src/content/projects/a.yml").sha;
  const res = await handleApi(
    req("/admin/api/projects/a", { method: "DELETE", headers: { ...editorHeaders, "Content-Type": "application/json" }, body: JSON.stringify({ sha }) }),
    store,
  );
  assert.equal(res.status, 200);
  assert.equal(store.data.size, 0);
});

test("only plain project names are accepted (no paths, no escapes)", async () => {
  const store = memoryStore();
  for (const slug of ["..", "..%2F..%2Fwrangler", "A", "a.b", "-a", "a%2Fb"]) {
    const res = await handleApi(put(`/admin/api/projects/${slug}`, { text: "x" }), store);
    assert.ok([400, 404].includes(res.status), `${slug} -> ${res.status}`);
  }
  assert.equal(store.data.size, 0);
});

test("changes need the editor's own origin and header", async () => {
  const store = memoryStore();
  for (const headers of [{}, { Origin: "https://evil.example", "X-Editor": "1" }, { Origin: ORIGIN }, { "X-Editor": "1" }]) {
    assert.equal((await handleApi(put("/admin/api/projects/a", { text: "title: A" }, headers), store)).status, 403);
  }
  assert.equal(store.data.size, 0);
});

test("uploads go to the image or model folder and keep a safe name", async () => {
  const store = memoryStore();
  const up = (name, bytes = new Uint8Array([1, 2, 3])) =>
    handleApi(req(`/admin/api/upload?name=${encodeURIComponent(name)}`, { method: "POST", headers: editorHeaders, body: bytes }), store);
  assert.deepEqual(await (await up("My Photo.PNG")).json(), { path: "/images/projects/my-photo.png" });
  assert.deepEqual(await (await up("part.glb")).json(), { path: "/data/models/part.glb" });
  for (const bad of ["evil.html", "x.svg", "script.js", ".png", "noext"]) assert.equal((await up(bad)).status, 400, bad);
  assert.deepEqual(await (await up("../../evil.png")).json(), { path: "/images/projects/evil.png" }); // slashes are flattened
  assert.equal((await up("empty.png", new Uint8Array())).status, 400);
  assert.equal((await up("my-photo.png")).status, 200); // uploading the same name again replaces the file
  assert.equal(store.data.size, 3);
});

test("lists images and models for the pickers", async () => {
  const store = memoryStore({ "public/images/projects/a.png": "x", "public/images/projects/readme.txt": "x", "public/data/models/m.glb": "x" });
  const body = await (await handleApi(req("/admin/api/files"), store)).json();
  assert.deepEqual(body, { images: ["/images/projects/a.png"], models: ["/data/models/m.glb"] });
});

test("the GitHub store sends the token, branch and version to GitHub", async () => {
  const calls = [];
  const real = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    return Response.json({ content: { sha: "newsha" } });
  };
  try {
    const store = githubStore({ token: "tok", repo: "me/site", branch: "main" });
    const out = await store.write("src/content/projects/a b.yml", new TextEncoder().encode("hi"), "oldsha", "msg");
    assert.equal(out.sha, "newsha");
    assert.equal(calls[0].url, "https://api.github.com/repos/me/site/contents/src/content/projects/a%20b.yml");
    assert.equal(calls[0].init.headers.Authorization, "Bearer tok");
    const sent = JSON.parse(calls[0].init.body);
    assert.deepEqual([sent.branch, sent.sha, sent.message, sent.content], ["main", "oldsha", "msg", "aGk="]);
  } finally {
    globalThis.fetch = real;
  }
});

test("through the Worker: no login ticket means no access and no call to GitHub", async () => {
  let githubCalled = false;
  const real = globalThis.fetch;
  globalThis.fetch = async () => {
    githubCalled = true;
    return Response.json({});
  };
  try {
    const env = {
      ASSETS: { fetch: async () => new Response("file") },
      GITHUB_TOKEN: "t",
      GITHUB_REPO: "me/site",
      ACCESS_TEAM_DOMAIN: "https://t.cloudflareaccess.com",
      ACCESS_AUD: "aud",
      OWNER_EMAIL: "o@example.com",
    };
    const res = await worker.fetch(put("/admin/api/projects/a", { text: "x" }), env);
    assert.equal(res.status, 401);
    assert.equal(githubCalled, false);
  } finally {
    globalThis.fetch = real;
  }
});

test("the home page file can be read and saved, with a version check, and nothing else next to it", async () => {
  const store = memoryStore({ "src/data/home.yml": "status: hi", "src/data/site.yml": "name: Luis" });
  const read = await (await handleApi(req("/admin/api/home"), store)).json();
  assert.equal(read.text, "status: hi");
  assert.ok(read.sha);

  // saving with the right version works and changes only home.yml
  const ok = await handleApi(put("/admin/api/home", { text: "status: new", sha: read.sha }), store);
  assert.equal(ok.status, 200);
  assert.equal(new TextDecoder().decode(store.data.get("src/data/home.yml").bytes), "status: new");
  assert.equal(new TextDecoder().decode(store.data.get("src/data/site.yml").bytes), "name: Luis");

  // a stale version is a conflict
  const stale = await handleApi(put("/admin/api/home", { text: "status: other", sha: read.sha }), store);
  assert.equal(stale.status, 409);

  // other editors' requests and bad bodies are refused
  assert.equal((await handleApi(put("/admin/api/home", { text: "x", sha: "v9" }, {}), store)).status, 403);
  assert.equal((await handleApi(put("/admin/api/home", { text: "  " }), store)).status, 400);
  assert.equal((await handleApi(put("/admin/api/home", { text: "x".repeat(300_001) }), store)).status, 413);
});

test("an empty store gives an empty home file, and the first save creates it", async () => {
  const store = memoryStore();
  const read = await (await handleApi(req("/admin/api/home"), store)).json();
  assert.deepEqual(read, { sha: null, text: "" });
  const created = await handleApi(put("/admin/api/home", { text: "status: first", sha: null }), store);
  assert.equal(created.status, 200);
  assert.ok(store.data.has("src/data/home.yml"));
});

test("the projects page file works the same way, and unknown names are not files", async () => {
  const store = memoryStore({ "src/data/projects-page.yml": "columns: 3" });
  const read = await (await handleApi(req("/admin/api/projects-page"), store)).json();
  assert.equal(read.text, "columns: 3");
  const ok = await handleApi(put("/admin/api/projects-page", { text: "columns: 2", sha: read.sha }), store);
  assert.equal(ok.status, 200);
  assert.equal(new TextDecoder().decode(store.data.get("src/data/projects-page.yml").bytes), "columns: 2");
  // only the listed pages can be written
  assert.equal((await handleApi(put("/admin/api/site", { text: "name: x" }), store)).status, 404);
  assert.equal((await handleApi(put("/admin/api/package", { text: "{}" }), store)).status, 404);
  assert.equal(store.data.size, 1);
});

test("the CV cards are listed by section, saved and deleted by name", async () => {
  const store = memoryStore({ "src/content/work/a.yml": "title: A", "src/content/education/e.yml": "degree: E", "src/content/work/notes.txt": "x" });
  const lists = await (await handleApi(req("/admin/api/cv"), store)).json();
  assert.deepEqual([lists.work.map((f) => f.name), lists.education.map((f) => f.name)], [["a.yml"], ["e.yml"]]);
  assert.equal((await handleApi(put("/admin/api/cv/work/new-card-1.yml", { text: "title: N" }), store)).status, 200);
  assert.equal(store.data.has("src/content/work/new-card-1.yml"), true);
  assert.equal((await handleApi(put("/admin/api/cv/work/a.yml", { text: "title: X" }), store)).status, 409);
  const sha = store.data.get("src/content/education/e.yml").sha;
  const del = req("/admin/api/cv/education/e.yml", { method: "DELETE", headers: { ...editorHeaders, "Content-Type": "application/json" }, body: JSON.stringify({ sha }) });
  assert.equal((await handleApi(del, store)).status, 200);
  assert.equal(store.data.has("src/content/education/e.yml"), false);
});

test("CV card names are plain file names inside the two CV folders", async () => {
  const store = memoryStore();
  for (const path of ["/admin/api/cv/work/..%2Fx.yml", "/admin/api/cv/work/A.yml", "/admin/api/cv/work/a.txt", "/admin/api/cv/prints/a.yml", "/admin/api/cv/work/a%2Fb.yml"]) {
    const res = await handleApi(put(path, { text: "x" }), store);
    assert.ok([400, 404].includes(res.status), `${path} -> ${res.status}`);
  }
  assert.equal(store.data.size, 0);
  assert.equal((await handleApi(put("/admin/api/cv/work/a.yml", { text: "x" }, {}), store)).status, 403);
});

test("CV logos are uploaded to and listed from the folder of their section", async () => {
  const store = memoryStore({ "public/images/cv/studies/old.png": "x" });
  const up = (area, name) => handleApi(req(`/admin/api/upload?name=${name}&area=${area}`, { method: "POST", headers: editorHeaders, body: new Uint8Array([1]) }), store);
  assert.deepEqual(await (await up("work", "Logo.png")).json(), { path: "/images/cv/work/logo.png" });
  assert.deepEqual(await (await up("education", "u.webp")).json(), { path: "/images/cv/studies/u.webp" });
  assert.equal((await up("work", "m.glb")).status, 400);
  assert.equal(store.data.has("public/images/cv/work/logo.png"), true);
  const list = await (await handleApi(req("/admin/api/files?area=education"), store)).json();
  assert.deepEqual(list.images, ["/images/cv/studies/old.png", "/images/cv/studies/u.webp"]);
});

test("all four CV sections are listed, and certificate files can be uploaded", async () => {
  const store = memoryStore({ "src/content/experiences/x.yml": "title: X", "src/content/certifications/c.yml": "title: C", "src/data/skills.yml": "skills: []" });
  const lists = await (await handleApi(req("/admin/api/cv"), store)).json();
  assert.deepEqual([lists.experiences.length, lists.certifications.length], [1, 1]);
  assert.equal((await handleApi(put("/admin/api/cv/certifications/n.yml", { text: "title: N" }), store)).status, 200);
  const up = (name) => handleApi(req(`/admin/api/upload?name=${name}&area=documents`, { method: "POST", headers: editorHeaders, body: new Uint8Array([1]) }), store);
  assert.deepEqual(await (await up("My Cert.PDF")).json(), { path: "/data/documents/my-cert.pdf" });
  assert.equal((await up("run.exe")).status, 400);
  assert.equal(store.data.has("public/data/documents/my-cert.pdf"), true);
  const list = await (await handleApi(req("/admin/api/files?area=documents"), store)).json();
  assert.deepEqual(list.images, ["/data/documents/my-cert.pdf"]);
  const skills = await (await handleApi(req("/admin/api/skills"), store)).json();
  assert.equal(skills.text, "skills: []");
  assert.equal((await handleApi(put("/admin/api/skills", { text: "skills: []\nlanguages: []\n", sha: skills.sha }), store)).status, 200);
});

test("names that exist on every object (__proto__, constructor) are not areas or page files", async () => {
  const store = memoryStore();
  const up = await handleApi(req("/admin/api/upload?name=x.png&area=__proto__", { method: "POST", headers: editorHeaders, body: new Uint8Array([1]) }), store);
  assert.equal(store.data.size, 0, "nothing may be written to a path made from an inherited key");
  assert.equal(up.status, 400);
  const res = await handleApi(req("/admin/api/constructor"), store);
  assert.equal(res.status, 404);
});

test("uploading a picture with a name that exists replaces it", async () => {
  const store = memoryStore({ "public/images/projects/a.png": "old" });
  const res = await handleApi(req("/admin/api/upload?name=a.png", { method: "POST", headers: editorHeaders, body: new Uint8Array([7]) }), store);
  assert.equal(res.status, 200);
  assert.deepEqual([...store.data.get("public/images/projects/a.png").bytes], [7]);
});

test("the CV cards are saved in ONE commit, with a version check for each", async () => {
  const store = memoryStore({ "src/content/work/a.yml": "title: A", "src/content/work/b.yml": "title: B" });
  const a = store.data.get("src/content/work/a.yml").sha;
  const b = store.data.get("src/content/work/b.yml").sha;
  const save = (body) => handleApi(req("/admin/api/cv/save", { method: "POST", headers: { ...editorHeaders, "Content-Type": "application/json" }, body: JSON.stringify(body) }), store);

  const ok = await save({ files: [{ section: "work", name: "a.yml", text: "title: A2", sha: a }, { section: "work", name: "c.yml", text: "title: C", sha: null }], deletes: [{ section: "work", name: "b.yml", sha: b }] });
  assert.equal(ok.status, 200);
  assert.equal(store.commits, 1);
  assert.deepEqual([...store.data.keys()].sort(), ["src/content/work/a.yml", "src/content/work/c.yml"]);
  assert.deepEqual(Object.keys((await ok.json()).shas).sort(), ["work/a.yml", "work/c.yml"]);

  const stale = await save({ files: [{ section: "work", name: "a.yml", text: "title: A3", sha: a }], deletes: [] });
  assert.equal(stale.status, 409);
  assert.equal(store.commits, 1, "a stale save must not commit anything");
  assert.equal((await save({ files: [{ section: "__proto__", name: "a.yml", text: "x", sha: null }], deletes: [] })).status, 400);
  assert.equal((await save({ files: [{ section: "work", name: "../x.yml", text: "x", sha: null }], deletes: [] })).status, 400);
});
