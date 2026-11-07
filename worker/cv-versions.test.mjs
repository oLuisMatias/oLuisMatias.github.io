// The saved CVs (src/data/cv-versions.yml). Run: npm test
import { test, before } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { build } from "esbuild";

let v;

before(async () => {
  const out = await build({ entryPoints: ["src/lib/cv-versions.ts"], bundle: true, format: "esm", platform: "browser", write: false, logLevel: "silent" });
  v = await import(`data:text/javascript;base64,${Buffer.from(out.outputFiles[0].text).toString("base64")}`);
});

const sample = () =>
  v.parseVersions(`live: 2
versions:
  - { id: 1, date: '2025-01-01', tag: Generic, pdf: /data/cvs/v1-a.pdf, from: null }
  - { id: 2, date: '2025-02-01', tag: Application, pdf: /data/cvs/v2-b.pdf, from: 1, liveFrom: '2025-02-01' }
`);

test("an empty or broken file gives no versions", () => {
  for (const text of ["", "null", "- a", "versions: 3", "live: 9\nversions: []"]) {
    const s = v.parseVersions(text);
    assert.deepEqual(s.versions, []);
    assert.equal(s.live, null);
  }
});

test("entries without an id or a PDF, and repeated ids, are dropped; fields get defaults", () => {
  const s = v.parseVersions("versions:\n  - { id: 1, pdf: /a.pdf }\n  - { id: 1, pdf: /b.pdf }\n  - { id: x, pdf: /c.pdf }\n  - { id: 3 }\n");
  assert.equal(s.versions.length, 1);
  assert.deepEqual([s.versions[0].tag, s.versions[0].from], ["Other", null]);
});

test("a live id that does not exist is ignored", () => {
  assert.equal(v.parseVersions("live: 5\nversions:\n  - { id: 1, pdf: /a.pdf }\n").live, null);
});

test("the list is newest first, and the live version is found", () => {
  const s = sample();
  assert.deepEqual(v.newestFirst(s.versions).map((x) => [x.id, x.n]), [[2, 2], [1, 1]]);
  assert.equal(v.liveVersion(s).id, 2);
});

test("numbers follow the dates: an older CV added later becomes v1 and the others move up", () => {
  const { state, id } = v.addVersion(sample(), { date: "2024-12-31", tag: "Imported", note: "", from: null, pdf: "/data/cvs/v3.pdf" });
  assert.equal(id, 3, "the id (and the file name) stay as they were given");
  assert.deepEqual(v.numbered(state.versions).map((x) => [x.id, x.n]), [[3, 1], [1, 2], [2, 3]]);
  assert.equal(v.numberOf(state, 1), 2);
  assert.equal(v.numberOf(state, 9), 0);
  const sameDay = v.addVersion(state, { date: "2025-01-01", tag: "Other", note: "", from: null, pdf: "/data/cvs/v4.pdf" }).state;
  assert.deepEqual(v.numbered(sameDay.versions).map((x) => x.id), [3, 1, 4, 2], "same day: the one added first comes first");
});

test("putting a version on the website records the days", () => {
  const next = v.makeLive(sample(), 1, "2025-03-01");
  assert.equal(next.live, 1);
  const [one, two] = next.versions;
  assert.deepEqual([one.liveFrom, one.liveTo], ["2025-03-01", ""]);
  assert.deepEqual([two.liveFrom, two.liveTo], ["2025-02-01", "2025-03-01"]);
  const same = sample();
  assert.equal(v.makeLive(same, 2, "2025-03-01"), same, "already live: nothing changes");
  assert.equal(v.makeLive(same, 9, "2025-03-01"), same, "unknown id: nothing changes");
});

test("a new version gets the next id; the live version cannot be deleted", () => {
  const { state, id } = v.addVersion(sample(), { date: "2025-04-01", tag: "Generic", note: "", from: 2, pdf: "/data/cvs/v3-c.pdf" });
  assert.equal(id, 3);
  assert.equal(state.versions.length, 3);
  assert.equal(v.removeVersion(state, 2).versions.length, 3, "the one in use stays");
  assert.deepEqual(v.removeVersion(state, 1).versions.map((x) => x.id), [2, 3]);
});

test("written back and read again it is the same", () => {
  const s = sample();
  assert.deepEqual(v.parseVersions(v.stringifyVersions(s)), s);
});

test("PDF file names are plain, and only the builder's own PDFs are deleted with a version", () => {
  assert.equal(v.pdfFileName(7), "v7.pdf");
  assert.ok(v.isOwnPdf("/data/cvs/v2-b.pdf"));
  assert.ok(!v.isOwnPdf("/data/documents/CV_Luis_Matias_NoPhone.pdf"));
});

test("the real cv-versions.yml reads, has a CV in use, and its PDFs exist", () => {
  const s = v.parseVersions(fs.readFileSync("src/data/cv-versions.yml", "utf8"));
  assert.ok(s.versions.length >= 1);
  assert.ok(v.liveVersion(s), "one CV is in use");
  for (const x of s.versions) assert.ok(fs.existsSync(`public${x.pdf}`), `${x.pdf} exists`);
});

test("drafts and locking: a built CV starts as a draft, locking is kept, the website version is locked, a PDF-only one can't be edited", () => {
  let s = v.parseVersions("versions:\n  - { id: 1, date: '2025-01-01', pdf: /a.pdf }\n  - { id: 2, date: '2025-02-01', pdf: /b.pdf, doc: true }\n  - { id: 3, date: '2025-03-01', pdf: /c.pdf, doc: true, locked: true }\n");
  assert.deepEqual(s.versions.map((x) => x.locked), [true, false, true], "PDF only: locked; built: draft unless locked");
  const added = v.addVersion(s, { date: "2025-04-01", tag: "Generic", note: "", from: 2, pdf: "/d.pdf", doc: true });
  assert.equal(added.state.versions.at(-1).locked, false, "a new built CV is a draft");
  s = v.lockVersion(added.state, 4);
  assert.equal(s.versions.at(-1).locked, true);
  assert.equal(v.parseVersions(v.stringifyVersions(s)).versions.at(-1).locked, true, "locking survives saving");
  assert.equal(v.updateDraft(s, 4, { note: "changed" }).versions.at(-1).note, "", "a locked CV is not changed");
  assert.equal(v.updateDraft(s, 2, { note: "changed" }).versions[1].note, "changed", "a draft is");
  assert.equal(v.makeLive(s, 2, "2025-05-01"), s, "a built CV can't go on the website without one of its phone-hidden PDFs");
  const withPdf = { ...s, versions: s.versions.map((x) => (x.id === 2 ? { ...x, pdfs: { hidden: "/data/cvs/v2-hidden.pdf" } } : x)) };
  const live = v.makeLive(withPdf, 2, "2025-05-01", "hidden");
  assert.deepEqual([live.live, live.liveTemplate, live.versions[1].locked], [2, "hidden", true], "putting it on the website locks it");
});

test("six PDFs per CV: names, lookups, what goes with a deleted version, and what the website offers (only phone-hidden ones)", () => {
  assert.deepEqual(["normal", "hidden", "side", "sideHidden", "nophoto", "nophotoHidden"].map((k) => v.pdfFileName(7, k)), ["v7.pdf", "v7-hidden.pdf", "v7-side.pdf", "v7-side-hidden.pdf", "v7-nophoto.pdf", "v7-nophoto-hidden.pdf"]);
  const nl = String.fromCharCode(10);
  const text = ["live: 2", "liveTemplate: sideHidden", "versions:", "  - { id: 1, pdf: /data/documents/old.pdf }", "  - id: 2", "    doc: true", "    pdf: /data/cvs/v2.pdf",
    "    pdfs: { hidden: /data/cvs/v2-hidden.pdf, side: /data/cvs/v2-side.pdf, sideHidden: /data/cvs/v2-side-hidden.pdf, bogus: /x.pdf }"].join(nl);
  const s = v.parseVersions(text);
  const [uploaded, built] = s.versions;
  assert.deepEqual(built.pdfs, { hidden: "/data/cvs/v2-hidden.pdf", side: "/data/cvs/v2-side.pdf", sideHidden: "/data/cvs/v2-side-hidden.pdf" }, "unknown templates are ignored");
  assert.equal(v.pdfOf(built, "normal"), "/data/cvs/v2.pdf");
  assert.equal(v.pdfOf(built, "nophoto"), "", "a template without its file");
  assert.equal(v.websitePdf(s), "/data/cvs/v2-side-hidden.pdf", "the website offers the chosen phone-hidden PDF");
  assert.equal(v.websitePdf({ ...s, liveTemplate: null }), "", "a built CV without a chosen phone-hidden template offers nothing (its other PDFs have the number)");
  assert.equal(v.websitePdf({ ...s, live: 1, liveTemplate: null }), "/data/documents/old.pdf", "an uploaded CV offers its one PDF");
  assert.deepEqual(v.ownPdfs(built), ["/data/cvs/v2.pdf", "/data/cvs/v2-hidden.pdf", "/data/cvs/v2-side.pdf", "/data/cvs/v2-side-hidden.pdf"]);
  assert.deepEqual(v.ownPdfs(uploaded), [], "a PDF that lives elsewhere is never deleted");
  assert.deepEqual(v.parseVersions(v.stringifyVersions(s)), s);
  // a template with the phone number can never be the one the website offers
  assert.equal(v.parseVersions(text.replace("sideHidden", "side")).liveTemplate, null);
  assert.equal(v.makeLive(s, 2, "2025-06-01", "side"), s, "choosing a template with the number does nothing");
  assert.equal(v.makeLive(s, 2, "2025-06-01", "nophotoHidden"), s, "choosing a template that has no PDF does nothing");
  const other = v.makeLive(s, 2, "2025-06-01", "hidden");
  assert.deepEqual([other.live, other.liveTemplate, other.versions[1].liveFrom], [2, "hidden", ""], "the same CV can change template without a new live date");
});
